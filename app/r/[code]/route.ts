// ===========================================================
// GET /r/[code] — Referral short link → /sign-up?ref=<code>
//
// The sign-up page's attribution capture stores `ref` in the touch cookies,
// and the signup hook attaches the referral. Anything that isn't a real code
// (lib/growth/attribution.ts normalizeRef) just lands on plain sign-up, so the
// link never errors, whether or not the program is on.
// ===========================================================

import { NextResponse } from "next/server";
import { normalizeRef } from "@/lib/growth/attribution";

export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const ref = normalizeRef(code);
  const target = new URL("/sign-up", req.url);
  if (ref) target.searchParams.set("ref", ref);
  return NextResponse.redirect(target, 307);
}
