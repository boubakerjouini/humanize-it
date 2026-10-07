// ===========================================================
// /api/voice-profiles — Voice Match profiles for the signed-in user
//
// GET  → { profiles, limit, used, plan, annual, founding }. Each profile says
//        whether it is usable under the current plan (locked ones are kept).
// POST { name, samples: string[2..3] } → creates a profile from writing the
//        user wrote. One model call, so it is plan-gated and rate-limited.
// ===========================================================

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ensureUser } from "@/lib/user";
import { checkAndResetQuota, planConfigFor } from "@/lib/quota";
import { checkRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { trackServer } from "@/lib/posthog";
import {
  MAX_NAME_CHARS,
  MAX_SAMPLE_CHARS,
  MAX_SAMPLES,
  MIN_SAMPLE_CHARS,
  MIN_SAMPLES,
  countWords,
  extractFingerprint,
  usableProfileIds,
  voiceAllowance,
} from "./shared";

export const runtime = "nodejs";

const createSchema = z.object({
  name: z.string().trim().min(1, "Give the voice a name.").max(MAX_NAME_CHARS),
  samples: z
    .array(
      z
        .string()
        .trim()
        .min(MIN_SAMPLE_CHARS, `Each sample needs at least ${MIN_SAMPLE_CHARS} characters.`)
        .max(MAX_SAMPLE_CHARS, `Each sample can be up to ${MAX_SAMPLE_CHARS.toLocaleString("en-US")} characters.`)
    )
    .min(MIN_SAMPLES, `Paste ${MIN_SAMPLES} or ${MAX_SAMPLES} samples you wrote.`)
    .max(MAX_SAMPLES, `Paste ${MIN_SAMPLES} or ${MAX_SAMPLES} samples you wrote.`),
});

function error(code: string, message: string, status: number, headers?: Record<string, string>) {
  return NextResponse.json({ error: { code, message } }, { status, headers });
}

async function loadUser() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return null;
  const user = await checkAndResetQuota(await ensureUser(clerkId));
  return { clerkId, user, plan: planConfigFor(user) };
}

export async function GET() {
  try {
    const ctx = await loadUser();
    if (!ctx) return error("UNAUTHORIZED", "Authentication required.", 401);
    const { user, plan } = ctx;

    const allowance = await voiceAllowance(user.id, plan.id);
    const [rows, usable] = await Promise.all([
      db.voiceProfile.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, sampleWords: true, createdAt: true },
      }),
      usableProfileIds(user.id, allowance.limit),
    ]);

    return NextResponse.json({
      profiles: rows.map((r) => ({ ...r, usable: usable.has(r.id) })),
      limit: allowance.limit,
      used: rows.length,
      plan: plan.id,
      annual: allowance.annual,
      founding: allowance.founding,
    });
  } catch (err) {
    console.error("[voice-profiles] GET failed:", err);
    return error("INTERNAL_ERROR", "Something went wrong.", 500);
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await loadUser();
    if (!ctx) return error("UNAUTHORIZED", "Authentication required.", 401);
    const { clerkId, user, plan } = ctx;

    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return error("INVALID_JSON", "Invalid JSON body.", 400);
    }
    const parsed = createSchema.safeParse(raw);
    if (!parsed.success) {
      return error("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input.", 400);
    }

    const allowance = await voiceAllowance(user.id, plan.id);
    if (allowance.limit <= 0) {
      return error("PLAN_REQUIRED", "Voice Match is part of Pro and Team.", 403);
    }
    const used = await db.voiceProfile.count({ where: { userId: user.id } });
    if (used >= allowance.limit) {
      return error(
        "LIMIT_REACHED",
        `Your plan includes ${allowance.limit} voice ${allowance.limit === 1 ? "profile" : "profiles"}. Delete one to add another.`,
        409
      );
    }

    // A model call per create: keep it to a handful a minute.
    const rl = await checkRateLimit(`voice:${user.id}`, 3);
    const rlHeaders = rateLimitHeaders(rl);
    if (!rl.ok) {
      return error("RATE_LIMITED", "Too many requests. Please slow down.", 429, {
        ...rlHeaders,
        "Retry-After": String(rl.retryAfterSeconds),
      });
    }

    const { name, samples } = parsed.data;
    let fingerprint;
    try {
      fingerprint = await extractFingerprint(samples);
    } catch (modelErr) {
      console.error("[voice-profiles] fingerprint failed:", modelErr);
      return error("VOICE_FAILED", "We couldn't read a voice from those samples. Please try again.", 502, rlHeaders);
    }

    const profile = await db.voiceProfile.create({
      data: {
        userId: user.id,
        name,
        fingerprint,
        sampleWords: samples.reduce((n, s) => n + countWords(s), 0),
      },
      select: { id: true, name: true, sampleWords: true, createdAt: true },
    });

    trackServer(clerkId, "voice_profile_created", { plan: plan.id, samples: samples.length });
    return NextResponse.json({ profile: { ...profile, usable: true } }, { status: 201, headers: rlHeaders });
  } catch (err) {
    console.error("[voice-profiles] POST failed:", err);
    return error("INTERNAL_ERROR", "Something went wrong.", 500);
  }
}
