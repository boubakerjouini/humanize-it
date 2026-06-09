// ===========================================================
// lib/rate-limit.ts — Postgres-backed fixed-window rate limiter
// ===========================================================
//
// No external service required: one row per (key, minute) in the RateLimit
// table, incremented atomically via upsert. Works across serverless instances
// because the counter lives in the shared database.

import { db } from "@/lib/db";

export interface RateLimitResult {
  ok: boolean;
  limit: number;
  remaining: number;
  resetAt: Date;
  retryAfterSeconds: number;
}

/**
 * Allow up to `limit` requests per `key` per fixed `windowMs` window. Fails open
 * (allows the request) if the limiter store itself errors, so a transient DB
 * hiccup never hard-blocks legitimate traffic.
 */
export async function checkWindowedLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowAt = new Date(Math.floor(now / windowMs) * windowMs);
  const resetAt = new Date(windowAt.getTime() + windowMs);
  const retryAfterSeconds = Math.max(1, Math.ceil((resetAt.getTime() - now) / 1000));

  try {
    const row = await db.rateLimit.upsert({
      where: { key_windowAt: { key, windowAt } },
      create: { key, windowAt, count: 1 },
      update: { count: { increment: 1 } },
    });

    // Opportunistic cleanup of stale windows to keep the table bounded. Keep at
    // least one full window (plus an hour) so day-bucketed rows aren't reaped early.
    if (row.count === 1 && Math.random() < 0.02) {
      const cutoff = new Date(now - Math.max(windowMs, 60 * 60_000) - 60 * 60_000);
      db.rateLimit.deleteMany({ where: { windowAt: { lt: cutoff } } }).catch(() => {});
    }

    const remaining = Math.max(0, limit - row.count);
    return { ok: row.count <= limit, limit, remaining, resetAt, retryAfterSeconds };
  } catch {
    return { ok: true, limit, remaining: limit, resetAt, retryAfterSeconds };
  }
}

/** Allow up to `limitPerMinute` requests per `key` per fixed 60s window. */
export function checkRateLimit(key: string, limitPerMinute: number): Promise<RateLimitResult> {
  return checkWindowedLimit(key, limitPerMinute, 60_000);
}

/** Allow up to `limitPerDay` requests per `key` per fixed 24h (UTC) window.
 *  Used to cap anonymous/free usage of the public tool endpoints per IP. */
export function checkDailyLimit(key: string, limitPerDay: number): Promise<RateLimitResult> {
  return checkWindowedLimit(key, limitPerDay, 24 * 60 * 60_000);
}

/** Standard rate-limit response headers. */
export function rateLimitHeaders(r: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(r.limit),
    "X-RateLimit-Remaining": String(r.remaining),
    "X-RateLimit-Reset": String(r.resetAt.getTime()),
  };
}
