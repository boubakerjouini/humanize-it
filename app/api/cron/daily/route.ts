// ===========================================================
// app/api/cron/daily/route.ts — Daily Vercel Cron entry (vercel.json, 08:00 UTC).
//
// STUB created by stream F; owned by stream B, which runs the daily job here
// (spec §5.4). It exists so the scheduled cron never hits a 404 and the public
// /api/cron/* path (middleware.ts) always has a handler enforcing the secret.
// Vercel sends `Authorization: Bearer $CRON_SECRET`; any other request, or no
// CRON_SECRET configured, gets a 401.
// ===========================================================

import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  // Nothing to run until stream B ships the daily job.
  return NextResponse.json({ ok: true, ran: false });
}
