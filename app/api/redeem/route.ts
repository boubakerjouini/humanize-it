// ===========================================================
// POST /api/redeem — Redeem a discount code
// ===========================================================

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const PLAN_WORDS_LIMIT: Record<string, number> = {
  PRO: 50_000,
  TEAM: 200_000,
};

export async function POST(req: Request) {
  try {
    // 1. Auth
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Authentication required." } },
        { status: 401 }
      );
    }

    // 2. Parse body
    let body: { code?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: { code: "INVALID_JSON", message: "Invalid JSON body." } },
        { status: 400 }
      );
    }

    const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : null;
    if (!code) {
      return NextResponse.json(
        { error: { code: "INVALID_INPUT", message: "Code is required." } },
        { status: 400 }
      );
    }

    // 3. Load or create user
    const user = await db.user.upsert({
      where: { clerkId },
      update: {},
      create: {
        clerkId,
        email: `${clerkId}@placeholder.humanize-it.app`,
        plan: "FREE",
        wordsUsed: 0,
      },
    });

    // 4. Find discount code (case-insensitive already handled by toUpperCase)
    const discountCode = await db.discountCode.findUnique({
      where: { code },
    });

    if (!discountCode) {
      return NextResponse.json(
        { error: { code: "CODE_NOT_FOUND", message: "Invalid discount code." } },
        { status: 404 }
      );
    }

    // 5. Check expiry
    if (discountCode.expiresAt && discountCode.expiresAt < new Date()) {
      return NextResponse.json(
        { error: { code: "CODE_EXPIRED", message: "This discount code has expired." } },
        { status: 410 }
      );
    }

    // 6. Check usage limit
    if (discountCode.usedCount >= discountCode.maxUses) {
      return NextResponse.json(
        { error: { code: "CODE_EXHAUSTED", message: "This discount code has already been used." } },
        { status: 410 }
      );
    }

    // 7. Check if user already redeemed this code
    const existing = await db.redemption.findUnique({
      where: { userId_discountCodeId: { userId: user.id, discountCodeId: discountCode.id } },
    });
    if (existing) {
      return NextResponse.json(
        { error: { code: "ALREADY_REDEEMED", message: "You have already redeemed this code." } },
        { status: 409 }
      );
    }

    // 8. Apply plan upgrade + create redemption record (in a transaction)
    const newPlan = discountCode.plan as "PRO" | "TEAM";
    const newWordsLimit = PLAN_WORDS_LIMIT[newPlan] ?? 50_000;

    await db.$transaction([
      db.user.update({
        where: { id: user.id },
        data: { plan: newPlan },
      }),
      db.discountCode.update({
        where: { id: discountCode.id },
        data: { usedCount: { increment: 1 } },
      }),
      db.redemption.create({
        data: {
          userId: user.id,
          discountCodeId: discountCode.id,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      plan: newPlan,
      wordsLimit: newWordsLimit,
    });
  } catch (err) {
    console.error("[redeem] error:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Something went wrong." } },
      { status: 500 }
    );
  }
}
