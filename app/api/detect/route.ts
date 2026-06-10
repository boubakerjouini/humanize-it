// ===========================================================
// POST /api/detect — LLM "deep scan" AI detector (anonymous, capped)
//
// The instant heuristic (analyzeText) runs free & client-side for the live
// preview. This endpoint is the precise second opinion: one low-temperature,
// rubric-guided model call. Anonymous-capable like /api/public/humanize, with
// the same bounded-cost guards — a hard word cap, a per-IP burst limit, and a
// per-IP daily allowance — so it can't be turned into a free LLM proxy.
// ===========================================================

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { deepScanText } from "@/lib/detect-llm";
import { activeProvider } from "@/lib/llm";
import { ensureUser } from "@/lib/user";
import { checkRateLimit, checkDailyLimit, rateLimitHeaders } from "@/lib/rate-limit";

const MAX_CHARS = 6000;
const MAX_WORDS = 1200; // a deep scan reads more than the humanizer rewrites
const MIN_WORDS = 25; // below this the model can't judge reliably

// Anonymous (public detector tool) — bounded per IP.
const ANON_BURST_PER_MIN = 5;
const ANON_PER_DAY = 15;

// Signed-in (dashboard editor) — bounded per user, generous for paid plans.
const USER_BURST_PER_MIN = 10;
const USER_PER_DAY: Record<string, number> = { FREE: 20, PRO: 200, TEAM: 200 };

function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Resolve the signed-in user (if any). /api/detect is anonymous-capable, so a
 *  missing/bypassed Clerk session is normal — fall through to the IP path. */
async function currentUser(): Promise<{ id: string; plan: string } | null> {
  try {
    const { userId } = await auth();
    if (!userId) return null;
    const u = await ensureUser(userId);
    return { id: u.id, plan: u.plan };
  } catch {
    return null;
  }
}

/** Apply burst + daily limits scoped to the signed-in user or the IP. Returns
 *  the daily result (for headers/remaining) or a 429 NextResponse to return. */
async function enforceLimits(req: Request): Promise<
  | { ok: true; daily: Awaited<ReturnType<typeof checkDailyLimit>> }
  | { ok: false; response: NextResponse }
> {
  const user = await currentUser();
  const scope = user ? `user:${user.id}` : `ip:${clientIp(req)}`;
  const burstLimit = user ? USER_BURST_PER_MIN : ANON_BURST_PER_MIN;
  const dailyLimit = user ? (USER_PER_DAY[user.plan] ?? USER_PER_DAY.FREE) : ANON_PER_DAY;

  const burst = await checkRateLimit(`detect:min:${scope}`, burstLimit);
  if (!burst.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: { code: "RATE_LIMITED", message: "You're going a bit fast — try again in a few seconds." } },
        { status: 429, headers: { ...rateLimitHeaders(burst), "Retry-After": String(burst.retryAfterSeconds) } }
      ),
    };
  }
  const daily = await checkDailyLimit(`detect:day:${scope}`, dailyLimit);
  if (!daily.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: { code: "DAILY_LIMIT_REACHED", message: `You've used your ${dailyLimit} deep scans for today.${user ? "" : " Sign up free for more."}` },
          signupCta: !user,
        },
        { status: 429, headers: { ...rateLimitHeaders(daily), "Retry-After": String(daily.retryAfterSeconds) } }
      ),
    };
  }
  return { ok: true, daily };
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

  const limited = await enforceLimits(req);
  if (!limited.ok) return limited.response;
  const { daily } = limited;

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
