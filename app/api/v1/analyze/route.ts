// ===========================================================
// POST /api/v1/analyze — Developer API: Analyze text
// ===========================================================

import { NextResponse } from "next/server";
import { analyzeText } from "@/lib/algorithms/analyzeText";
import { authenticateApiKey } from "@/lib/api-key-auth";

function rateLimitHeaders(auth: { monthlyRequestCount: number; apiRequestsLimit: number; monthlyResetAt: Date }) {
  return {
    "X-RateLimit-Limit": String(auth.apiRequestsLimit),
    "X-RateLimit-Remaining": String(Math.max(0, auth.apiRequestsLimit - auth.monthlyRequestCount)),
    "X-RateLimit-Reset": String(Math.floor(auth.monthlyResetAt.getTime() / 1000)),
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

    // Check if over quota (authenticateApiKey returns null for over-quota, but edge case: just hit limit)
    if (authResult.monthlyRequestCount > authResult.apiRequestsLimit) {
      return NextResponse.json(
        { error: { code: "QUOTA_EXCEEDED", message: "Monthly API request quota exceeded." } },
        { status: 429, headers: { ...headers, "Retry-After": String(Math.floor((authResult.monthlyResetAt.getTime() - Date.now()) / 1000)) } }
      );
    }

    let body: { text?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: { code: "INVALID_JSON", message: "Invalid JSON body." } },
        { status: 400, headers }
      );
    }

    const text = body.text;
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

    const result = analyzeText(text);

    return NextResponse.json({
      score: result.score,
      confidenceBand: result.confidenceBand,
      patterns: result.patterns,
      stats: result.stats,
      wordCount: result.wordCount,
    }, { headers });
  } catch (err) {
    console.error("[v1/analyze] error:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Something went wrong." } },
      { status: 500 }
    );
  }
}
