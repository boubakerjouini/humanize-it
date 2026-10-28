// ===========================================================
// lib/ops/checks.ts — The daily ops step (lib/growth/daily-job.ts). Each
// failed check opens one high-priority CrmTask a day (dedupeKey
// `ops:<check>:<YYYY-MM-DD>`, contactId null), the same alert channel as
// "Support forwards are not arriving" in lib/email/inbound.ts: the /admin
// overview counts it and the agent tasks API lists it. Nothing is emailed.
//
// What it catches: a webhook or cron secret that is unset (the 2026-10-26
// Clerk outage), Clerk deliveries that stopped while signups continue, a
// spike of server errors per area or any webhook 500 (DailyMetric, counted
// by instrumentation.ts and the webhook routes), one-off emails that failed
// for good, and a daily job that errored or skipped a day. Task bodies hold
// counts, names and admin links only: no secret values, no personal data.
// A dead cron can't report itself; the external probe
// (.github/workflows/webhook-probe.yml) covers the app being down.
// ===========================================================

import { db } from "@/lib/db";
import { utcDay } from "@/lib/growth/daily-metrics";
import { isUniqueViolation, logGrowthError } from "@/lib/growth/safe";
import { OPS_AREAS, WEBHOOK_SOURCES } from "@/lib/ops/areas";

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

export const OPS_SECRETS = ["CLERK_WEBHOOK_SECRET", "POLAR_WEBHOOK_SECRET", "RESEND_WEBHOOK_SECRET", "CRON_SECRET"] as const;
/** Server errors in one area on one day before it is worth a look. */
export const SERVER_ERROR_THRESHOLD = 10;
const CLERK_SILENT_MS = 48 * HOUR_MS;
// A signup's webhook can trail the row an API route created by a few seconds.
const CLERK_GRACE_MS = 10 * 60_000;
// Matches the send retry limit in lib/email/send.ts and the daily job.
const EMAIL_MAX_ATTEMPTS = 3;
// The cron runs once a day; two hours of slack for its start time.
const JOB_GAP_MS = 26 * HOUR_MS;

export type OpsCheck =
  | `${Lowercase<(typeof OPS_SECRETS)[number]>}`
  | "clerk_webhook_silent"
  | "server_errors"
  | "webhook_fail"
  | "email_failed"
  | "daily_job";

export interface OpsAlert {
  check: OpsCheck;
  title: string;
  body: string;
}

export interface OpsCheckResult {
  /** The checks that raised an alert today (names only). */
  alerts: OpsCheck[];
}

function dayKey(at: Date): string {
  return utcDay(at).toISOString().slice(0, 10);
}

/** Open today's task for a failed check once; later runs the same day are no-ops. Never throws. */
async function saveOpsTask(alert: OpsAlert, now: Date): Promise<void> {
  try {
    await db.crmTask.create({
      data: {
        contactId: null,
        title: alert.title,
        body: alert.body,
        kind: "other",
        priority: "high",
        source: "rule",
        ruleKey: "ops",
        dedupeKey: `ops:${alert.check}:${dayKey(now)}`,
        dueAt: now,
        createdBy: "ops-check",
      },
    });
  } catch (err) {
    if (!isUniqueViolation(err)) logGrowthError("ops-task", err);
  }
}

/** Only whether each secret is set, never its value. */
function secretAlerts(env: NodeJS.ProcessEnv): OpsAlert[] {
  return OPS_SECRETS.filter((name) => !env[name]?.trim()).map((name) => ({
    check: name.toLowerCase() as OpsCheck,
    title: `${name} is not set`,
    body: `${name} is empty in this environment, so its endpoint can't verify requests. Set it in Vercel (Production) and redeploy.`,
  }));
}

async function clerkSilentAlert(now: Date): Promise<OpsAlert | null> {
  const from = new Date(now.getTime() - CLERK_SILENT_MS);
  const [signups, deliveries] = await Promise.all([
    db.user.count({ where: { createdAt: { gte: from, lt: new Date(now.getTime() - CLERK_GRACE_MS) } } }),
    db.webhookEvent.count({ where: { source: "clerk", createdAt: { gte: from } } }),
  ]);
  if (signups === 0 || deliveries > 0) return null;
  return {
    check: "clerk_webhook_silent",
    title: "Clerk webhooks stopped arriving",
    body:
      `${signups} account${signups === 1 ? " was" : "s were"} created in the last 48 hours, but no Clerk webhook was received. ` +
      `Check the endpoint in Clerk (Webhooks > Message attempts) and that CLERK_WEBHOOK_SECRET matches its signing secret.`,
  };
}

async function metricAlerts(now: Date): Promise<OpsAlert[]> {
  const today = utcDay(now);
  const yesterday = new Date(today.getTime() - DAY_MS);
  const rows = await db.dailyMetric.findMany({
    where: { day: { gte: yesterday }, key: { startsWith: "ops." } },
    select: { day: true, key: true, count: true },
  });
  const alerts: OpsAlert[] = [];

  const errorAreas = OPS_AREAS.map((area) => ({
    area,
    count: rows.find((r) => r.key === `ops.5xx.${area}` && r.day.getTime() === yesterday.getTime())?.count ?? 0,
  })).filter((a) => a.count >= SERVER_ERROR_THRESHOLD);
  if (errorAreas.length) {
    alerts.push({
      check: "server_errors",
      title: `Server errors on ${dayKey(yesterday)}`,
      body:
        `${errorAreas.map((a) => `${a.area}: ${a.count}`).join(", ")} (threshold ${SERVER_ERROR_THRESHOLD} a day per area). ` +
        `The messages are in the Vercel logs; look for lines starting with [ops].`,
    });
  }

  // Yesterday and today so far: the job may run before a late failure is counted.
  const failed = WEBHOOK_SOURCES.map((source) => ({
    source,
    count: rows.filter((r) => r.key === `ops.webhook_fail.${source}`).reduce((n, r) => n + r.count, 0),
  })).filter((f) => f.count > 0);
  if (failed.length) {
    alerts.push({
      check: "webhook_fail",
      title: "Webhooks returned errors",
      body:
        `${failed.map((f) => `${f.source}: ${f.count}`).join(", ")} failed deliveries since ${dayKey(yesterday)}. ` +
        `The provider retries them; check its delivery log, the Vercel logs, and /admin/audit for billing entries.`,
    });
  }
  return alerts;
}

async function emailFailedAlert(now: Date): Promise<OpsAlert | null> {
  const count = await db.emailMessage.count({
    where: { status: "failed", attempts: { gte: EMAIL_MAX_ATTEMPTS }, updatedAt: { gte: new Date(now.getTime() - DAY_MS) } },
  });
  if (count === 0) return null;
  return {
    check: "email_failed",
    title: `${count} email${count === 1 ? "" : "s"} failed for good`,
    body: `${count} email${count === 1 ? "" : "s"} failed ${EMAIL_MAX_ATTEMPTS} times in the last 24 hours and won't be retried. See /admin/email-log.`,
  };
}

/** The run before this one: errored, or more than a day before it (a missed cron). */
async function dailyJobAlert(now: Date, job: { name: string; runId: string | null }): Promise<OpsAlert | null> {
  const prev = await db.jobRun.findFirst({
    where: { job: job.name, status: { in: ["ok", "error"] }, ...(job.runId ? { id: { not: job.runId } } : {}) },
    orderBy: { startedAt: "desc" },
    select: { status: true, startedAt: true },
  });
  if (!prev) return null;
  if (prev.status === "error") {
    return {
      check: "daily_job",
      title: "The last daily job had errors",
      body: `The run started ${prev.startedAt.toISOString().slice(0, 16).replace("T", " ")} UTC ended with errors. Its last run and errors are in the status banner on /admin/email-log, and in the Vercel logs.`,
    };
  }
  if (now.getTime() - prev.startedAt.getTime() > JOB_GAP_MS) {
    return {
      check: "daily_job",
      title: "The daily job skipped a day",
      body: `The previous run started ${prev.startedAt.toISOString().slice(0, 16).replace("T", " ")} UTC, more than 26 hours ago. Check the cron in Vercel (Settings > Cron Jobs) and CRON_SECRET.`,
    };
  }
  return null;
}

/**
 * Run every check and open a task for each failure. A check that throws is
 * logged and skipped, so one broken query never hides the others.
 */
export async function runOpsChecks(
  now: Date = new Date(),
  job: { name: string; runId: string | null } = { name: "growth-daily", runId: null },
  env: NodeJS.ProcessEnv = process.env
): Promise<OpsCheckResult> {
  const settled = await Promise.allSettled([
    Promise.resolve(secretAlerts(env)),
    clerkSilentAlert(now),
    metricAlerts(now),
    emailFailedAlert(now),
    dailyJobAlert(now, job),
  ]);
  const alerts: OpsAlert[] = [];
  for (const s of settled) {
    if (s.status === "rejected") logGrowthError("ops-check", s.reason);
    else if (Array.isArray(s.value)) alerts.push(...s.value);
    else if (s.value) alerts.push(s.value);
  }
  for (const alert of alerts) await saveOpsTask(alert, now);
  return { alerts: alerts.map((a) => a.check) };
}
