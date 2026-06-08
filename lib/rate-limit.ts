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
 * Allow up to `limitPerMinute` requests per `key` per rolling 60s window.
 * Fails open (allows the request) if the limiter store itself errors, so a
 * transient DB hiccup never hard-blocks legitimate traffic.
 */
export async function checkRateLimit(key: string, limitPerMinute: number): Promise<RateLimitResult> {
  const now = Date.now();
  const windowMs = 60_000;
  const windowAt = new Date(Math.floor(now / windowMs) * windowMs);
  const resetAt = new Date(windowAt.getTime() + windowMs);
  const retryAfterSeconds = Math.max(1, Math.ceil((resetAt.getTime() - now) / 1000));

  try {
    const row = await db.rateLimit.upsert({
      where: { key_windowAt: { key, windowAt } },
      create: { key, windowAt, count: 1 },
      update: { count: { increment: 1 } },
    });

    // Opportunistic cleanup of stale windows to keep the table bounded.
    if (row.count === 1 && Math.random() < 0.02) {
      const cutoff = new Date(now - 60 * 60_000); // 1h
      db.rateLimit.deleteMany({ where: { windowAt: { lt: cutoff } } }).catch(() => {});
    }

    const remaining = Math.max(0, limitPerMinute - row.count);
    return {
      ok: row.count <= limitPerMinute,
      limit: limitPerMinute,
      remaining,
      resetAt,
      retryAfterSeconds,
    };
  } catch {
    return { ok: true, limit: limitPerMinute, remaining: limitPerMinute, resetAt, retryAfterSeconds };
  }
}

/** Standard rate-limit response headers. */
export function rateLimitHeaders(r: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(r.limit),
    "X-RateLimit-Remaining": String(r.remaining),
    "X-RateLimit-Reset": String(r.resetAt.getTime()),
  };
}
