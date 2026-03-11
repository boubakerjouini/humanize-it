import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, { ok: boolean; error?: string; latencyMs?: number }> = {};

  // DB connectivity check
  const dbStart = Date.now();
  try {
    await db.$queryRawUnsafe("SELECT 1");
    checks.database = { ok: true, latencyMs: Date.now() - dbStart };
  } catch (err) {
    checks.database = {
      ok: false,
      latencyMs: Date.now() - dbStart,
      error: err instanceof Error ? err.message : "Unknown DB error",
    };
  }

  // Env vars check
  const requiredEnvVars = ["DATABASE_URL", "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY"];
  const missingEnvVars = requiredEnvVars.filter((v) => !process.env[v]);
  checks.env = missingEnvVars.length === 0
    ? { ok: true }
    : { ok: false, error: `Missing: ${missingEnvVars.join(", ")}` };

  const allOk = Object.values(checks).every((c) => c.ok);

  return NextResponse.json(
    { status: allOk ? "healthy" : "unhealthy", checks },
    { status: allOk ? 200 : 503 }
  );
}
