// ===========================================================
// lib/crm/lifecycle.ts — Lifecycle stage of a contact (pure).
//
// One ordered rule table, first match wins, each with a human-readable reason
// so the admin can see *why* someone is "at risk". Pure on purpose: the
// effective plan arrives as plain data (lib/crm/recompute.ts resolves it with
// effectivePlanId), because lib/quota.ts imports the database client.
// ===========================================================

import type { PlanId } from "@/lib/plans";

export const STAGES = [
  "prospect",
  "lead",
  "engaged_lead",
  "signed_up",
  "activated",
  "power_user",
  "comped",
  "customer",
  "at_risk",
  "churned",
  "dormant",
] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_COLORS: Record<Stage, string> = {
  prospect: "#64748b",
  lead: "#2563eb",
  engaged_lead: "#4f46e5",
  signed_up: "#7c3aed",
  activated: "#16a34a",
  power_user: "#0d9488",
  comped: "#f59e0b",
  customer: "#059669",
  at_risk: "#f97316",
  churned: "#e11d48",
  dormant: "#94a3b8",
};

export const STAGE_LABELS: Record<Stage, string> = {
  prospect: "Prospect",
  lead: "Lead",
  engaged_lead: "Engaged lead",
  signed_up: "Signed up",
  activated: "Activated",
  power_user: "Power user",
  comped: "Comped",
  customer: "Customer",
  at_risk: "At risk",
  churned: "Churned",
  dormant: "Dormant",
};

export function isStage(value: unknown): value is Stage {
  return typeof value === "string" && (STAGES as readonly string[]).includes(value);
}

export type StageInput = {
  now: Date;
  /** Admin override; ignored unless it is a known stage. */
  override: string | null;
  hasEmail: boolean;
  isUser: boolean;
  userCreatedAt: Date | null;
  /** Effective plan (an expired grant is FREE), resolved by the caller. */
  effectivePlan: PlanId;
  subscriptionStatus: string | null;
  /** A LemonSqueezy subscription row has ever existed. */
  hadPaidSubscription: boolean;
  /** Occupies a seat in a paying organization. */
  orgSeatActive: boolean;
  firstDocumentAt: Date | null;
  lastActiveAt: Date | null;
  docsLast14d: number;
  emailVerified: boolean;
  magnetCount: number;
  score: number;
};

export type StageResult = { stage: Stage; reason: string };

const DAY_MS = 24 * 60 * 60 * 1000;
const PAYMENT_ISSUE = new Set(["past_due", "unpaid", "paused"]);
const PAYING = new Set(["active", "on_trial"]);

/** Strictly older than `days`: exactly 14 days ago is not yet "inactive 14d". */
function olderThan(at: Date | null, days: number, now: Date): boolean {
  if (!at) return false;
  return now.getTime() - at.getTime() > days * DAY_MS;
}

export function computeStage(i: StageInput): StageResult {
  if (isStage(i.override)) return { stage: i.override, reason: "admin override" };

  const activityRef = i.lastActiveAt ?? i.userCreatedAt;
  const inactive = (days: number) => olderThan(activityRef, days, i.now);
  const status = i.subscriptionStatus;
  const paying = (status !== null && PAYING.has(status)) || i.orgSeatActive;

  if (status !== null && PAYMENT_ISSUE.has(status)) return { stage: "at_risk", reason: "payment issue or paused" };
  if (paying && inactive(14)) return { stage: "at_risk", reason: "paying, inactive 14d" };
  if (paying) return { stage: "customer", reason: "active subscription" };
  if (i.hadPaidSubscription && i.effectivePlan === "FREE") return { stage: "churned", reason: "subscription ended" };
  if (i.effectivePlan !== "FREE" && inactive(14)) return { stage: "at_risk", reason: "comped, inactive 14d" };
  if (i.effectivePlan !== "FREE") return { stage: "comped", reason: "plan via code or grant" };

  if (i.isUser) {
    if (i.firstDocumentAt && !inactive(30)) {
      if (i.docsLast14d >= 5) return { stage: "power_user", reason: "≥5 docs in 14d" };
      return { stage: "activated", reason: "active in 30d" };
    }
    const dormant = i.firstDocumentAt ? inactive(30) : olderThan(i.userCreatedAt, 30, i.now);
    if (dormant) return { stage: "dormant", reason: "inactive 30d" };
    return { stage: "signed_up", reason: "no first document yet" };
  }

  // First-party click tracking was cut, so engagement means a second magnet or a warm score.
  if (i.hasEmail && i.emailVerified && (i.magnetCount >= 2 || i.score >= 40)) {
    return { stage: "engaged_lead", reason: "verified and engaged" };
  }
  if (i.hasEmail) return { stage: "lead", reason: "email captured" };
  return { stage: "prospect", reason: "no email yet" };
}
