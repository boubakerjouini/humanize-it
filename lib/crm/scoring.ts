// ===========================================================
// lib/crm/scoring.ts — Transparent lead score (pure).
//
// A sum of named rules, clamped to 0–100, with a per-rule breakdown the admin
// can read ("+15 quota hit in the last 30 days"). Email open and click rules
// were cut along with first-party click tracking: at our volume the rates are
// noise, and link scanners inflate them anyway.
// ===========================================================

export type ScoreGrade = "hot" | "warm" | "cold";

export const GRADE_COLORS: Record<ScoreGrade, string> = {
  hot: "#e11d48",
  warm: "#f59e0b",
  cold: "#64748b",
};

export type ScoreInput = {
  hasEmail: boolean;
  emailVerified: boolean;
  /** Distinct lead magnets requested. */
  magnetCount: number;
  subscribedTopics: readonly string[];
  pendingTopics: readonly string[];
  /** First-touch channel. */
  channel: string | null;
  isUser: boolean;
  hasFirstDocument: boolean;
  docsLast14d: number;
  humanizedLast30d: number;
  quotaHitsLast30d: number;
  checkoutsLast30d: number;
  hasActiveSubscription: boolean;
  /** Referees, pending or rewarded. */
  referrals: number;
  /** A user whose last activity (or signup) is more than 30 days old. */
  userInactive30d: boolean;
  unsubscribed: boolean;
  emailStatus: string;
};

export type ScoreLine = { key: string; label: string; points: number; detail: string };
export type ScoreResult = { score: number; grade: ScoreGrade; breakdown: ScoreLine[] };

const WARM_CHANNELS = new Set(["referral_program", "outreach"]);

export function gradeFor(score: number): ScoreGrade {
  if (score >= 60) return "hot";
  if (score >= 30) return "warm";
  return "cold";
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/** Rules in table order; the breakdown keeps this order so it reads the same every time. */
export function computeScore(i: ScoreInput): ScoreResult {
  const lines: ScoreLine[] = [];
  const add = (key: string, label: string, points: number, detail: string) => {
    if (points !== 0) lines.push({ key, label, points, detail });
  };
  const capped = (count: number, each: number, cap: number) => Math.min(Math.max(0, count) * each, cap);

  if (i.hasEmail) add("email_captured", "Email captured", 5, "has an email address");
  if (i.emailVerified) add("email_verified", "Email verified", 5, "confirmed by double opt-in or a Clerk account");
  if (i.magnetCount > 0) add("magnet", "Lead magnets", capped(i.magnetCount, 5, 15), plural(i.magnetCount, "magnet"));
  if (i.subscribedTopics.includes("tips")) add("tips_subscribed", "Tips subscriber", 5, "subscribed to tips");
  if (i.subscribedTopics.includes("extension_launch") || i.pendingTopics.includes("extension_launch")) {
    add("waitlist", "Extension waitlist", 3, "joined the extension waitlist");
  }
  if (i.channel && WARM_CHANNELS.has(i.channel)) add("warm_source", "Warm source", 10, `first touch: ${i.channel}`);
  if (i.isUser) add("signed_up", "Has an account", 15, "signed up");
  if (i.hasFirstDocument) add("first_document", "First document", 10, "ran a first document");
  if (i.docsLast14d > 0) add("recent_docs", "Recent documents", capped(i.docsLast14d, 2, 20), `${plural(i.docsLast14d, "doc")} in 14d`);
  if (i.humanizedLast30d > 0) add("humanized", "Humanized", 5, "humanized in the last 30 days");
  if (i.quotaHitsLast30d > 0) add("quota_hit", "Hit a quota", 15, "hit a limit in the last 30 days");
  if (i.checkoutsLast30d > 0 && !i.hasActiveSubscription) {
    add("checkout_started", "Started checkout", 20, "started a checkout in the last 30 days, no active subscription");
  }
  if (i.referrals > 0) add("referrals", "Referrals", capped(i.referrals, 5, 15), plural(i.referrals, "referee"));
  if (i.userInactive30d) add("inactive_30d", "Inactive", -15, "no activity for 30 days");
  if (i.unsubscribed && i.subscribedTopics.length === 0) add("unsubscribed", "Unsubscribed", -10, "withdrew marketing consent");
  if (i.emailStatus === "bounced") add("bounced", "Bounced", -30, "email bounced");
  if (i.emailStatus === "complained") add("complained", "Complained", -50, "marked an email as spam");

  const raw = lines.reduce((sum, line) => sum + line.points, 0);
  const score = Math.max(0, Math.min(100, raw));
  return { score, grade: gradeFor(score), breakdown: lines };
}

/**
 * Does a stored breakdown (Contact.scoreBreakdown, null when never scored)
 * equal this one? Compared field by field: jsonb reorders object keys
 * (shortest first), so a stored line reads back as {key, label, detail,
 * points} and a JSON string compare would never match.
 */
export function sameBreakdown(stored: unknown, next: readonly ScoreLine[]): boolean {
  const lines = stored ?? [];
  if (!Array.isArray(lines) || lines.length !== next.length) return false;
  return next.every((line, i) => {
    const s = lines[i] as Partial<ScoreLine> | null;
    return !!s && s.key === line.key && s.label === line.label && s.points === line.points && s.detail === line.detail;
  });
}
