// ===========================================================
// POST /api/offers/checkout — Polar checkout for a one-time offer
// Body: { offer: "founding" | "wordpack" } → { url }
//
// The order is fulfilled by the Polar webhook (order.paid), keyed on the
// product, never on this request. Founding refuses accounts that already
// pay through a subscription: its webhook sets the plan with an expiry, which
// a later subscription event would overwrite, so those buyers are switched by
// hand (support email) instead of silently losing what they paid for.
//
// A checkout that opened is recorded on the contact's timeline as an
// offer_checkout_started event with the offer ("founding" | "wordpack"). It is
// deliberately not a checkout_started: the abandoned-checkout task and email
// treat that as a subscription checkout, and these buyers never get a
// subscription, so every paid order would look abandoned.
// ===========================================================

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { appUrl, BillingAccountError, ensureCustomer, getPolar, POLAR_CALLS_PER_MINUTE } from "@/lib/polar";
import { db } from "@/lib/db";
import { effectivePlanId } from "@/lib/quota";
import { foundingProductId, wordPackConfig, type OneTimeOffer } from "@/lib/plans";
import { trackServer } from "@/lib/posthog";
import { recordEvent } from "@/lib/crm/events";
import { runAfter } from "@/lib/growth/safe";
import { checkRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { foundingStatus } from "../shared";

export const runtime = "nodejs";

function error(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function POST(req: Request) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return error("UNAUTHORIZED", "Authentication required.", 401);

    let body: { offer?: unknown } = {};
    try {
      body = await req.json();
    } catch {
      return error("INVALID_JSON", "Invalid JSON body.", 400);
    }
    if (body.offer !== "founding" && body.offer !== "wordpack") {
      return error("INVALID_INPUT", "offer must be \"founding\" or \"wordpack\".", 400);
    }
    const offer: OneTimeOffer = body.offer;

    const user = await db.user.findUnique({
      where: { clerkId },
      include: { subscription: { select: { status: true } } },
    });
    if (!user) return error("USER_NOT_FOUND", "User not found.", 401);

    const limit = await checkRateLimit(`polar:${user.id}`, POLAR_CALLS_PER_MINUTE);
    if (!limit.ok) {
      return NextResponse.json(
        { error: { code: "RATE_LIMITED", message: "Too many requests. Please wait a minute and try again." } },
        { status: 429, headers: { ...rateLimitHeaders(limit), "Retry-After": String(limit.retryAfterSeconds) } }
      );
    }

    let productId: string | null;
    if (offer === "founding") {
      productId = foundingProductId();
      if (!productId) return error("OFFER_NOT_CONFIGURED", "Founding 100 isn't on sale yet.", 409);
      const status = await foundingStatus();
      if (!status.open) return error("SOLD_OUT", "All 100 founding spots are taken. Founding 100 is closed.", 409);
      if (await db.purchase.count({ where: { userId: user.id, kind: "founding" } })) {
        return error("ALREADY_MEMBER", "You're already a founding member.", 409);
      }
      const subscribed = !!user.subscription && user.subscription.status !== "expired";
      if (!subscribed && user.plan === "PRO" && !user.planExpiresAt) {
        return error("ALREADY_LIFETIME", "Your account already has Pro with no end date, so Founding 100 would add nothing.", 409);
      }
      if (subscribed || effectivePlanId(user) === "TEAM") {
        return error(
          "HAS_SUBSCRIPTION",
          "Your account already has a paid plan. Email support@humanizeit.app and we'll move you to Founding 100 by hand.",
          409
        );
      }
    } else {
      productId = wordPackConfig()?.productId ?? null;
      if (!productId) return error("OFFER_NOT_CONFIGURED", "Word packs aren't on sale.", 409);
    }

    const polar = getPolar();
    if (!polar) return error("BILLING_NOT_CONFIGURED", "Billing is not configured.", 500);
    const baseUrl = appUrl();

    let url: string;
    try {
      const customerId = await ensureCustomer(polar, user);
      // The cap is checked here, but Polar keeps a session open for 24 hours and
      // offers no shorter expiry: a founding tab opened just before the 100th
      // sale can still be paid. The webhook honours that oversell and logs it.
      const checkout = await polar.checkouts.create({
        products: [productId],
        // The buyer's own customer: the webhook checks it against the metadata.
        customer_id: customerId,
        // Copied onto the order, so the webhook can read it (and grant the offer
        // even after its product env var is unset).
        metadata: { user_id: user.id, offer },
        success_url: offer === "founding" ? `${baseUrl}/dashboard/settings?founding=welcome` : `${baseUrl}/dashboard?wordpack=1`,
        return_url: offer === "founding" ? `${baseUrl}/lifetime` : `${baseUrl}/dashboard`,
      });
      url = checkout.url;
    } catch (polarError) {
      if (polarError instanceof BillingAccountError) {
        console.error(`[offers/checkout] userId=${user.id}: ${polarError.code}`);
        return error(polarError.code, polarError.message, 409);
      }
      console.error("[offers/checkout] Polar error:", polarError);
      return error("CHECKOUT_FAILED", "Failed to create checkout.", 500);
    }

    trackServer(clerkId, "offer_checkout_started", { offer });
    runAfter("offer-checkout-started", () => recordEvent({ userId: user.id, type: "offer_checkout_started", props: { offer } }));
    return NextResponse.json({ url });
  } catch (err) {
    console.error("[offers/checkout] error:", err);
    return error("INTERNAL_ERROR", "Something went wrong.", 500);
  }
}
