// ===========================================================
// GET /api/v1/usage — Developer API: Current quota usage
// ===========================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { PLANS, type PlanId } from "@/lib/plans";
import { authenticateApiKey } from "@/lib/api-key-auth";

export async function GET(req: Request) {
  try {
    const authResult = await authenticateApiKey(req);
    if (!authResult) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Invalid or missing API key. Use Authorization: Bearer sk_live_..." } },
        { status: 401 }
      );
    }

    const headers = {
      "X-RateLimit-Limit": String(authResult.apiRequestsLimit),
      "X-RateLimit-Remaining": String(Math.max(0, authResult.apiRequestsLimit - authResult.monthlyRequestCount)),
      "X-RateLimit-Reset": String(Math.floor(authResult.monthlyResetAt.getTime() / 1000)),
    };

    const user = await db.user.findUnique({
      where: { id: authResult.userId },
    });

    if (!user) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "User not found." } },
        { status: 404, headers }
      );
    }

    const plan = PLANS[(user.plan as PlanId) ?? "FREE"];

    return NextResponse.json({
      plan: user.plan,
      wordsUsed: user.wordsUsed,
      wordsLimit: plan.wordsLimit,
      apiRequestsUsed: authResult.monthlyRequestCount,
      apiRequestsLimit: plan.apiRequestsLimit,
      monthlyResetAt: authResult.monthlyResetAt,
    }, { headers });
  } catch (err) {
    console.error("[v1/usage] error:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Something went wrong." } },
      { status: 500 }
    );
  }
}
