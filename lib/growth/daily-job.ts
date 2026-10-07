// ===========================================================
// lib/growth/daily-job.ts — The one scheduled job (spec §5.4). Vercel Hobby
// runs crons once a day, so everything periodic happens here, in order:
//   1. recompute every contact (and create missing ones)
//   2. sweeps that enroll from state (grant expiry, abandoned checkout, …)
//   3. CRM auto-task rules
//   4. circuit breaker (before any marketing goes out)
//   5. due sequence steps          6. campaign draining
//   7. retry failed one-off sends  8. reset rows stuck in "sending"
// It runs under a 10-minute JobLock lease, so the cron and an admin "Run now"
// never overlap, and records a JobRun with per-step stats. New work stops at
// 240s to stay inside the 300s function limit. Steps fail independently: one
// error is recorded and the rest still run. With sending off, steps 1-3 still
// do their work and nothing is emailed or advanced.
// ===========================================================

import { db } from "@/lib/db";
import type { Prisma } from "@/app/generated/prisma/client";
import { remainingBudget } from "@/lib/email/budget";
import { drainCampaigns } from "@/lib/email/campaigns";
import { runCircuitBreaker } from "@/lib/email/circuit-breaker";
import { processDueEnrollments } from "@/lib/email/engine";
import { buildRetryInput, deliverBatch, prepareEmail, type Prepared } from "@/lib/email/send";
import { runSweeps } from "@/lib/email/sweeps";
import { recomputeAll } from "@/lib/crm/recompute";
import { runAutoTaskRules } from "@/lib/crm/task-rules";
import { emailSendingMode } from "@/lib/growth/flags";
import { finishJobRun, recordLockedRun, startJobRun, withJobLock, type JobTrigger } from "@/lib/growth/locks";
import { logGrowthError } from "@/lib/growth/safe";

export const DAILY_JOB = "growth-daily";
const LOCK_TTL_MS = 10 * 60_000;
const SOFT_DEADLINE_MS = 240_000;
const RETRY_WINDOW_MS = 72 * 3_600_000;
const STUCK_SENDING_MS = 3_600_000;
const MAX_ATTEMPTS = 3;
const RETRY_LIMIT = 100;

export type DailyJobResult =
  | { status: "locked" }
  | { status: "ok" | "error"; runId: string; stats: Record<string, unknown> };

/**
 * Daily step 7: one-off sends (inline transactional, personal notes) that
 * failed with attempts left. Sequence steps are retried by the engine and
 * campaign rows by the drain, both under their own dedupe keys.
 */
export async function retryFailedMessages(now: Date = new Date(), deadlineMs?: number): Promise<{ retried: number; sent: number; skipped: number }> {
  const out = { retried: 0, sent: 0, skipped: 0 };
  if (emailSendingMode() === "off") return out;
  const rows = await db.emailMessage.findMany({
    where: {
      status: "failed",
      attempts: { lt: MAX_ATTEMPTS },
      queuedAt: { gte: new Date(now.getTime() - RETRY_WINDOW_MS) },
      enrollmentId: null,
      campaignId: null,
    },
    select: { contactId: true, template: true, props: true, dedupeKey: true, topic: true, sequenceKey: true, stepKey: true, enrollmentId: true, campaignId: true },
    orderBy: { queuedAt: "asc" },
    take: RETRY_LIMIT,
  });
  let slots = await remainingBudget("bulk", now);
  const batch: Prepared[] = [];
  for (const row of rows) {
    if (slots <= 0 || (deadlineMs && Date.now() > deadlineMs)) break;
    const input = buildRetryInput(row, "bulk");
    if (!input) {
      out.skipped++;
      continue;
    }
    const res = await prepareEmail(input);
    out.retried++;
    if (res.ok) {
      batch.push(res.prepared);
      slots--;
    } else if (res.outcome.status === "deferred" && (res.outcome.reason === "budget" || res.outcome.reason === "disabled")) {
      break;
    }
  }
  if (batch.length > 0) {
    const outcomes = await deliverBatch(batch);
    out.sent = outcomes.filter((o) => o.status === "sent").length;
  }
  return out;
}

/** Daily step 8: a send that crashed mid-flight is retried later under the same idempotency key. */
export async function resetStuckSending(now: Date = new Date()): Promise<number> {
  const res = await db.emailMessage.updateMany({
    where: { status: "sending", updatedAt: { lt: new Date(now.getTime() - STUCK_SENDING_MS) } },
    data: { status: "failed", error: "stuck_sending" },
  });
  return res.count;
}

export async function runDailyJob(opts: { trigger: JobTrigger; actorEmail?: string | null }): Promise<DailyJobResult> {
  const result = await withJobLock(DAILY_JOB, LOCK_TTL_MS, async () => {
    const startedAt = Date.now();
    const deadlineMs = startedAt + SOFT_DEADLINE_MS;
    const now = new Date();
    const runId = await startJobRun(DAILY_JOB, opts.trigger, opts.actorEmail);
    const stats: Record<string, unknown> = { sendingMode: emailSendingMode() };
    const errors: string[] = [];

    const step = async <T>(name: string, fn: () => Promise<T>): Promise<T | null> => {
      if (Date.now() > deadlineMs) {
        stats[name] = "skipped_deadline";
        return null;
      }
      try {
        const value = await fn();
        stats[name] = value;
        return value;
      } catch (err) {
        logGrowthError(`daily:${name}`, err);
        errors.push(`${name}: ${err instanceof Error ? err.message : String(err)}`.slice(0, 300));
        return null;
      }
    };

    await step("recompute", () => recomputeAll(now));
    await step("sweeps", () => runSweeps(now, deadlineMs));
    await step("tasks", () => runAutoTaskRules(now));
    const breaker = await step("breaker", () => runCircuitBreaker(now));
    await step("sequences", () => processDueEnrollments({ now, deadlineMs }));
    if (breaker?.tripped) stats.campaigns = "paused_circuit_breaker";
    else await step("campaigns", () => drainCampaigns({ deadlineMs }));
    await step("retries", () => retryFailedMessages(now, deadlineMs));
    await step("stuckReset", () => resetStuckSending(now));

    stats.durationMs = Date.now() - startedAt;
    if (errors.length) stats.errors = errors;
    const status = errors.length ? "error" : "ok";
    await finishJobRun(runId, {
      status,
      stats: JSON.parse(JSON.stringify(stats)) as Prisma.InputJsonValue,
      error: errors.length ? errors.join("\n") : null,
    });
    return { status, runId, stats } as const;
  });

  if (result.locked) {
    await recordLockedRun(DAILY_JOB, opts.trigger, opts.actorEmail);
    return { status: "locked" };
  }
  return result.result;
}
