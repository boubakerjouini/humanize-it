// ===========================================================
// lib/email/budget.ts — Daily send budget under Resend's free plan (100/day).
// Our cap (EMAIL_DAILY_CAP, default 90) leaves margin because Resend doesn't
// document whether its day is a calendar UTC day or rolling 24h. Inline sends
// (welcome, magnet delivery) may use the whole cap; bulk sends (cron,
// campaigns) stop 20 short so a busy campaign day can't block a signup's
// welcome email.
// ===========================================================

import { db } from "@/lib/db";
import { emailDailyCap } from "@/lib/growth/flags";

export type SendPool = "inline" | "bulk";

/** Sends the bulk pool leaves for inline traffic. */
export const BULK_RESERVE = 20;

export function utcMidnight(at: Date = new Date()): Date {
  return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
}

/** Messages that left today (UTC), any status since. */
export async function sentToday(now: Date = new Date()): Promise<number> {
  return db.emailMessage.count({ where: { sentAt: { gte: utcMidnight(now) } } });
}

/** Pure: what a pool may still send given today's count and the cap. */
export function budgetFor(pool: SendPool, sent: number, cap: number): number {
  const limit = pool === "inline" ? cap : cap - BULK_RESERVE;
  return Math.max(0, limit - sent);
}

export async function remainingBudget(pool: SendPool, now: Date = new Date()): Promise<number> {
  return budgetFor(pool, await sentToday(now), emailDailyCap());
}
