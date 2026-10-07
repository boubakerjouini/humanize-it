// ===========================================================
// lib/growth/daily-metrics.ts — Durable per-day counters for the funnel.
// RateLimit rows are reaped after ~25h, so they can't hold history; DailyMetric
// keeps one row per (UTC day, key). Only lead capture and confirmation are
// counted, plus forwarded support mail (it shares the Resend send budget):
// anonymous tool usage counters were cut (public, spammable, and PostHog
// already covers them).
// ===========================================================

import { db } from "@/lib/db";
import type { LeadSource } from "@/lib/growth/constants";
import { logGrowthError } from "@/lib/growth/safe";

/** inbound.forwarded: support mail forwarded to the founder (lib/email/inbound.ts); it counts against the send budget. */
export type DailyMetricKey = `lead.captured.${LeadSource}` | "lead.confirmed" | "inbound.forwarded";

/** UTC midnight of the given instant. */
export function utcDay(at: Date = new Date()): Date {
  return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
}

/** Increment today's counter for `key`. Never throws. */
export async function bumpDailyMetric(key: DailyMetricKey, n = 1, at: Date = new Date()): Promise<void> {
  if (!Number.isFinite(n) || n <= 0) return;
  const day = utcDay(at);
  try {
    await db.dailyMetric.upsert({
      where: { day_key: { day, key } },
      create: { day, key, count: Math.floor(n) },
      update: { count: { increment: Math.floor(n) } },
    });
  } catch (err) {
    logGrowthError("daily-metric", err);
  }
}
