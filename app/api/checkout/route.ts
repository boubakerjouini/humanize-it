// ===========================================================
// POST /api/checkout — Create Lemon Squeezy checkout URL
// ===========================================================

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createCheckout } from "@lemonsqueezy/lemonsqueezy.js";
import { configureLemonSqueezy } from "@/lib/lemonsqueezy";
import { db } from "@/lib/db";
import { PLANS } from "@/lib/plans";

export async function POST(req: Request) {
  configureLemonSqueezy();

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

    // Parse request body — default to PRO monthly
    let body: { plan?: unknown; annual?: unknown } = {};
    try { body = await req.json(); } catch { /* no body */ }

    const planId = body.plan === "TEAM" ? "TEAM" : "PRO";
    const isAnnual = body.annual === true;
    const planConfig = PLANS[planId];

    // Pick monthly or annual variant
    const variantId = isAnnual && planConfig.lsVariantIdAnnual
      ? planConfig.lsVariantIdAnnual
      : planConfig.lsVariantId;

    if (!variantId) {
      return NextResponse.json(
        {
          error: {
            code: "PLAN_NOT_CONFIGURED",
            message: `Lemon Squeezy variant ID not configured for "${planId}"${isAnnual ? " annual" : ""}.`,
          },
        },
        { status: 500 }
      );
    }

    const storeId = process.env.LEMONSQUEEZY_STORE_ID;
    if (!storeId) {
      return NextResponse.json(
        { error: { code: "STORE_NOT_CONFIGURED", message: "Store ID missing." } },
        { status: 500 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    const { data, error } = await createCheckout(storeId, variantId, {
      checkoutOptions: {
        embed: false,
        media: true,
        logo: true,
      },
      checkoutData: {
        email: user.email,
        name: user.name ?? undefined,
        // custom_data is passed through to webhook meta.custom_data
        custom: {
          clerk_id: clerkId,
          plan_id: planId,
          annual: isAnnual ? "true" : "false",
        },
      },
      productOptions: {
        redirectUrl: `${baseUrl}/dashboard/editor?upgraded=true`,
        receiptLinkUrl: `${baseUrl}/dashboard/settings`,
        receiptButtonText: "Go to dashboard",
        receiptThankYouNote: "Thank you for upgrading HumanizeIt!",
        enabledVariants: [Number(variantId)],
      },
      expiresAt: null,
      preview: false,
      // Explicit override (LEMONSQUEEZY_TEST_MODE=true) so preview/sandbox deploys
      // use test mode even though Vercel runs them with NODE_ENV=production.
      testMode:
        process.env.LEMONSQUEEZY_TEST_MODE === "true" ||
        process.env.NODE_ENV !== "production",
    });

    if (error || !data?.data.attributes.url) {
      console.error("[checkout] Lemon Squeezy error:", error);
      return NextResponse.json(
        { error: { code: "LS_ERROR", message: "Failed to create checkout." } },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: data.data.attributes.url });
  } catch (err) {
    console.error("[checkout] error:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Something went wrong." } },
      { status: 500 }
    );
  }
}
