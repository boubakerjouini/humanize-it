// ===========================================================
// lib/growth/founder-digest.ts — The founder's morning digest: the last 24
// hours (lib/admin-metrics.ts getLast24hMetrics, plus open tasks) and how this
// morning's daily job went, as one short email to founderEmail(). It is the
// last step of the daily job, so it rides the one Hobby cron.
//
// It opens with the founder's own priorities (open CrmTask kind "priority",
// added in /admin/tasks), so the to-do list comes back every morning
// until each item is ticked. Otherwise counts only: no names, addresses or
// ids, and failed job steps by name, never their error text. Real sends need FOUNDER_DIGEST_ENABLED=true and live
// sending; the founder flips that switch after reading a "[TEST]" copy from
// /admin (sendFounderDigestTest, the shared 40/day test cap). One per UTC day.
// ===========================================================

import { db } from "@/lib/db";
import { founderEmail } from "@/lib/admin";
import { getLast24hMetrics, type Last24hMetrics } from "@/lib/admin-metrics";
import { normalizeEmail } from "@/lib/email/address";
import { PERSONAL_DAILY_LIMIT, PERSONAL_TEST_LIMIT_KEY } from "@/lib/email/personal";
import { sendEmail, type SendOutcome } from "@/lib/email/send";
import { emailSendingMode } from "@/lib/growth/flags";
import { checkDailyLimit } from "@/lib/rate-limit";

/** One of the founder's open priorities: his own task title, never user data. */
export type DigestPriority = { title: string; dueAt: Date | null };

export type DigestCounts = Last24hMetrics & { openTasks: number; priorities?: DigestPriority[] };

/** How many priorities the email lists; the rest are counted. */
export const DIGEST_PRIORITY_LIMIT = 8;

/** This morning's job, as far as the digest reports it. Null for a test sent outside the job. */
export type DigestJobStats = {
  sequenceSent: number | null;
  sequenceFailed: number | null;
  breakerTripped: boolean;
  /** Names of the steps that failed (never their messages, which can carry data). */
  failedSteps: string[];
};

export type FounderDigest = { subject: string; bodyMd: string };

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;

/** Pure: the digest's subject and Markdown body. */
export function buildFounderDigest(now: Date, counts: DigestCounts, job: DigestJobStats | null): FounderDigest {
  const day = now.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  const waiting = counts.openSupportEmails + counts.openHighTasks;
  const subject = `HumanizeIt ${day}: ${plural(counts.signups, "signup")}, ${plural(waiting, "item")} waiting`;

  const lines: string[] = [];
  const priorities = counts.priorities ?? [];
  if (priorities.length > 0) {
    lines.push("**Your priorities**", "");
    for (const p of priorities.slice(0, DIGEST_PRIORITY_LIMIT)) {
      const due = p.dueAt ? ` (due ${p.dueAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })}${p.dueAt.getTime() < now.getTime() ? ", overdue" : ""})` : "";
      lines.push(`- ${p.title}${due}`);
    }
    if (priorities.length > DIGEST_PRIORITY_LIMIT) lines.push(`- …and ${priorities.length - DIGEST_PRIORITY_LIMIT} more`);
    lines.push("", "[Tick them off in /admin/tasks](/admin/tasks)", "");
  }
  lines.push(
    "**Last 24 hours**",
    "",
    `- Signups: ${counts.signups}`,
    `- Free-tool runs: ${counts.toolRuns}`,
    `- Documents created: ${counts.documents}`,
    `- Checkout attempts: ${counts.upgradeAttempts}${counts.pausedAttempts > 0 ? ` (${counts.pausedAttempts} hit the paused checkout)` : ""}`,
    `- Emails sent: ${counts.emailsSent}`,
    `- Open support emails: ${counts.openSupportEmails}`,
    `- Open tasks: ${counts.openTasks} (${counts.openHighTasks} high priority)`
  );
  if (job) {
    lines.push(
      "",
      "**This morning's job**",
      "",
      `- Sequence steps sent: ${job.sequenceSent ?? "n/a"}, failed: ${job.sequenceFailed ?? "n/a"}`,
      `- Circuit breaker: ${job.breakerTripped ? "tripped, campaigns paused" : "ok"}`,
      `- Errors: ${job.failedSteps.length === 0 ? "none" : `${job.failedSteps.length} (${job.failedSteps.join(", ")})`}`
    );
  }
  lines.push("", "[Open the admin](/admin)");
  return { subject, bodyMd: lines.join("\n") };
}

export async function loadDigestCounts(): Promise<DigestCounts> {
  const [day, openTasks, priorities] = await Promise.all([
    getLast24hMetrics(),
    db.crmTask.count({ where: { status: "open" } }).catch(() => 0),
    db.crmTask
      .findMany({
        where: { status: "open", kind: "priority" },
        orderBy: [{ dueAt: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
        take: DIGEST_PRIORITY_LIMIT + 20,
        select: { title: true, dueAt: true },
      })
      .catch(() => [] as DigestPriority[]),
  ]);
  return { ...day, openTasks, priorities };
}

/** The real-send lock: the founder sets the env switch once he read a test. */
export function founderDigestEnabled(): boolean {
  return process.env.FOUNDER_DIGEST_ENABLED === "true" && emailSendingMode() === "live";
}

export function digestDedupeKey(now: Date): string {
  return `digest:${now.toISOString().slice(0, 10)}`;
}

export type DigestStepResult = "off" | "no_contact" | SendOutcome["status"];

/** Daily-job step: send today's digest to the founder, once per UTC day. */
export async function sendFounderDigest(now: Date, job: DigestJobStats): Promise<DigestStepResult> {
  if (!founderDigestEnabled()) return "off";
  const email = normalizeEmail(founderEmail());
  const contact = email ? await db.contact.findUnique({ where: { email }, select: { id: true } }) : null;
  if (!contact) return "no_contact";
  const digest = buildFounderDigest(now, await loadDigestCounts(), job);
  const result = await sendEmail({
    contactId: contact.id,
    template: "founder_digest",
    props: digest,
    dedupeKey: digestDedupeKey(now),
    pool: "bulk",
  });
  return result.status;
}

/** "[TEST]" copy to the asking admin's own contact, with live counts and no job section. Null when the test cap is used up. */
export async function sendFounderDigestTest(ownContactId: string, now: Date = new Date()): Promise<SendOutcome | null> {
  const limit = await checkDailyLimit(PERSONAL_TEST_LIMIT_KEY, PERSONAL_DAILY_LIMIT);
  if (!limit.ok) return null;
  return sendEmail({
    contactId: ownContactId,
    template: "founder_digest",
    props: buildFounderDigest(now, await loadDigestCounts(), null),
    dedupeKey: `test:digest:${now.getTime()}`,
    pool: "inline",
    isTest: true,
  });
}

/** The job's own stats, reduced to what the digest reports. */
export function digestJobStats(stats: Record<string, unknown>, errors: string[]): DigestJobStats {
  const seq = stats.sequences as { sent?: number; failed?: number } | null | undefined;
  const breaker = stats.breaker as { tripped?: boolean } | null | undefined;
  return {
    sequenceSent: typeof seq?.sent === "number" ? seq.sent : null,
    sequenceFailed: typeof seq?.failed === "number" ? seq.failed : null,
    breakerTripped: breaker?.tripped === true,
    failedSteps: errors.map((e) => e.split(":")[0]),
  };
}
