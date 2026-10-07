// ===========================================================
// app/api/admin/email/_lib/respond.ts — Shared responses for the email admin
// routes (email, sequences, enrollments, campaigns). Errors use the project
// envelope { error: { code, message } }; requireAdmin's 401/403 and
// CampaignError keep their status, anything unexpected is a logged 500.
// ===========================================================

import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { CampaignError } from "@/lib/email/campaigns";
import { logGrowthError } from "@/lib/growth/safe";

export function fail(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export function handleError(label: string, err: unknown) {
  if (err instanceof CampaignError) return fail(err.code, err.message, err.status);
  if (err instanceof ZodError) return fail("INVALID_INPUT", err.issues[0]?.message ?? "Invalid input.", 400);
  const status = (err as { status?: number })?.status;
  if (status === 401) return fail("UNAUTHORIZED", "Authentication required.", 401);
  if (status === 403) return fail("FORBIDDEN", "Admin access required.", 403);
  logGrowthError(label, err);
  return fail("INTERNAL_ERROR", "Something went wrong.", 500);
}

/** Parsed JSON body, or a 400 response to return as is. */
export async function readJson(req: Request): Promise<{ ok: true; body: unknown } | { ok: false; response: NextResponse }> {
  try {
    return { ok: true, body: await req.json() };
  } catch {
    return { ok: false, response: fail("INVALID_JSON", "Invalid JSON body.", 400) };
  }
}
