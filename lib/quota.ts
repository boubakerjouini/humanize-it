// ===========================================================
// lib/quota.ts — Quota reset, plan resolution & atomic metering
// ===========================================================

import { db } from "@/lib/db";
import { PLANS, type PlanId, type PlanConfig } from "@/lib/plans";

type QuotaUser = {
  id: string;
  plan: string;
  planExpiresAt?: Date | null;
  wordsUsed: number;
  rewriteCount: number;
  quotaResetAt: Date;
};

/**
 * Resolve the plan a user is actually entitled to right now.
 * A non-FREE plan whose `planExpiresAt` is in the past (e.g. a lapsed redeem
 * grant) is treated as FREE.
 */
export function effectivePlanId(user: { plan: string; planExpiresAt?: Date | null }): PlanId {
  const planId = (user.plan as PlanId) in PLANS ? (user.plan as PlanId) : "FREE";
  if (
    planId !== "FREE" &&
    user.planExpiresAt &&
    new Date(user.planExpiresAt).getTime() < Date.now()
  ) {
    return "FREE";
  }
  return planId;
}

export function planConfigFor(user: { plan: string; planExpiresAt?: Date | null }): PlanConfig {
  return PLANS[effectivePlanId(user)];
}

/**
 * Check if the user's plan grant has lapsed (and downgrade) and if the quota
 * period has expired (and reset). Returns the (possibly updated) user object.
 */
export async function checkAndResetQuota<T extends QuotaUser>(user: T): Promise<T> {
  let current: T = user;

  // 1. Lapsed redeem grant → downgrade to FREE and reset the meter.
  if (
    current.plan !== "FREE" &&
    current.planExpiresAt &&
    new Date(current.planExpiresAt).getTime() < Date.now()
  ) {
    const updated = await db.user.update({
      where: { id: current.id },
      data: { plan: "FREE", planExpiresAt: null, wordsUsed: 0, rewriteCount: 0, quotaResetAt: new Date() },
    });
    current = { ...current, ...updated } as T;
  }

  const plan = PLANS[current.plan as PlanId];
  if (!plan) return current;

  const now = new Date();
  const resetAt = new Date(current.quotaResetAt);

  // Next reset boundary based on the plan's word-limit period.
  const nextReset = new Date(resetAt);
  if (plan.wordsLimitPeriod === "day") {
    nextReset.setDate(nextReset.getDate() + 1);
  } else {
    nextReset.setMonth(nextReset.getMonth() + 1);
  }

  if (now >= nextReset) {
    const updated = await db.user.update({
      where: { id: current.id },
      data: { wordsUsed: 0, rewriteCount: 0, quotaResetAt: now },
    });
    return { ...current, ...updated } as T;
  }

  return current;
}

/**
 * Atomically reserve `words` against the user's word quota for the given plan.
 *
 * Returns `true` if the words fit within the plan limit and were charged,
 * `false` if charging them would exceed the limit (caller should 402/429).
 * The conditional `updateMany` makes this race-safe under concurrency — two
 * simultaneous requests can never both push `wordsUsed` past the limit.
 */
export async function consumeWordQuota(
  userId: string,
  words: number,
  plan: PlanConfig
): Promise<boolean> {
  const charge = Math.max(0, words);

  // Unlimited plans: record usage for analytics, always allow.
  if (plan.wordsLimit === -1) {
    await db.user.update({
      where: { id: userId },
      data: { wordsUsed: { increment: charge } },
    });
    return true;
  }

  const res = await db.user.updateMany({
    where: { id: userId, wordsUsed: { lte: plan.wordsLimit - charge } },
    data: { wordsUsed: { increment: charge } },
  });
  return res.count > 0;
}

/** Refund a previously-reserved word charge (e.g. when the downstream AI call fails). */
export async function refundWordQuota(userId: string, words: number): Promise<void> {
  const charge = Math.max(0, words);
  if (charge === 0) return;
  try {
    await db.user.updateMany({
      where: { id: userId, wordsUsed: { gte: charge } },
      data: { wordsUsed: { decrement: charge } },
    });
  } catch {
    // Best-effort refund — never throw from cleanup.
  }
}
