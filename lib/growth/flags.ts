// ===========================================================
// lib/growth/flags.ts — Environment switches for the growth engine.
//
// Pure over `env`: no DB, no Clerk, so it is unit-testable and safe anywhere.
// The admin allowlist (lib/admin.ts imports Clerk and the DB) is passed in by
// the caller; lib/email/send.ts merges adminEmails() itself.
//
// Safety contract: nothing reaches a real inbox unless EMAIL_SENDING_ENABLED is
// "true", the transport is configured, AND the runtime is Vercel production.
// Every other runtime (previews, `next dev`, a local `next start` that loaded
// production secrets) is forced into allowlist mode.
// ===========================================================

export type Env = Record<string, string | undefined>;

export type EmailSendingMode = "off" | "allowlist" | "live";

const DEFAULT_APP_URL = "https://humanizeit.app";

/** Variables without which nothing can be sent (or no link can be signed). */
const REQUIRED_FOR_SENDING = ["RESEND_API_KEY", "EMAIL_FROM", "EMAIL_TOKEN_SECRET"] as const;

function hasValue(env: Env, key: string): boolean {
  return !!env[key]?.trim();
}

/**
 * Production means Vercel production AND a production build. VERCEL_ENV is
 * required (not just "not preview"), so a local `next start` with pulled
 * production secrets still cannot email real users.
 */
export function isProductionRuntime(env: Env = process.env): boolean {
  return env.VERCEL_ENV === "production" && env.NODE_ENV === "production";
}

export function emailSendingMode(env: Env = process.env): EmailSendingMode {
  if (env.EMAIL_SENDING_ENABLED !== "true") return "off";
  if (REQUIRED_FOR_SENDING.some((key) => !hasValue(env, key))) return "off";
  if (!isProductionRuntime(env)) return "allowlist";
  if (parseEmailList(env.EMAIL_ALLOWLIST).length > 0) return "allowlist";
  return "live";
}

/** Comma, semicolon or whitespace separated addresses, trimmed and lower-cased. */
export function parseEmailList(raw: string | undefined | null): string[] {
  if (!raw) return [];
  return raw
    .split(/[\s,;]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.includes("@"));
}

/** EMAIL_ALLOWLIST plus the admin addresses the caller passes in. */
export function effectiveAllowlist(adminEmails: Iterable<string>, env: Env = process.env): Set<string> {
  const set = new Set(parseEmailList(env.EMAIL_ALLOWLIST));
  for (const e of adminEmails) {
    const normalized = e.trim().toLowerCase();
    if (normalized) set.add(normalized);
  }
  return set;
}

export function isAllowlisted(
  email: string | null | undefined,
  adminEmails: Iterable<string>,
  env: Env = process.env
): boolean {
  if (!email) return false;
  return effectiveAllowlist(adminEmails, env).has(email.trim().toLowerCase());
}

function positiveInt(raw: string | undefined, fallback: number): number {
  if (!raw?.trim()) return fallback;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

/** Referral program and its in-app surfaces. Off unless explicitly enabled. */
export function referralsEnabled(env: Env = process.env): boolean {
  return env.REFERRALS_ENABLED === "true";
}

/** Cap on 7-day PASS- codes issued by sequences per rolling 30 days. */
export function trialPassesPerMonth(env: Env = process.env): number {
  return positiveInt(env.TRIAL_PASSES_PER_MONTH, 20);
}

/** Rule-of-100 tracker target (outreach touches per day). */
export function outreachDailyGoal(env: Env = process.env): number {
  return positiveInt(env.OUTREACH_DAILY_GOAL, 30);
}

/** Our own daily send cap, kept under Resend's 100/day free limit. */
export function emailDailyCap(env: Env = process.env): number {
  return positiveInt(env.EMAIL_DAILY_CAP, 90);
}

/** Postal address for marketing footers. Marketing sends are skipped without it. */
export function postalAddress(env: Env = process.env): string | null {
  const value = env.COMPANY_POSTAL_ADDRESS?.trim();
  return value ? value : null;
}

/** Canonical site origin without a trailing slash. */
export function appUrl(env: Env = process.env): string {
  const raw = env.NEXT_PUBLIC_APP_URL?.trim();
  if (!raw) return DEFAULT_APP_URL;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return DEFAULT_APP_URL;
    return url.origin;
  } catch {
    return DEFAULT_APP_URL;
  }
}

/** Configuration presence for the admin status banner: booleans only, never values. */
export function emailConfigStatus(env: Env = process.env) {
  return {
    resendKey: hasValue(env, "RESEND_API_KEY"),
    from: hasValue(env, "EMAIL_FROM"),
    replyTo: hasValue(env, "EMAIL_REPLY_TO"),
    webhookSecret: hasValue(env, "RESEND_WEBHOOK_SECRET"),
    tokenSecret: hasValue(env, "EMAIL_TOKEN_SECRET"),
    postalAddress: postalAddress(env) !== null,
    cronSecret: hasValue(env, "CRON_SECRET"),
  };
}
