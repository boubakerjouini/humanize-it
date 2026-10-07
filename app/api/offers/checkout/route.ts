// ===========================================================
// POST /api/offers/checkout — LemonSqueezy checkout for a one-time offer
// Body: { offer: "founding" | "wordpack" } → { url }
//
// The order is fulfilled by the LemonSqueezy webhook (order_created), keyed on
// the variant, never on this request. Founding refuses accounts that already
// pay through a subscription: its webhook sets the plan with an expiry, which
// a later subscription event would overwrite, so those buyers are switched by
// hand (support email) instead of silently losing what they paid for.
// ===========================================================

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createCheckout } from "@lemonsqueezy/lemonsqueezy.js";
import { configureLemonSqueezy } from "@/lib/lemonsqueezy";
import { db } from "@/lib/db";
import { effectivePlanId } from "@/lib/quota";
import { foundingVariantId, wordPackConfig, type OneTimeOffer } from "@/lib/plans";
import { trackServer } from "@/lib/posthog";
import { foundingStatus } from "../shared";

export const runtime = "nodejs";

const FOUNDING_CHECKOUT_TTL_MS = 60 * 60 * 1000;

function error(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function POST(req: Request) {
  configureLemonSqueezy();
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

    let variantId: string | null;
    if (offer === "founding") {
      variantId = foundingVariantId();
      if (!variantId) return error("OFFER_NOT_CONFIGURED", "Founding 100 isn't on sale yet.", 409);
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
      variantId = wordPackConfig()?.variantId ?? null;
      if (!variantId) return error("OFFER_NOT_CONFIGURED", "Word packs aren't on sale.", 409);
    }

    const storeId = process.env.LEMONSQUEEZY_STORE_ID;
    if (!storeId) return error("STORE_NOT_CONFIGURED", "Store ID missing.", 500);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    const { data, error: lsError } = await createCheckout(storeId, variantId, {
      checkoutOptions: { embed: false, media: true, logo: true },
      checkoutData: {
        email: user.email,
        name: user.name ?? undefined,
        // Passed through to the webhook as meta.custom_data.
        custom: { clerk_id: clerkId, offer },
      },
      productOptions: {
        redirectUrl: offer === "founding" ? `${baseUrl}/dashboard/settings?founding=welcome` : `${baseUrl}/dashboard?wordpack=1`,
        receiptLinkUrl: `${baseUrl}/dashboard/settings`,
        receiptButtonText: "Go to dashboard",
        receiptThankYouNote:
          offer === "founding" ? "Thank you for backing HumanizeIt as a founding member!" : "Thank you! Your words are on their way.",
        enabledVariants: [Number(variantId)],
      },
      // A founding checkout expires after an hour: the cap is checked when it
      // opens, so a stale tab must not be able to buy a seat days later.
      expiresAt: offer === "founding" ? new Date(Date.now() + FOUNDING_CHECKOUT_TTL_MS).toISOString() : null,
      preview: false,
      testMode: process.env.LEMONSQUEEZY_TEST_MODE === "true" || process.env.NODE_ENV !== "production",
    });

    if (lsError || !data?.data.attributes.url) {
      console.error("[offers/checkout] Lemon Squeezy error:", lsError);
      return error("LS_ERROR", "Failed to create checkout.", 500);
    }

    trackServer(clerkId, "offer_checkout_started", { offer });
    return NextResponse.json({ url: data.data.attributes.url });
  } catch (err) {
    console.error("[offers/checkout] error:", err);
    return error("INTERNAL_ERROR", "Something went wrong.", 500);
  }
}
