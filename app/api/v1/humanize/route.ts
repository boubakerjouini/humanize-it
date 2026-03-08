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

    let body: { text?: unknown; tone?: unknown; intensity?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: { code: "INVALID_JSON", message: "Invalid JSON body." } },
        { status: 400, headers }
      );
    }

    const { text, tone, intensity } = body;
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

    const analysisResult = analyzeText(text);
    const { humanizedText, tokensUsed } = await humanizeText(text, toneValue, analysisResult, intensityValue);
    const humanizedAnalysis = analyzeText(humanizedText);

    return NextResponse.json({
      humanizedText,
      originalScore: Math.round(analysisResult.score),
      humanizedScore: Math.round(humanizedAnalysis.score),
      scoreDelta: Math.round(analysisResult.score - humanizedAnalysis.score),
      confidenceBand: humanizedAnalysis.confidenceBand,
      tokensUsed,
    }, { headers });
  } catch (err) {
    console.error("[v1/humanize] error:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Something went wrong." } },
      { status: 500 }
    );
  }
}
