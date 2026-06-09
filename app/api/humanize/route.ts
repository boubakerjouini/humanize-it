// ===========================================================
// POST /api/humanize — Rewrite text with Claude (Anthropic)
// ===========================================================

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { humanizeText, type ToneOption, type IntensityLevel } from "@/lib/algorithms/humanizeText";
import { analyzeText, type AnalysisResult } from "@/lib/algorithms/analyzeText";
import { db } from "@/lib/db";
import { ensureUser } from "@/lib/user";
import { checkAndResetQuota, planConfigFor, consumeWordQuota, refundWordQuota } from "@/lib/quota";
import { checkRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { trackServer } from "@/lib/posthog";
import { getClerkIdFromRequest } from "@/lib/extension-auth";

const VALID_TONES: ToneOption[] = ["standard", "formal", "casual", "academic", "storytelling", "professional"];

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
    let body: { documentId?: unknown; tone?: unknown; intensity?: unknown; styleFingerprint?: unknown; language?: unknown; aggressiveHint?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: { code: "INVALID_JSON", message: "Invalid JSON body." } },
        { status: 400 }
      );
    }

    const { documentId, tone, intensity, styleFingerprint, language, aggressiveHint } = body;

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

    const VALID_INTENSITIES: IntensityLevel[] = ["light", "medium", "heavy"];
    const intensityValue: IntensityLevel =
      typeof intensity === "string" && VALID_INTENSITIES.includes(intensity as IntensityLevel)
        ? (intensity as IntensityLevel)
        : "medium";

    // 3. Load user (lazily create with the real Clerk email; see lib/user.ts)
    const user = await ensureUser(clerkId);

    // 3b. Reset quota / downgrade lapsed grants if needed, then resolve plan
    const freshUser = await checkAndResetQuota(user);
    const plan = planConfigFor(freshUser);

    // 3c. Rate limit (per user / per minute) on this Anthropic-backed endpoint
    const rl = await checkRateLimit(`humanize:${freshUser.id}`, plan.rateLimit);
    const rlHeaders = rateLimitHeaders(rl);
    if (!rl.ok) {
      return NextResponse.json(
        { error: { code: "RATE_LIMITED", message: "Too many requests. Please slow down." } },
        { status: 429, headers: { ...rlHeaders, "Retry-After": String(rl.retryAfterSeconds) } }
      );
    }

    // 4. Load document and verify ownership
    const document = await db.document.findUnique({
      where: { id: documentId },
    });

    if (!document || document.userId !== freshUser.id) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Document not found." } },
        { status: 404, headers: rlHeaders }
      );
    }

    // 5. Secondary FREE rewrite-count gate (rate of distinct rewrites/day)
    if (
      plan.id === "FREE" &&
      plan.rewriteLimit !== -1 &&
      freshUser.rewriteCount >= plan.rewriteLimit
    ) {
      return NextResponse.json(
        {
          error: {
            code: "QUOTA_EXCEEDED",
            message: "You have reached your daily rewrite limit. Upgrade to Pro for more.",
          },
        },
        { status: 402, headers: rlHeaders }
      );
    }

    // 5b. Atomically reserve the word quota for ALL plans (the real cost gate
    // on the expensive Claude path). Reserve before calling the model so two
    // concurrent requests can never both exceed the limit.
    const words = document.wordCount || 0;
    const reserved = await consumeWordQuota(freshUser.id, words, plan);
    if (!reserved) {
      return NextResponse.json(
        {
          error: {
            code: "QUOTA_EXCEEDED",
            message: `You've used your ${plan.wordsLimitPeriod}ly word allowance. Upgrade for more.`,
          },
        },
        { status: 402, headers: rlHeaders }
      );
    }

    // 6. Call humanizeText() — refund the reserved words on any failure
    const analysisResult = document.analysisResult as unknown as AnalysisResult;
    const styleData = typeof styleFingerprint === "object" && styleFingerprint !== null
      ? (styleFingerprint as Record<string, string>)
      : undefined;
    const langValue = typeof language === "string" && language ? language : undefined;
    const hintValue = typeof aggressiveHint === "string" ? aggressiveHint : undefined;

    let humanizedText: string;
    let tokensUsed: number;
    let modelUsed = "";
    try {
      const result = await humanizeText(
        document.originalText,
        toneValue,
        analysisResult,
        intensityValue,
        styleData,
        langValue,
        hintValue
      );
      humanizedText = result.humanizedText;
      tokensUsed = result.tokensUsed;
      modelUsed = result.model;
    } catch (modelErr) {
      await refundWordQuota(freshUser.id, words);
      console.error("[humanize] model call failed:", modelErr);
      return NextResponse.json(
        { error: { code: "REWRITE_FAILED", message: "The rewrite could not be completed. Please try again." } },
        { status: 502, headers: rlHeaders }
      );
    }

    // 6b. Guard against an empty/refusal response silently destroying user text
    if (!humanizedText || humanizedText.trim().length === 0) {
      await refundWordQuota(freshUser.id, words);
      return NextResponse.json(
        { error: { code: "EMPTY_RESULT", message: "The rewrite returned no usable text. Your original is unchanged." } },
        { status: 502, headers: rlHeaders }
      );
    }

    // 7. Score the humanized text and update document
    const humanizedAnalysis = analyzeText(humanizedText);
    try {
      await db.document.update({
        where: { id: document.id },
        data: {
          rewrittenText: humanizedText,
          rewriteModel: modelUsed || "unknown",
          tone: toneValue,
          humanizedScore: humanizedAnalysis.score,
        },
      });
    } catch (dbErr) {
      console.error("[humanize] failed to update document (table may not exist):", dbErr);
    }

    // 8. Increment rewriteCount for FREE users (daily rewrite-rate counter)
    if (plan.id === "FREE") {
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
      plan: plan.id,
    });

    // 10. Return
    return NextResponse.json(
      {
        humanizedText,
        tokensUsed,
        documentId: document.id,
      },
      { headers: rlHeaders }
    );
  } catch (err) {
    console.error("[humanize] error:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Something went wrong." } },
      { status: 500 }
    );
  }
}
