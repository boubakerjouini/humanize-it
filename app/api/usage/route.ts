// ===========================================================
// GET /api/usage — Current user usage stats
// ===========================================================

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureUser } from "@/lib/user";
import { PLANS } from "@/lib/plans";
import { effectivePlanId } from "@/lib/quota";
import { bonusBalance } from "@/lib/crm/bonus";

export async function GET() {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Authentication required." } },
        { status: 401 }
      );
    }

    const base = await ensureUser(clerkId);
    const user = await db.user.findUnique({
      where: { id: base.id },
      include: { subscription: true },
    });
    if (!user) {
      return NextResponse.json(
        { error: { code: "INTERNAL_ERROR", message: "Something went wrong." } },
        { status: 500 }
      );
    }

    // A lapsed grant still reads PRO/TEAM until the next quota check downgrades
    // the row and zeroes the meter (lib/quota.ts checkAndResetQuota): report
    // that outcome now so the UI never shows a plan the user no longer has.
    const effectivePlan = effectivePlanId(user);
    const lapsed = effectivePlan !== user.plan;
    const plan = PLANS[effectivePlan];
    const sub = user.subscription;
    const paidPlan = PLANS[user.plan as keyof typeof PLANS];
    const billingInterval = !sub?.polarProductId || !paidPlan
      ? null
      : sub.polarProductId === paidPlan.polarProductIdAnnual ? "year"
      : sub.polarProductId === paidPlan.polarProductId ? "month"
      : null;
    // Separate and defensive: 0 when the contact (or its table) is missing.
    const bonus = await bonusBalance(user.id);

    return NextResponse.json({
      plan: user.plan,
      effectivePlan,
      wordsUsed: lapsed ? 0 : user.wordsUsed,
      wordsLimit: plan.wordsLimit,
      rewriteCount: lapsed ? 0 : user.rewriteCount,
      rewriteLimit: plan.rewriteLimit,
      quotaResetAt: user.quotaResetAt,
      // Expose subscription status so the UI can show payment failure banners
      subscriptionStatus: user.subscription?.status ?? null,
      currentPeriodEnd: user.subscription?.currentPeriodEnd ?? null,
      billingInterval,
      // Set by grants (gifts, redeem codes, Founding 100) that have no subscription.
      planExpiresAt: user.planExpiresAt,
      // Usable bonus words (referral rewards, word packs), drawn after the plan allowance.
      bonusWords: bonus.words,
    });
  } catch (err) {
    console.error("[usage] error:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Something went wrong." } },
      { status: 500 }
    );
  }
}
