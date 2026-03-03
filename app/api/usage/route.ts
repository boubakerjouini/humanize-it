// ===========================================================
// GET /api/usage — Current user usage stats
// ===========================================================

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { PLANS } from "@/lib/plans";

export async function GET() {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Authentication required." } },
        { status: 401 }
      );
    }

    const user = await db.user.upsert({
      where: { clerkId },
      update: {},
      create: {
        clerkId,
        email: `${clerkId}@placeholder.humanize-it.app`,
        plan: "FREE",
        wordsUsed: 0,
      },
      include: { subscription: true },
    });

    const plan = PLANS[user.plan];

    return NextResponse.json({
      plan: user.plan,
      wordsUsed: user.wordsUsed,
      wordsLimit: plan.wordsLimit,
      rewriteCount: user.rewriteCount,
      rewriteLimit: plan.rewriteLimit,
      quotaResetAt: user.quotaResetAt,
      // Expose subscription status so the UI can show payment failure banners
      subscriptionStatus: user.subscription?.status ?? null,
      stripeCurrentPeriodEnd: user.subscription?.lsCurrentPeriodEnd ?? null,
    });
  } catch (err) {
    console.error("[usage] error:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Something went wrong." } },
      { status: 500 }
    );
  }
}
