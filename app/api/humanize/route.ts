// ===========================================================
// POST /api/humanize — Rewrite text with Claude (Anthropic)
//
// Plan gates enforced here, not just in the editor: Free rewrites use the
// Standard tone only (TONE_LOCKED otherwise), and Voice Match needs a usable
// stored profile (`voiceProfileId`, see app/api/voice-profiles/shared.ts).
// ===========================================================

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { humanizeText, type ToneOption, type IntensityLevel } from "@/lib/algorithms/humanizeText";
import { analyzeText, type AnalysisResult } from "@/lib/algorithms/analyzeText";
import { db } from "@/lib/db";
import { ensureUser } from "@/lib/user";
import { checkAndResetQuota, planConfigFor, hasBonusWords, refundWords, reserveWords, type WordPool } from "@/lib/quota";
import { consumeBonusWords } from "@/lib/crm/bonus";
import { checkRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { trackServer } from "@/lib/posthog";
import { getClerkIdFromRequest } from "@/lib/extension-auth";
import { trackDocumentEvent, trackQuotaHit } from "@/lib/crm/hooks";
import { recordEvent } from "@/lib/crm/events";
import { runAfter } from "@/lib/growth/safe";
import { isToneAllowed } from "@/lib/plans";
import { toFingerprint, usableProfileIds, voiceAllowance } from "@/app/api/voice-profiles/shared";

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
    let body: { documentId?: unknown; tone?: unknown; intensity?: unknown; styleFingerprint?: unknown; voiceProfileId?: unknown; language?: unknown; aggressiveHint?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: { code: "INVALID_JSON", message: "Invalid JSON body." } },
        { status: 400 }
      );
    }

    const { documentId, tone, intensity, styleFingerprint, voiceProfileId, language, aggressiveHint } = body;

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

    // 3d. Plan gates: the tone, then the voice profile (both before any charge)
    if (!isToneAllowed(plan.id, toneValue)) {
      return NextResponse.json(
        {
          error: {
            code: "TONE_LOCKED",
            message: "Free rewrites use the Standard tone. Upgrade to Pro for all 5 tones.",
          },
        },
        { status: 403, headers: rlHeaders }
      );
    }

    let voiceFingerprint: Record<string, string> | undefined;
    if (typeof voiceProfileId === "string" && voiceProfileId) {
      const allowance = await voiceAllowance(freshUser.id, plan.id);
      const usable = await usableProfileIds(freshUser.id, allowance.limit);
      if (!usable.has(voiceProfileId)) {
        const exists = await db.voiceProfile.count({ where: { id: voiceProfileId, userId: freshUser.id } });
        return NextResponse.json(
          exists
            ? { error: { code: "VOICE_LOCKED", message: "This voice profile isn't included in your current plan." } }
            : { error: { code: "NOT_FOUND", message: "Voice profile not found." } },
          { status: exists ? 403 : 404, headers: rlHeaders }
        );
      }
      const profile = await db.voiceProfile.findUnique({ where: { id: voiceProfileId }, select: { fingerprint: true } });
      voiceFingerprint = toFingerprint(profile?.fingerprint) ?? undefined;
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

    // 5. Secondary FREE rewrite-count gate (rate of distinct rewrites/day).
    // Bonus words lift it: past the limit, the rewrite is paid from the bonus
    // pool only (step 5b), never from the plan allowance.
    const words = document.wordCount || 0;
    const overRewriteLimit =
      plan.id === "FREE" &&
      plan.rewriteLimit !== -1 &&
      freshUser.rewriteCount >= plan.rewriteLimit;
    const bonusOnly = overRewriteLimit && words > 0 && (await hasBonusWords(freshUser.id, words));
    if (overRewriteLimit && !bonusOnly) {
      runAfter("quota-hit", () => trackQuotaHit(freshUser.id, "humanize_rewrites", plan.id));
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
    // concurrent requests can never both exceed the limit. Plan allowance
    // first, then the bonus pool; `pool` remembers which one paid.
    const pool: WordPool | false = bonusOnly
      ? (await consumeBonusWords(freshUser.id, words)) ? "bonus" : false
      : await reserveWords(freshUser.id, words, plan);
    if (!pool) {
      runAfter("quota-hit", () =>
        trackQuotaHit(freshUser.id, bonusOnly ? "humanize_rewrites" : "humanize_words", plan.id)
      );
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
    // A stored voice wins over a raw fingerprint (kept for older clients, and
    // like Voice Match only on plans that include it).
    const styleData = voiceFingerprint ?? (plan.voiceProfiles > 0 && typeof styleFingerprint === "object" && styleFingerprint !== null
      ? (styleFingerprint as Record<string, string>)
      : undefined);
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
      await refundWords(freshUser.id, words, pool);
      console.error("[humanize] model call failed:", modelErr);
      return NextResponse.json(
        { error: { code: "REWRITE_FAILED", message: "The rewrite could not be completed. Please try again." } },
        { status: 502, headers: rlHeaders }
      );
    }

    // 6b. Guard against an empty/refusal response silently destroying user text
    if (!humanizedText || humanizedText.trim().length === 0) {
      await refundWords(freshUser.id, words, pool);
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
      voice: !!voiceFingerprint,
    });
    runAfter("document-humanized", async () => {
      if (pool === "bonus") {
        await recordEvent({ userId: freshUser.id, type: "bonus_used", props: { words, via: "humanize" } });
      }
      await trackDocumentEvent(freshUser.id, "humanized", { words, plan: plan.id, tone: toneValue });
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
