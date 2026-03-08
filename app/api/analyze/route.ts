// ===========================================================
// POST /api/analyze — Analyze text for AI patterns
// ===========================================================

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { analyzeText } from "@/lib/algorithms/analyzeText";
import { db } from "@/lib/db";
import { PLANS } from "@/lib/plans";
import { checkAndResetQuota } from "@/lib/quota";
import { trackServer } from "@/lib/posthog";
import { getClerkIdFromRequest } from "@/lib/extension-auth";

export async function POST(req: Request) {
  try {
    // 1. Auth — support both Clerk session and extension Bearer token
    const { userId: clerkSessionId } = await auth();
    const clerkId = getClerkIdFromRequest(req, clerkSessionId ?? null);
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

    // 4. Load user from DB (auto-upsert in case webhook didn't fire)
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

    // 4b. Reset quota if period has expired (daily for FREE, monthly for PRO/TEAM)
    const freshUser = await checkAndResetQuota(user);

    // 5. Check word quota
    const plan = PLANS[freshUser.plan as keyof typeof PLANS] ?? PLANS["FREE"];
    const wordCount = text.split(/\s+/).filter(Boolean).length;

    if (
      plan.wordsLimit !== -1 &&
      freshUser.wordsUsed + wordCount > plan.wordsLimit
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

    // 7. Save document to DB (resilient — analysis works even if DB save fails)
    const title = text.trim().slice(0, 50).replace(/\s+/g, " ");
    let document: { id: string } | null = null;
    try {
      document = await db.document.create({
        data: {
          userId: user.id,
          title,
          originalText: text,
          analysisResult: JSON.parse(JSON.stringify(analysisResult)),
          overallScore: analysisResult.score,
          wordCount: analysisResult.wordCount,
        },
      });
    } catch (dbErr) {
      console.error("[analyze] failed to save document (table may not exist):", dbErr);
    }

    // 8. Increment wordsUsed
    await db.user.update({
      where: { id: user.id },
      data: { wordsUsed: { increment: wordCount } },
    });

    // 9. Track event
    trackServer(clerkId, "text_analyzed", {
      score: analysisResult.score,
      confidence_band: analysisResult.confidenceBand,
      pattern_count: analysisResult.patterns.length,
      word_count: analysisResult.wordCount,
      plan: freshUser.plan,
    });

    // 10. Return response
    return NextResponse.json({
      score: analysisResult.score,
      confidenceBand: analysisResult.confidenceBand,
      patterns: analysisResult.patterns,
      stats: analysisResult.stats,
      wordCount: analysisResult.wordCount,
      documentId: document?.id ?? null,
    });
  } catch (err) {
    console.error("[analyze] error:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Something went wrong." } },
      { status: 500 }
    );
  }
}
