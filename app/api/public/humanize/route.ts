// ===========================================================
// POST /api/public/humanize — anonymous, no-signup humanizer (capped)
//
// Powers the free /free-ai-humanizer tool page. NO auth, NO user quota. Cost
// and abuse are bounded by: a hard per-request word cap, a per-IP burst limit
// (per minute), and a small per-IP daily limit. Real users who want more are
// pushed to sign up. This is the only place anonymous LLM calls are allowed.
// ===========================================================

import { NextResponse } from "next/server";
import { analyzeText } from "@/lib/algorithms/analyzeText";
import { humanizeText, type ToneOption, type IntensityLevel } from "@/lib/algorithms/humanizeText";
import { activeProvider } from "@/lib/llm";
import { checkRateLimit, checkDailyLimit, rateLimitHeaders } from "@/lib/rate-limit";

// ── Caps (deliberately tight — this is a free, anonymous funnel) ──
const MAX_CHARS = 2500;
const MAX_WORDS = 300; // per request
const BURST_PER_MIN = 4; // per IP
const FREE_PER_DAY = 2; // rewrites per IP per day

const VALID_TONES: ToneOption[] = ["standard", "formal", "casual", "academic", "storytelling", "professional"];
const VALID_INTENSITIES: IntensityLevel[] = ["light", "medium", "heavy"];

/** Best-effort client IP from proxy headers (Vercel sets x-forwarded-for). */
function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export async function POST(req: Request) {
  // 0. Provider configured?
  if (activeProvider() === "none") {
    return NextResponse.json(
      { error: { code: "AI_NOT_CONFIGURED", message: "The humanizer is temporarily unavailable." } },
      { status: 503 }
    );
  }

  // 1. Parse + validate input
  let body: { text?: unknown; tone?: unknown; intensity?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: { code: "INVALID_JSON", message: "Invalid JSON body." } }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text : "";
  if (text.trim().length < 10) {
    return NextResponse.json(
      { error: { code: "TEXT_TOO_SHORT", message: "Paste at least a sentence or two to humanize." } },
      { status: 400 }
    );
  }
  if (text.length > MAX_CHARS || wordCount(text) > MAX_WORDS) {
    return NextResponse.json(
      {
        error: {
          code: "TEXT_TOO_LONG",
          message: `The free humanizer is limited to ${MAX_WORDS} words. Sign up free to humanize longer text.`,
        },
      },
      { status: 413 }
    );
  }

  const tone: ToneOption =
    typeof body.tone === "string" && VALID_TONES.includes(body.tone as ToneOption)
      ? (body.tone as ToneOption)
      : "standard";
  const intensity: IntensityLevel =
    typeof body.intensity === "string" && VALID_INTENSITIES.includes(body.intensity as IntensityLevel)
      ? (body.intensity as IntensityLevel)
      : "medium";

  // 2. Rate limits — burst (per minute) then the daily free allowance.
  const ip = clientIp(req);
  const burst = await checkRateLimit(`pub:hz:min:${ip}`, BURST_PER_MIN);
  if (!burst.ok) {
    return NextResponse.json(
      { error: { code: "RATE_LIMITED", message: "You're going a bit fast — try again in a few seconds." } },
      { status: 429, headers: { ...rateLimitHeaders(burst), "Retry-After": String(burst.retryAfterSeconds) } }
    );
  }
  // Increment-on-check: a failed humanize still consumes one daily attempt,
  // which also blunts retry-spam abuse on the free tier.
  const daily = await checkDailyLimit(`pub:hz:day:${ip}`, FREE_PER_DAY);
  if (!daily.ok) {
    return NextResponse.json(
      {
        error: {
          code: "DAILY_LIMIT_REACHED",
          message: `You've used your ${FREE_PER_DAY} free rewrites for today. Sign up free for more.`,
        },
        signupCta: true,
      },
      { status: 429, headers: { ...rateLimitHeaders(daily), "Retry-After": String(daily.retryAfterSeconds) } }
    );
  }

  // 3. Analyze → humanize → re-score (analyzeText is local + free)
  const before = analyzeText(text);
  let humanizedText = "";
  let model = "";
  try {
    const result = await humanizeText(text, tone, before, intensity);
    humanizedText = result.humanizedText;
    model = result.model;
  } catch (err) {
    console.error("[public/humanize] model call failed:", err);
    return NextResponse.json(
      { error: { code: "REWRITE_FAILED", message: "The rewrite couldn't be completed. Please try again." } },
      { status: 502 }
    );
  }

  if (!humanizedText || humanizedText.trim().length === 0) {
    return NextResponse.json(
      { error: { code: "EMPTY_RESULT", message: "The rewrite returned no usable text. Your original is unchanged." } },
      { status: 502 }
    );
  }

  const after = analyzeText(humanizedText);
  return NextResponse.json(
    {
      humanizedText,
      beforeScore: before.score,
      afterScore: after.score,
      model,
      remainingToday: daily.remaining,
    },
    { headers: rateLimitHeaders(daily) }
  );
}
