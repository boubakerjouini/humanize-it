// ===========================================================
// POST /api/v1/humanize — Developer API: Humanize text
// ===========================================================

import { NextResponse } from "next/server";
import { analyzeText } from "@/lib/algorithms/analyzeText";
import { humanizeText, type ToneOption } from "@/lib/algorithms/humanizeText";
import { authenticateApiKey } from "@/lib/api-key-auth";

const VALID_TONES: ToneOption[] = ["standard", "formal", "casual", "academic"];

export async function POST(req: Request) {
  try {
    const authResult = await authenticateApiKey(req);
    if (!authResult) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Invalid or missing API key. Use Authorization: Bearer sk_live_..." } },
        { status: 401 }
      );
    }

    let body: { text?: unknown; tone?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: { code: "INVALID_JSON", message: "Invalid JSON body." } },
        { status: 400 }
      );
    }

    const { text, tone } = body;
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

    const toneValue: ToneOption =
      typeof tone === "string" && VALID_TONES.includes(tone as ToneOption)
        ? (tone as ToneOption)
        : "standard";

    // Run analysis first to feed into humanizer
    const analysisResult = analyzeText(text);
    const { humanizedText, tokensUsed } = await humanizeText(text, toneValue, analysisResult);

    return NextResponse.json({
      humanizedText,
      tokensUsed,
      originalScore: analysisResult.score,
    });
  } catch (err) {
    console.error("[v1/humanize] error:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Something went wrong." } },
      { status: 500 }
    );
  }
}
