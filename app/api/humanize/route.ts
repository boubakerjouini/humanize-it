// ===========================================================
// POST /api/humanize — Rewrite text with Claude (Anthropic)
// ===========================================================

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { humanizeText, type ToneOption } from "@/lib/algorithms/humanizeText";
import type { AnalysisResult } from "@/lib/algorithms/analyzeText";
import { db } from "@/lib/db";
import { PLANS } from "@/lib/plans";
import { checkAndResetQuota } from "@/lib/quota";
import { trackServer } from "@/lib/posthog";
import { getClerkIdFromRequest } from "@/lib/extension-auth";

const VALID_TONES: ToneOption[] = ["standard", "formal", "casual", "academic"];

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
    let body: { documentId?: unknown; tone?: unknown; styleFingerprint?: unknown; language?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: { code: "INVALID_JSON", message: "Invalid JSON body." } },
        { status: 400 }
      );
    }

    const { documentId, tone, styleFingerprint, language } = body;

    if (typeof documentId !== "string" || !documentId) {
      return NextResponse.json(
        { error: { code: "INVALID_INPUT", message: "documentId is required." } },
        { status: 400 }
      );
    }

    const toneValue: ToneOption =
      typeof tone === "string" && VALID_TONES.includes(tone as ToneOption)
        ? (tone as ToneOption)
        : "standard";

    // 3. Load user (auto-upsert in case webhook didn't fire)
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

    // 3b. Reset quota if period has expired
    const freshUser = await checkAndResetQuota(user);

    // 4. Load document and verify ownership
    const document = await db.document.findUnique({
      where: { id: documentId },
    });

    if (!document || document.userId !== freshUser.id) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Document not found." } },
        { status: 404 }
      );
    }

    // 5. Check rewrite quota for FREE plan
    const plan = PLANS[freshUser.plan as keyof typeof PLANS] ?? PLANS["FREE"];
    if (
      freshUser.plan === "FREE" &&
      plan.rewriteLimit !== -1 &&
      freshUser.rewriteCount >= plan.rewriteLimit
    ) {
      return NextResponse.json(
        {
          error: {
            code: "QUOTA_EXCEEDED",
            message:
              "You have reached your rewrite limit. Upgrade to Pro for unlimited rewrites.",
          },
        },
        { status: 402 }
      );
    }

    // 6. Call humanizeText()
    const analysisResult = document.analysisResult as unknown as AnalysisResult;
    const styleData = typeof styleFingerprint === "object" && styleFingerprint !== null
      ? (styleFingerprint as Record<string, string>)
      : undefined;
    const langValue = typeof language === "string" && language ? language : undefined;
    const { humanizedText, tokensUsed } = await humanizeText(
      document.originalText,
      toneValue,
      analysisResult,
      styleData,
      langValue
    );

    // 7. Update document with rewritten text
    await db.document.update({
      where: { id: document.id },
      data: {
        rewrittenText: humanizedText,
        rewriteModel: "claude-sonnet-4-5",
      },
    });

    // 8. Increment rewriteCount for FREE users
    if (freshUser.plan === "FREE") {
      await db.user.update({
        where: { id: freshUser.id },
        data: { rewriteCount: { increment: 1 } },
      });
    }

    // 9. Track event
    trackServer(clerkId, "text_humanized", {
      tone: toneValue,
      tokens_used: tokensUsed,
      word_count: document.wordCount,
      plan: freshUser.plan,
    });

    // 10. Return
    return NextResponse.json({
      humanizedText,
      tokensUsed,
      documentId: document.id,
    });
  } catch (err) {
    console.error("[humanize] error:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Something went wrong." } },
      { status: 500 }
    );
  }
}
