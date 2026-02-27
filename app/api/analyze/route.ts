// ===========================================================
// POST /api/analyze — Analyze text for AI patterns
// ===========================================================

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { analyzeText } from "@/lib/algorithms/analyzeText";
import { db } from "@/lib/db";
import { PLANS } from "@/lib/plans";

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
    let body: { text?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: { code: "INVALID_JSON", message: "Invalid JSON body." } },
        { status: 400 }
      );
    }

    const text = body.text;

    // 3. Validate
    if (typeof text !== "string" || text.length <= 10) {
      return NextResponse.json(
        { error: { code: "TEXT_TOO_SHORT", message: "Text must be at least 10 characters." } },
        { status: 400 }
      );
    }

    if (text.length > 10000) {
      return NextResponse.json(
        { error: { code: "TEXT_TOO_LONG", message: "Text must be at most 10,000 characters." } },
        { status: 400 }
      );
    }

    // 4. Load user from DB
    const user = await db.user.findUnique({ where: { clerkId } });
    if (!user) {
      return NextResponse.json(
        { error: { code: "USER_NOT_FOUND", message: "User record not found." } },
        { status: 401 }
      );
    }

    // 5. Check word quota
    const plan = PLANS[user.plan];
    const wordCount = text.split(/\s+/).filter(Boolean).length;

    if (
      plan.wordsLimit !== -1 &&
      user.wordsUsed + wordCount > plan.wordsLimit
    ) {
      return NextResponse.json(
        {
          error: {
            code: "QUOTA_EXCEEDED",
            message: `You have reached your ${plan.wordsLimitPeriod}ly analysis limit. Upgrade to Pro for more.`,
          },
        },
        { status: 402 }
      );
    }

    // 6. Run analysis (pure local — no AI call)
    const analysisResult = analyzeText(text);

    // 7. Save document to DB
    const document = await db.document.create({
      data: {
        userId: user.id,
        originalText: text,
        analysisResult: JSON.parse(JSON.stringify(analysisResult)),
        overallScore: analysisResult.score,
        wordCount: analysisResult.wordCount,
      },
    });

    // 8. Increment wordsUsed
    await db.user.update({
      where: { id: user.id },
      data: { wordsUsed: { increment: wordCount } },
    });

    // 9. Return response
    return NextResponse.json({
      score: analysisResult.score,
      patterns: analysisResult.patterns,
      stats: analysisResult.stats,
      wordCount: analysisResult.wordCount,
      documentId: document.id,
    });
  } catch (err) {
    console.error("[analyze] error:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Something went wrong." } },
      { status: 500 }
    );
  }
}
