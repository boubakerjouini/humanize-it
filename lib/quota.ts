// ===========================================================
// lib/quota.ts — Quota reset logic
// ===========================================================

import { db } from "@/lib/db";
import { PLANS, type PlanId } from "@/lib/plans";

/**
 * Check if the user's quota period has expired and reset if needed.
 * Returns the (potentially updated) user object.
 */
export async function checkAndResetQuota(user: {
  id: string;
  plan: string;
  wordsUsed: number;
  rewriteCount: number;
  quotaResetAt: Date;
}) {
  const plan = PLANS[user.plan as PlanId];
  if (!plan) return user;

  const now = new Date();
  const resetAt = new Date(user.quotaResetAt);

  // Calculate next reset time
  let nextReset: Date;
  if (plan.wordsLimitPeriod === "day") {
    nextReset = new Date(resetAt);
    nextReset.setDate(nextReset.getDate() + 1);
  } else {
    // month
    nextReset = new Date(resetAt);
    nextReset.setMonth(nextReset.getMonth() + 1);
  }

  // If quota period has expired, reset counters
  if (now >= nextReset) {
    const updated = await db.user.update({
      where: { id: user.id },
      data: {
        wordsUsed: 0,
        rewriteCount: 0,
        quotaResetAt: now,
      },
    });
    return updated;
  }

  return user;
}
