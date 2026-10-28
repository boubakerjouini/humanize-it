// ===========================================================
// GET /api/health — Public liveness check for the external probe
// (.github/workflows/webhook-probe.yml). 200 when the database answers and
// the core env vars are set, 503 otherwise. Booleans and latency only: never
// a DB error string or the names of missing variables, since anyone can call
// it. The details are in the Vercel logs and the daily ops check.
// ===========================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, { ok: boolean; latencyMs?: number }> = {};

  const dbStart = Date.now();
  try {
    await db.$queryRawUnsafe("SELECT 1");
    checks.database = { ok: true, latencyMs: Date.now() - dbStart };
  } catch (err) {
    console.error("[health] database check failed:", err instanceof Error ? err.message : err);
    checks.database = { ok: false, latencyMs: Date.now() - dbStart };
  }

  const requiredEnvVars = ["DATABASE_URL", "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY"];
  checks.env = { ok: requiredEnvVars.every((v) => !!process.env[v]) };

  const allOk = Object.values(checks).every((c) => c.ok);

  return NextResponse.json(
    { status: allOk ? "healthy" : "unhealthy", checks },
    { status: allOk ? 200 : 503 }
  );
}
