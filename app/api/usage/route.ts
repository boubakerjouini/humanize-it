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

    const user = await db.user.findUnique({ where: { clerkId } });
    if (!user) {
      return NextResponse.json(
        { error: { code: "USER_NOT_FOUND", message: "User not found." } },
        { status: 401 }
      );
    }

    const plan = PLANS[user.plan];

    return NextResponse.json({
      plan: user.plan,
      wordsUsed: user.wordsUsed,
      wordsLimit: plan.wordsLimit,
      rewriteCount: user.rewriteCount,
      rewriteLimit: plan.rewriteLimit,
      quotaResetAt: user.quotaResetAt,
    });
  } catch (err) {
    console.error("[usage] error:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Something went wrong." } },
      { status: 500 }
    );
  }
}
