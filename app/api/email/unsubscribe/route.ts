// ===========================================================
// /api/email/unsubscribe?t=<unsub token> — RFC 8058 one-click unsubscribe
//
// POST  The List-Unsubscribe-Post target mailbox providers call. Applies the
//       opt-out in the token's scope right away and answers 200 with an empty
//       body: no redirect, no cookies, no sign-in (RFC 8058 §3.2). An invalid
//       token gets 400.
// GET   Never changes anything, because link scanners prefetch GETs. It sends
//       a person who opened the header URL to the preference center, where
//       the unsubscribe button is highlighted (303).
// ===========================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { applyOneClickUnsubscribe, requestMeta } from "@/lib/email/preferences";
import { signToken, verifyToken } from "@/lib/email/tokens";
import { appUrl } from "@/lib/growth/flags";
import { logGrowthError } from "@/lib/growth/safe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const payload = verifyToken(new URL(req.url).searchParams.get("t"), "unsub");
  if (!payload) {
    return NextResponse.json({ error: { code: "INVALID_INPUT", message: "Invalid or expired link." } }, { status: 400 });
  }
  try {
    const exists = await db.contact.findUnique({ where: { id: payload.c }, select: { id: true } });
    // A contact erased since the email went out has nothing left to unsubscribe.
    if (exists) await applyOneClickUnsubscribe(payload.c, payload.s ?? "all", requestMeta(req));
  } catch (err) {
    logGrowthError("one-click-unsubscribe", err);
    // 5xx lets the mailbox provider retry the one-click request.
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Could not unsubscribe right now." } }, { status: 500 });
  }
  return new Response(null, { status: 200, headers: { "Cache-Control": "no-store" } });
}

export async function GET(req: Request) {
  const target = new URL("/email/preferences", `${appUrl()}/`);
  const payload = verifyToken(new URL(req.url).searchParams.get("t"), "unsub");
  try {
    if (payload) {
      target.searchParams.set("t", signToken({ p: "prefs", c: payload.c, ...(payload.s ? { s: payload.s } : {}) }));
      target.searchParams.set("u", "1");
    }
  } catch (err) {
    logGrowthError("unsubscribe-redirect", err);
  }
  return NextResponse.redirect(target, { status: 303, headers: { "Cache-Control": "no-store" } });
}
