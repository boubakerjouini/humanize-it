// ===========================================================
// POST /api/email/preferences — Save the preference center form.
// Body: { t: <prefs token>, topics: Topic[], lifecycle?: boolean, all?: boolean }
// The signed token is the only credential (no sign-in), so the response says
// nothing about the contact beyond the masked state the page already shows.
// ===========================================================

import { NextResponse } from "next/server";
import { contactFromPrefsToken, preferencesInputSchema, requestMeta, updatePreferences } from "@/lib/email/preferences";
import { checkRateLimit } from "@/lib/rate-limit";
import { logGrowthError } from "@/lib/growth/safe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 4096;

function fail(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function POST(req: Request) {
  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return fail("INVALID_INPUT", "Request too large.", 413);
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return fail("INVALID_JSON", "Invalid JSON.", 400);
  }
  const parsed = preferencesInputSchema.safeParse(body);
  if (!parsed.success) return fail("INVALID_INPUT", "Invalid preferences.", 400);
  const owner = contactFromPrefsToken(parsed.data.t);
  if (!owner) return fail("UNAUTHORIZED", "This link is invalid. Open the preferences link from a recent email.", 401);

  const limit = await checkRateLimit(`email-prefs:${owner.contactId}`, 20);
  if (!limit.ok) return fail("RATE_LIMITED", "Too many changes. Try again in a minute.", 429);

  try {
    const { topics, lifecycle, all } = parsed.data;
    const preferences = await updatePreferences(owner.contactId, { topics, lifecycle, all }, requestMeta(req));
    if (!preferences) return fail("NOT_FOUND", "We no longer have this address on file.", 404);
    return NextResponse.json({ ok: true, preferences });
  } catch (err) {
    logGrowthError("email-preferences", err);
    return fail("INTERNAL_ERROR", "Could not save your preferences. Please try again.", 500);
  }
}
