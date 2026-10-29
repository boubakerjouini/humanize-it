// ===========================================================
// POST /api/detect — LLM "deep scan" AI detector (anonymous, capped)
//
// The instant heuristic (analyzeText) runs free & client-side for the live
// preview. This endpoint is the precise second opinion: one low-temperature,
// rubric-guided model call. Anonymous-capable like /api/public/humanize, with
// the same bounded-cost guards — a hard word cap, a per-IP burst limit, and a
// per-IP daily allowance — so it can't be turned into a free LLM proxy.
// A finished scan is counted in PostHog (deep_scan_completed) under a fresh id
// per scan, with no person profile and never the text, and as a ToolRun row
// (lib/growth/tool-runs.ts) with the page it ran on, for the admin view.
// Signed-in callers are bounded per account by their effective plan (a lapsed
// gift counts as Free) and, for Free accounts, by one shared daily ceiling, so
// signing up many free accounts can't multiply the model bill either.
// ===========================================================

import { randomUUID } from "node:crypto";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { deepScanText } from "@/lib/detect-llm";
import { activeProvider } from "@/lib/llm";
import { ensureUser } from "@/lib/user";
import { effectivePlanId } from "@/lib/quota";
import { checkRateLimit, checkDailyLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { clientIp, ipBucket } from "@/lib/client-ip";
import { touchEventProps } from "@/lib/growth/attribution";
import { firstTouchOf, readAttribution } from "@/lib/growth/attribution-server";
import { runAfter } from "@/lib/growth/safe";
import { trackServer } from "@/lib/posthog";
import { cleanToolPage, recordToolRun, refererPage, toolRunSource } from "@/lib/growth/tool-runs";

const MAX_CHARS = 9000; // ~1200 words of English; 6000 refused ~1000-word texts with a "1200 words" message
const MAX_WORDS = 1200; // a deep scan reads more than the humanizer rewrites
const MIN_WORDS = 25; // below this the model can't judge reliably

// Anonymous (public detector tool) — bounded per IP.
const ANON_BURST_PER_MIN = 5;
const ANON_PER_DAY = 15;
// All anonymous scans, every IP together: caps the bill when many addresses
// are rotated against the tool. Far above real volume.
const ALL_ANON_PER_DAY = 1500;

// Signed-in (dashboard editor) — bounded per user, generous for paid plans.
// One scan costs about $0.006 (scripts/detector-deepscan-eval.ts), so a Pro
// account maxing out every day costs about $18/month, double the plan price;
// real use is a handful a day.
const USER_BURST_PER_MIN = 10;
const USER_PER_DAY: Record<string, number> = { FREE: 20, PRO: 100, TEAM: 100 };
// All Free accounts together, like ALL_ANON_PER_DAY for anonymous callers.
const ALL_FREE_PER_DAY = 1000;

// The SDK's own timeout is 10 minutes with retries; a deep scan normally takes
// 5-10 s. Past this we answer with a retryable error instead of hanging.
const DEEP_SCAN_TIMEOUT_MS = 30_000;
export const maxDuration = 45;

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
    return { id: u.id, plan: effectivePlanId(u) };
  } catch {
    return null;
  }
}

/** Apply burst + daily limits scoped to the signed-in user or the IP. Returns
 *  the daily result (for headers/remaining) or a 429 NextResponse to return. */
async function enforceLimits(req: Request): Promise<
  | { ok: true; daily: Awaited<ReturnType<typeof checkDailyLimit>>; userId: string | null }
  | { ok: false; response: NextResponse }
> {
  const user = await currentUser();
  const scope = user ? `user:${user.id}` : `ip:${ipBucket(clientIp(req))}`;
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
          error: { code: "DAILY_LIMIT_REACHED", message: dailyLimitMessage(dailyLimit, user?.plan ?? null) },
          signupCta: !user,
        },
        { status: 429, headers: { ...rateLimitHeaders(daily), "Retry-After": String(daily.retryAfterSeconds) } }
      ),
    };
  }
  // After the per-IP / per-account checks, so one abuser's refused calls never
  // use up the shared budget. Paid accounts are bounded per account only.
  if (user?.plan === "FREE") {
    const allFree = await checkDailyLimit("detect:day:free:all", ALL_FREE_PER_DAY);
    if (!allFree.ok) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: { code: "BUSY_TRY_LATER", message: "Free deep scans are busy today. Try again tomorrow, or upgrade to Pro." } },
          { status: 429, headers: { "Retry-After": String(allFree.retryAfterSeconds) } }
        ),
      };
    }
  }
  if (!user) {
    const all = await checkDailyLimit("detect:day:anon:all", ALL_ANON_PER_DAY);
    if (!all.ok) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: { code: "BUSY_TRY_LATER", message: "The free tool is busy today. Sign up free to keep going." }, signupCta: true },
          { status: 429, headers: { "Retry-After": String(all.retryAfterSeconds) } }
        ),
      };
    }
  }
  return { ok: true, daily, userId: user?.id ?? null };
}

function dailyLimitMessage(limit: number, plan: string | null): string {
  const base = `You've used your ${limit} deep scans for today. They refill at midnight UTC.`;
  if (!plan) return `${base} Sign up free for more.`;
  if (plan === "FREE") return `${base} Pro includes ${USER_PER_DAY.PRO} a day.`;
  return base;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`deep scan timed out after ${ms} ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export async function POST(req: Request) {
  if (activeProvider() === "none") {
    return NextResponse.json(
      { error: { code: "AI_NOT_CONFIGURED", message: "Deep scan is temporarily unavailable." } },
      { status: 503 }
    );
  }

  let body: { text?: unknown; page?: unknown };
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
  const { daily, userId } = limited;
  const signedIn = !!userId;
  // The tool sends its page; the Referer is the fallback for older clients.
  const page = cleanToolPage(body.page) ?? refererPage(req);

  try {
    const result = await withTimeout(deepScanText(text), DEEP_SCAN_TIMEOUT_MS);
    const touch = firstTouchOf(await readAttribution());
    runAfter("detect:analytics", () =>
      trackServer(randomUUID(), "deep_scan_completed", {
        word_count: words,
        ai_likelihood: Math.round(result.aiLikelihood),
        confidence: result.confidence,
        signed_in: signedIn,
        ...touchEventProps(touch),
        ...(page ? { tool_page: page } : {}),
        $process_person_profile: false,
      })
    );
    if (page) {
      runAfter("detect:tool-run", () =>
        recordToolRun({
          tool: "detector_deep",
          page,
          wordCount: words,
          score: result.aiLikelihood,
          band: result.confidence,
          userId,
          source: toolRunSource(touch),
        })
      );
    }
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
