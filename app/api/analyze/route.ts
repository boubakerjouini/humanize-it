// ===========================================================
// POST /api/analyze — Analyze text for AI patterns
// ===========================================================

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { analyzeText } from "@/lib/algorithms/analyzeText";
import { db } from "@/lib/db";
import { ensureUser } from "@/lib/user";
import { checkAndResetQuota, planConfigFor, consumeWordQuota } from "@/lib/quota";
import { checkRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { trackServer } from "@/lib/posthog";
import { getClerkIdFromRequest } from "@/lib/extension-auth";

export async function POST(req: Request) {
  try {
    // 1. Auth — support both Clerk session and extension Bearer token
    // Note: /api/analyze is in publicRoutes so Clerk middleware is bypassed.
    // In @clerk/nextjs v6, calling auth() without middleware processing throws
    // instead of returning { userId: null }. Wrap in try/catch to handle this.
    let clerkSessionId: string | null = null;
    try {
      const authResult = await auth();
      clerkSessionId = authResult.userId;
    } catch {
      // Clerk middleware bypassed for this route — treat as unauthenticated
      clerkSessionId = null;
    }
    const clerkId = getClerkIdFromRequest(req, clerkSessionId);
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

    // 4. Load user from DB (lazily create with the real Clerk email; lib/user.ts)
    let user;
    try {
      user = await ensureUser(clerkId);
    } catch (dbErr) {
      console.error("[analyze] DB connection/query failed on user upsert:", dbErr);
      const message =
        dbErr instanceof Error && dbErr.message.includes("connect")
          ? "Database connection failed. Please try again later."
          : "Failed to load user data.";
      return NextResponse.json(
        { error: { code: "DB_ERROR", message } },
        { status: 503 }
      );
    }

    // 4b. Reset quota if period has expired (daily for FREE, monthly for PRO/TEAM)
    let freshUser;
    try {
      freshUser = await checkAndResetQuota(user);
    } catch (dbErr) {
      console.error("[analyze] quota reset failed:", dbErr);
      freshUser = user; // continue with stale quota rather than failing
    }

    // 5. Resolve plan, rate-limit, then atomically reserve the word quota
    const plan = planConfigFor(freshUser);
    const wordCount = text.split(/\s+/).filter(Boolean).length;

    const rl = await checkRateLimit(`analyze:${freshUser.id}`, plan.rateLimit);
    const rlHeaders = rateLimitHeaders(rl);
    if (!rl.ok) {
      return NextResponse.json(
        { error: { code: "RATE_LIMITED", message: "Too many requests. Please slow down." } },
        { status: 429, headers: { ...rlHeaders, "Retry-After": String(rl.retryAfterSeconds) } }
      );
    }

    const reserved = await consumeWordQuota(freshUser.id, wordCount, plan);
    if (!reserved) {
      return NextResponse.json(
        {
          error: {
            code: "QUOTA_EXCEEDED",
            message: `You have reached your ${plan.wordsLimitPeriod}ly analysis limit. Upgrade to Pro for more.`,
          },
        },
        { status: 402, headers: rlHeaders }
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

    // 8. (Word quota was already atomically reserved in step 5.)

    // 9. Track event
    trackServer(clerkId, "text_analyzed", {
      score: analysisResult.score,
      confidence_band: analysisResult.confidenceBand,
      pattern_count: analysisResult.patterns.length,
      word_count: analysisResult.wordCount,
      plan: freshUser.plan,
    });

    // 10. Return response
    return NextResponse.json(
      {
        score: analysisResult.score,
        confidenceBand: analysisResult.confidenceBand,
        patterns: analysisResult.patterns,
        stats: analysisResult.stats,
        wordCount: analysisResult.wordCount,
        documentId: document?.id ?? null,
      },
      { headers: rlHeaders }
    );
  } catch (err) {
    console.error("[analyze] error:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Something went wrong." } },
      { status: 500 }
    );
  }
}
