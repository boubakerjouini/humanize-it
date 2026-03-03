// ===========================================================
// POST /api/billing/portal — Lemon Squeezy customer portal
// Returns the manage-subscription URL from the stored subscription
// ===========================================================

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getSubscription } from "@lemonsqueezy/lemonsqueezy.js";
import { configureLemonSqueezy } from "@/lib/lemonsqueezy";
import { db } from "@/lib/db";

export async function POST() {
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

    if (!user?.subscription?.lsSubscriptionId) {
      return NextResponse.json(
        {
          error: {
            code: "NO_SUBSCRIPTION",
            message: "No active subscription found.",
          },
        },
        { status: 400 }
      );
    }

    // Retrieve the subscription to get the live customer portal URL
    const { data, error } = await getSubscription(
      user.subscription.lsSubscriptionId
    );

    if (error || !data) {
      console.error("[billing/portal] LS error:", error);
      return NextResponse.json(
        { error: { code: "LS_ERROR", message: "Failed to retrieve subscription." } },
        { status: 500 }
      );
    }

    const portalUrl = data.data.attributes.urls?.customer_portal;
    if (!portalUrl) {
      return NextResponse.json(
        { error: { code: "NO_PORTAL_URL", message: "Portal URL unavailable." } },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: portalUrl });
  } catch (err) {
    console.error("[billing/portal] error:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Something went wrong." } },
      { status: 500 }
    );
  }
}
