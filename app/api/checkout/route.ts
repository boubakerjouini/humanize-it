// ===========================================================
// POST /api/checkout — Create Stripe Checkout session
// ===========================================================

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { PLANS } from "@/lib/plans";

export async function POST(req: Request) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Authentication required." } },
        { status: 401 }
      );
    }

    const user = await db.user.findUnique({
      where: { clerkId },
      include: { subscription: true },
    });
    if (!user) {
      return NextResponse.json(
        { error: { code: "USER_NOT_FOUND", message: "User not found." } },
        { status: 401 }
      );
    }

    // Parse request body — default to PRO monthly if missing
    let body: { plan?: unknown; annual?: unknown } = {};
    try {
      body = await req.json();
    } catch {
      // No body provided — fall through to defaults
    }

    const planId = body.plan === "TEAM" ? "TEAM" : "PRO";
    const isAnnual = body.annual === true;
    const planConfig = PLANS[planId];

    // Pick the correct Stripe price ID (annual vs monthly)
    const priceId =
      isAnnual && planConfig.stripePriceIdAnnual
        ? planConfig.stripePriceIdAnnual
        : planConfig.stripePriceId;

    if (!priceId) {
      return NextResponse.json(
        {
          error: {
            code: "PLAN_NOT_CONFIGURED",
            message: `Stripe price ID not configured for plan "${planId}"${isAnnual ? " (annual)" : ""}.`,
          },
        },
        { status: 500 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    const session = await stripe.checkout.sessions.create(
      {
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [{ price: priceId, quantity: 1 }],

        // Reuse existing customer if available; otherwise pre-fill email
        customer_email: user.subscription?.stripeCustomerId
          ? undefined
          : user.email,
        customer: user.subscription?.stripeCustomerId ?? undefined,

        // Allow promo/discount codes to be entered in checkout
        allow_promotion_codes: true,

        // Carry plan info for webhook processing
        metadata: { clerkId, planId, annual: isAnnual ? "true" : "false" },

        // Subscription-level metadata for Stripe dashboard filtering
        subscription_data: {
          metadata: { clerkId, planId, annual: isAnnual ? "true" : "false" },
        },

        success_url: `${baseUrl}/dashboard/editor?upgraded=true`,
        cancel_url: `${baseUrl}/dashboard/settings?cancelled=true`,
      },
      {
        // Idempotency key prevents duplicate sessions on double-click / retry
        idempotencyKey: `checkout-${clerkId}-${planId}-${isAnnual ? "annual" : "monthly"}-${Math.floor(Date.now() / 60_000)}`,
      }
    );

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[checkout] error:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Something went wrong." } },
      { status: 500 }
    );
  }
}
