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

    let body: { plan?: unknown } = {};
    try {
      body = await req.json();
    } catch {
      // default to PRO if no body
    }

    const planId = body.plan === "TEAM" ? "TEAM" : "PRO";
    const planConfig = PLANS[planId];

    if (!planConfig.stripePriceId) {
      return NextResponse.json(
        { error: { code: "PLAN_NOT_CONFIGURED", message: "Stripe price ID not configured." } },
        { status: 500 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: planConfig.stripePriceId,
          quantity: 1,
        },
      ],
      customer_email: user.subscription?.stripeCustomerId
        ? undefined
        : user.email,
      customer: user.subscription?.stripeCustomerId ?? undefined,
      metadata: {
        clerkId,
        planId,
      },
      success_url: `${baseUrl}/dashboard/editor?upgraded=true`,
      cancel_url: `${baseUrl}/dashboard/settings?cancelled=true`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[checkout] error:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Something went wrong." } },
      { status: 500 }
    );
  }
}
