// ===========================================================
// POST /api/v1/humanize — Developer API: Humanize text
// ===========================================================

import { NextResponse } from "next/server";
import { analyzeText } from "@/lib/algorithms/analyzeText";
import { humanizeText, type ToneOption } from "@/lib/algorithms/humanizeText";
import { authenticateApiKey } from "@/lib/api-key-auth";

const VALID_TONES: ToneOption[] = ["standard", "formal", "casual", "academic", "storytelling", "professional"];

function rateLimitHeaders(auth: { monthlyRequestCount: number; apiRequestsLimit: number; monthlyResetAt: Date }) {
  return {
    "X-RateLimit-Limit": String(auth.apiRequestsLimit),
    "X-RateLimit-Remaining": String(Math.max(0, auth.apiRequestsLimit - auth.monthlyRequestCount)),
    "X-RateLimit-Reset": String(auth.monthlyResetAt.getTime()), // ms timestamp
  };
}

export async function POST(req: Request) {
  try {
    const authResult = await authenticateApiKey(req);
    if (!authResult) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Invalid or missing API key. Use Authorization: Bearer sk_live_..." } },
        { status: 401 }
      );
    }

    const headers = rateLimitHeaders(authResult);

    if (authResult.monthlyRequestCount > authResult.apiRequestsLimit) {
      return NextResponse.json(
        { error: { code: "QUOTA_EXCEEDED", message: "Monthly API request quota exceeded." } },
        { status: 429, headers: { ...headers, "Retry-After": String(Math.floor((authResult.monthlyResetAt.getTime() - Date.now()) / 1000)) } }
      );
    }

    let body: { text?: unknown; tone?: unknown; intensity?: unknown; passes?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: { code: "INVALID_JSON", message: "Invalid JSON body." } },
        { status: 400, headers }
      );
    }

    const { text, tone, intensity, passes } = body;
    if (typeof text !== "string" || text.length <= 10) {
      return NextResponse.json(
        { error: { code: "TEXT_TOO_SHORT", message: "Text must be at least 10 characters." } },
        { status: 400, headers }
      );
    }
    if (text.length > 10000) {
      return NextResponse.json(
        { error: { code: "TEXT_TOO_LONG", message: "Text must be at most 10,000 characters." } },
        { status: 400, headers }
      );
    }

    const toneValue: ToneOption =
      typeof tone === "string" && VALID_TONES.includes(tone as ToneOption)
        ? (tone as ToneOption)
        : "standard";

    const validIntensities = ["light", "medium", "heavy"] as const;
    const intensityValue = typeof intensity === "string" && validIntensities.includes(intensity as typeof validIntensities[number])
      ? (intensity as typeof validIntensities[number])
      : "medium";

    const maxPasses = typeof passes === "number" && passes >= 1 && passes <= 3 ? Math.floor(passes) : 1;
    const SCORE_THRESHOLD = 45;

    const analysisResult = analyzeText(text);
    let currentText = text;
    let currentAnalysis = analysisResult;
    let totalTokens = 0;
    const scoreHistory: number[] = [];
    let passesRun = 0;

    for (let p = 0; p < maxPasses; p++) {
      const passIntensity = p === 0 ? intensityValue : "heavy";
      const aggressiveHint = p >= 2
        ? "The text still shows AI patterns. Be more aggressive in varying sentence structure, vocabulary, and style."
        : undefined;

      const { humanizedText: passText, tokensUsed: passTokens } = await humanizeText(
        currentText, toneValue, currentAnalysis, passIntensity, undefined, undefined, aggressiveHint
      );
      totalTokens += passTokens;
      passesRun++;

      const passAnalysis = analyzeText(passText);
      scoreHistory.push(Math.round(passAnalysis.score));
      currentText = passText;
      currentAnalysis = passAnalysis;

      // Stop early if score is good enough
      if (passAnalysis.score < SCORE_THRESHOLD) break;
    }

    return NextResponse.json({
      humanizedText: currentText,
      originalScore: Math.round(analysisResult.score),
      humanizedScore: Math.round(currentAnalysis.score),
      scoreDelta: Math.round(analysisResult.score - currentAnalysis.score),
      confidenceBand: currentAnalysis.confidenceBand,
      tokensUsed: totalTokens,
      passes_run: passesRun,
      score_history: [Math.round(analysisResult.score), ...scoreHistory],
    }, { headers });
  } catch (err) {
    console.error("[v1/humanize] error:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Something went wrong." } },
      { status: 500 }
    );
  }
}
