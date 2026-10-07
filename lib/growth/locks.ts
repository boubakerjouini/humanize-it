// ===========================================================
// lib/growth/locks.ts — Lease locks and job-run bookkeeping for scheduled work.
//
// Vercel cron can fire twice or overlap a manual "Run now", so every job takes
// a lease row in JobLock first. Session advisory locks don't survive Neon's
// transaction pooler, hence a plain row with an expiry: a crashed run frees
// the lock once lockedUntil passes. JobRun keeps the history the admin sees.
// ===========================================================

import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import type { Prisma } from "@/app/generated/prisma/client";
import { isUniqueViolation, logGrowthError } from "@/lib/growth/safe";

export type JobLockResult<T> = { locked: true } | { locked: false; result: T };

async function acquire(key: string, owner: string, ttlMs: number): Promise<boolean> {
  const now = new Date();
  const lockedUntil = new Date(now.getTime() + ttlMs);
  try {
    await db.jobLock.create({ data: { key, owner, lockedUntil } });
    return true;
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
  }
  // The row exists: take it over only if the previous lease has expired.
  const res = await db.jobLock.updateMany({
    where: { key, lockedUntil: { lt: now } },
    data: { owner, lockedUntil },
  });
  return res.count === 1;
}

async function release(key: string, owner: string): Promise<void> {
  try {
    await db.jobLock.updateMany({ where: { key, owner }, data: { lockedUntil: new Date(0) } });
  } catch (err) {
    // The lease expires on its own; a failed release only delays the next run.
    logGrowthError("lock-release", err);
  }
}

/**
 * Run `fn` while holding the lease `key` for at most `ttlMs`. Returns
 * { locked: true } without running when another holder has it. Errors from
 * `fn` propagate after the lease is released.
 */
export async function withJobLock<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<JobLockResult<T>> {
  const owner = randomUUID();
  if (!(await acquire(key, owner, ttlMs))) return { locked: true };
  try {
    return { locked: false, result: await fn() };
  } finally {
    await release(key, owner);
  }
}

export type JobTrigger = "cron" | "manual";
export type JobRunStatus = "running" | "ok" | "error" | "locked";

/** Open a JobRun row; returns its id. */
export async function startJobRun(job: string, trigger: JobTrigger, actorEmail?: string | null): Promise<string> {
  const run = await db.jobRun.create({ data: { job, trigger, actorEmail: actorEmail ?? null } });
  return run.id;
}

/** Close a JobRun row. Never throws: bookkeeping must not mask the job's own result. */
export async function finishJobRun(
  id: string,
  outcome: { status: Exclude<JobRunStatus, "running">; stats?: Prisma.InputJsonValue; error?: string | null }
): Promise<void> {
  try {
    await db.jobRun.update({
      where: { id },
      data: {
        status: outcome.status,
        finishedAt: new Date(),
        stats: outcome.stats,
        error: outcome.error ? outcome.error.slice(0, 2000) : null,
      },
    });
  } catch (err) {
    logGrowthError("job-run", err);
  }
}

/** Record a run that was skipped because the lock was busy. */
export async function recordLockedRun(job: string, trigger: JobTrigger, actorEmail?: string | null): Promise<void> {
  try {
    const now = new Date();
    await db.jobRun.create({
      data: { job, trigger, actorEmail: actorEmail ?? null, status: "locked", startedAt: now, finishedAt: now },
    });
  } catch (err) {
    logGrowthError("job-run", err);
  }
}

export async function lastJobRun(job: string) {
  return db.jobRun.findFirst({ where: { job }, orderBy: { startedAt: "desc" } });
}
