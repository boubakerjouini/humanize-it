// ===========================================================
// POST /api/billing/portal — Polar customer portal
// Opens a short-lived customer session for the user's own Polar customer and
// returns its portal URL (manage plan, payment method, invoices, cancel).
// ===========================================================

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { customerPortalUrl, getPolar, POLAR_CALLS_PER_MINUTE } from "@/lib/polar";
import { db } from "@/lib/db";
import { checkRateLimit, rateLimitHeaders } from "@/lib/rate-limit";

export async function POST() {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Authentication required." } },
        { status: 401 }
      );
    }

    const user = await db.user.findUnique({ where: { clerkId }, select: { id: true } });
    if (!user) {
      return NextResponse.json({ error: { code: "USER_NOT_FOUND", message: "User not found." } }, { status: 401 });
    }

    const limit = await checkRateLimit(`polar:${user.id}`, POLAR_CALLS_PER_MINUTE);
    if (!limit.ok) {
      return NextResponse.json(
        { error: { code: "RATE_LIMITED", message: "Too many requests. Please wait a minute and try again." } },
        { status: 429, headers: { ...rateLimitHeaders(limit), "Retry-After": String(limit.retryAfterSeconds) } }
      );
    }

    const polar = getPolar();
    if (!polar) {
      return NextResponse.json(
        { error: { code: "BILLING_NOT_CONFIGURED", message: "Billing is not configured." } },
        { status: 500 }
      );
    }

    // Opened by our user id, so it can only ever show this user's own billing.
    const url = await customerPortalUrl(polar, user.id);
    if (!url) {
      // No Polar customer: nothing was ever bought (a comped, granted or seat plan).
      return NextResponse.json(
        { error: { code: "NO_SUBSCRIPTION", message: "There's no billing for this account: your plan wasn't bought through checkout." } },
        { status: 400 }
      );
    }
    return NextResponse.json({ url });
  } catch (err) {
    console.error("[billing/portal] Polar error:", err);
    return NextResponse.json(
      { error: { code: "PORTAL_FAILED", message: "Failed to open the billing portal." } },
      { status: 500 }
    );
  }
}
