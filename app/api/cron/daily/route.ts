// ===========================================================
// GET /api/cron/daily — Daily Vercel Cron entry (vercel.json, 08:00 UTC).
//
// Runs the growth daily job (lib/growth/daily-job.ts): recompute, sweeps,
// task rules, circuit breaker, sequence steps, campaign draining, retries.
// The path is public in middleware.ts, so this handler is the only gate:
// Vercel sends `Authorization: Bearer $CRON_SECRET`; anything else, or no
// CRON_SECRET configured, gets a 401 JSON (never a redirect). Vercel Hobby
// allows one run a day and 300s per function; the job stops new work at 240s.
// ===========================================================

import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runDailyJob } from "@/lib/growth/daily-job";
import { logGrowthError } from "@/lib/growth/safe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Constant-time bearer check; hashing both sides first hides the secret's length. */
function isAuthorized(header: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !header) return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(header), digest(`Bearer ${secret}`));
}

export async function GET(req: Request) {
  if (!isAuthorized(req.headers.get("authorization"))) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } }, { status: 401 });
  }
  try {
    const result = await runDailyJob({ trigger: "cron" });
    if (result.status === "locked") return NextResponse.json({ ok: true, ran: false, status: "locked" });
    return NextResponse.json({ ok: result.status === "ok", ran: true, status: result.status, runId: result.runId, stats: result.stats });
  } catch (err) {
    logGrowthError("cron-daily", err);
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "The daily job failed to start." } }, { status: 500 });
  }
}
