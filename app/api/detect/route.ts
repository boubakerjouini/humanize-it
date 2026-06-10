// ===========================================================
// POST /api/detect — LLM "deep scan" AI detector (anonymous, capped)
//
// The instant heuristic (analyzeText) runs free & client-side for the live
// preview. This endpoint is the precise second opinion: one low-temperature,
// rubric-guided model call. Anonymous-capable like /api/public/humanize, with
// the same bounded-cost guards — a hard word cap, a per-IP burst limit, and a
// per-IP daily allowance — so it can't be turned into a free LLM proxy.
// ===========================================================

import { NextResponse } from "next/server";
import { deepScanText } from "@/lib/detect-llm";
import { activeProvider } from "@/lib/llm";
import { checkRateLimit, checkDailyLimit, rateLimitHeaders } from "@/lib/rate-limit";

const MAX_CHARS = 6000;
const MAX_WORDS = 1200; // a deep scan reads more than the humanizer rewrites
const MIN_WORDS = 25; // below this the model can't judge reliably
const BURST_PER_MIN = 5; // per IP
const FREE_PER_DAY = 15; // deep scans per IP per day

function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export async function POST(req: Request) {
  if (activeProvider() === "none") {
    return NextResponse.json(
      { error: { code: "AI_NOT_CONFIGURED", message: "Deep scan is temporarily unavailable." } },
      { status: 503 }
    );
  }

  let body: { text?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: { code: "INVALID_JSON", message: "Invalid JSON body." } }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text : "";
  const words = wordCount(text);
  if (words < MIN_WORDS) {
    return NextResponse.json(
      { error: { code: "TEXT_TOO_SHORT", message: `Paste at least ${MIN_WORDS} words for an accurate deep scan.` } },
      { status: 400 }
    );
  }
  if (text.length > MAX_CHARS || words > MAX_WORDS) {
    return NextResponse.json(
      { error: { code: "TEXT_TOO_LONG", message: `Deep scan is limited to ${MAX_WORDS} words per check. Sign up free for longer documents.` } },
      { status: 413 }
    );
  }

  const ip = clientIp(req);
  const burst = await checkRateLimit(`detect:min:${ip}`, BURST_PER_MIN);
  if (!burst.ok) {
    return NextResponse.json(
      { error: { code: "RATE_LIMITED", message: "You're going a bit fast — try again in a few seconds." } },
      { status: 429, headers: { ...rateLimitHeaders(burst), "Retry-After": String(burst.retryAfterSeconds) } }
    );
  }
  const daily = await checkDailyLimit(`detect:day:${ip}`, FREE_PER_DAY);
  if (!daily.ok) {
    return NextResponse.json(
      {
        error: { code: "DAILY_LIMIT_REACHED", message: `You've used your ${FREE_PER_DAY} free deep scans for today. Sign up free for more.` },
        signupCta: true,
      },
      { status: 429, headers: { ...rateLimitHeaders(daily), "Retry-After": String(daily.retryAfterSeconds) } }
    );
  }

  try {
    const result = await deepScanText(text);
    return NextResponse.json(
      { ...result, remainingToday: daily.remaining },
      { headers: rateLimitHeaders(daily) }
    );
  } catch (err) {
    console.error("[detect] deep scan failed:", err);
    return NextResponse.json(
      { error: { code: "DEEP_SCAN_FAILED", message: "The deep scan couldn't be completed. Please try again." } },
      { status: 502 }
    );
  }
}
