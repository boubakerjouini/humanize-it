// ===========================================================
// components/workspace/feedback.ts — pure helpers behind the workspace's
// user-facing feedback: the usage meter summary and the friendly error copy
// for humanize / deep-scan / history failures. No React, no sonner, so the
// wording and the quota math are unit-tested (feedback.test.ts).
// ===========================================================

import { PLANS, type PlanId } from "@/lib/plans";

/** Window event the editor fires after anything that changes the word balance. */
export const USAGE_CHANGED_EVENT = "humanizeit:usage-changed";

/** The subset of GET /api/usage the meter reads. */
export interface UsageSnapshot {
  /** The stored plan; a lapsed gift still reads PRO/TEAM here until the next quota check. */
  plan: string;
  /** The plan the limits really come from (a lapsed gift = FREE). Older responses omit it. */
  effectivePlan?: string;
  wordsUsed: number;
  wordsLimit: number; // -1 = unlimited
  quotaResetAt: string | null;
  bonusWords?: number;
  // Read by lib/plan-status describePlan for the shell's plan label.
  subscriptionStatus?: string | null;
  currentPeriodEnd?: string | null;
  billingInterval?: "month" | "year" | null;
  planExpiresAt?: string | null;
}

/**
 * The allowance period to meter against. effectivePlan, not plan: an expired
 * gift still stores PRO until the next quota check, but its limits are Free's.
 */
export function usagePeriod(u: Pick<UsageSnapshot, "plan" | "effectivePlan">): "day" | "month" {
  return (PLANS[(u.effectivePlan ?? u.plan) as PlanId] ?? PLANS.FREE).wordsLimitPeriod;
}

export interface UsageSummary {
  unlimited: boolean;
  wordsLeft: number;
  /** 0-100, share of the plan allowance already used. */
  pct: number;
  period: "day" | "month";
  /** "today" or "this month", for "X words left today". */
  periodLabel: string;
  /** Out of plan words AND bonus words: the next humanize will be refused. */
  limitReached: boolean;
  /** Under 10% of the allowance left (and not yet out). */
  low: boolean;
  /** When the allowance refills, or null when unknown. */
  resetsAt: Date | null;
}

/**
 * Mirrors checkAndResetQuota in lib/quota.ts: the allowance refills one
 * period after quotaResetAt. Bonus words are drawn after the plan allowance,
 * so a user with bonus words left is not at the limit.
 */
export function summarizeUsage(u: UsageSnapshot, period: "day" | "month"): UsageSummary {
  const unlimited = u.wordsLimit < 0;
  const bonus = Math.max(0, u.bonusWords ?? 0);
  const wordsLeft = unlimited ? Infinity : Math.max(0, u.wordsLimit - u.wordsUsed);
  const pct = unlimited || u.wordsLimit === 0 ? 0 : Math.min(100, Math.round((u.wordsUsed / u.wordsLimit) * 100));
  let resetsAt: Date | null = null;
  if (u.quotaResetAt) {
    const d = new Date(u.quotaResetAt);
    if (!Number.isNaN(d.getTime())) {
      if (period === "day") d.setDate(d.getDate() + 1);
      else d.setMonth(d.getMonth() + 1);
      resetsAt = d;
    }
  }
  const limitReached = !unlimited && wordsLeft === 0 && bonus === 0;
  return {
    unlimited,
    wordsLeft,
    pct,
    period,
    periodLabel: period === "day" ? "today" : "this month",
    limitReached,
    low: !unlimited && !limitReached && wordsLeft < u.wordsLimit * 0.1,
    resetsAt,
  };
}

/** "in 5h", "in 40 min", "on Nov 3" — short, for the limit-reached line. */
export function formatResetIn(resetsAt: Date, now: Date = new Date()): string {
  const mins = Math.ceil((resetsAt.getTime() - now.getTime()) / 60000);
  if (mins <= 1) return "in a minute";
  if (mins < 60) return `in ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `in ${hours}h`;
  return `on ${resetsAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

export interface FriendlyError {
  title: string;
  message: string;
  /** Show a Retry button: the same request may well work a moment later. */
  retryable: boolean;
  /** The session is gone: offer Sign in instead of Retry. */
  signIn?: boolean;
}

type ErrorBody = { error?: { code?: string; message?: string } } | null | undefined;

const NETWORK: FriendlyError = {
  title: "You seem to be offline",
  message: "We couldn't reach HumanizeIt. Check your connection and try again.",
  retryable: true,
};

const SESSION: FriendlyError = {
  title: "Your session expired",
  message: "Sign in again to keep going. Your text stays in this tab.",
  retryable: false,
  signIn: true,
};

const RATE_LIMITED: FriendlyError = {
  title: "One moment",
  message: "You're going a bit fast. Wait a few seconds, then try again.",
  retryable: true,
};

/**
 * Friendly copy for a failed humanize (POST /api/analyze then /api/humanize).
 * Only codes whose server message is written for users pass that message
 * through; everything else gets our own wording, never a raw error string.
 * `status` 0 means the request never got a response (offline, DNS, CORS).
 */
export function humanizeError(status: number, body?: ErrorBody): FriendlyError {
  if (status === 0) return NETWORK;
  const code = body?.error?.code;
  if (status === 401 || code === "UNAUTHORIZED") return SESSION;
  if (status === 429 || code === "RATE_LIMITED") return RATE_LIMITED;
  switch (code) {
    case "TEXT_TOO_SHORT":
      return { title: "Add a little more text", message: "Write at least a sentence or two, then humanize.", retryable: false };
    case "TEXT_TOO_LONG":
      return { title: "That text is too long", message: "Humanize up to 10,000 characters at a time. Split longer documents into parts.", retryable: false };
    case "REWRITE_FAILED":
    case "EMPTY_RESULT":
      // The route refunds the reserved words on both of these.
      return { title: "The rewrite didn't go through", message: "Your original text is unchanged and no words were used. Try again.", retryable: true };
    case "TONE_LOCKED":
    case "VOICE_LOCKED":
      return { title: "That option is part of Pro", message: "We switched back to the Standard tone with no voice. Humanize again, or upgrade to keep it.", retryable: true };
    case "NOT_FOUND":
      return { title: "We lost track of that draft", message: "Try again and we'll start a fresh one from your text.", retryable: true };
  }
  return { title: "Something went wrong on our side", message: "Your text is unchanged. Try again in a moment.", retryable: true };
}

/** Friendly copy for a failed deep scan (POST /api/detect). */
export function deepScanError(status: number, body?: ErrorBody): FriendlyError {
  if (status === 0) return NETWORK;
  const code = body?.error?.code;
  // Also a 429, so it must win over the generic rate-limit wording.
  if (code === "DAILY_LIMIT_REACHED") {
    return { title: "No deep scans left today", message: "Deep scans refill tomorrow. The instant estimate above still works.", retryable: false };
  }
  if (status === 429 || code === "RATE_LIMITED") return RATE_LIMITED;
  switch (code) {
    case "TEXT_TOO_SHORT":
    case "TEXT_TOO_LONG":
      // Both messages are written for users and carry the word limits.
      return { title: "Deep scan needs a different length", message: body?.error?.message ?? "Adjust the length of your text and try again.", retryable: false };
    case "AI_NOT_CONFIGURED":
      return { title: "Deep scan is unavailable right now", message: "The instant estimate above still works. Try the deep scan again later.", retryable: true };
  }
  return { title: "The deep scan didn't finish", message: "The model didn't answer in time. Try again in a moment.", retryable: true };
}

/** Friendly copy for a history list that failed to load (GET /api/documents). */
export function historyError(status: number): FriendlyError {
  if (status === 0) return NETWORK;
  if (status === 401) return SESSION;
  return { title: "We couldn't load your history", message: "Your documents are safe. Try again in a moment.", retryable: true };
}
