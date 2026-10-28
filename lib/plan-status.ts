// ===========================================================
// Plan status — what the signed-in user is on, and why, for the settings
// page and the app shell's plan label. Pure: fed by GET /api/usage (plus the
// founding flag from GET /api/offers), so the client and tests share it.
//
// A plan comes from one of: a Polar subscription; a grant with an end date
// (a gift from the team, a redeem code, the Founding 100 purchase), which
// sets User.plan + planExpiresAt with no Subscription; an organization seat
// (TEAM, no end date); or nothing (Free).
// ===========================================================

export interface PlanStatusInput {
  plan: string;
  /** ISO date; set by grants, null for subscriptions and org seats. */
  planExpiresAt?: string | null;
  subscriptionStatus?: string | null;
  currentPeriodEnd?: string | null;
  billingInterval?: "month" | "year" | null;
}

export type PaidPlan = "PRO" | "TEAM";

export type PlanStatus =
  | { kind: "free" }
  | {
      kind: "subscription";
      plan: PaidPlan;
      interval: "month" | "year" | null;
      /** Local status vocabulary (app/api/webhooks/polar/route.ts localStatus). */
      status: "active" | "on_trial" | "past_due" | "cancelled" | "paused";
      periodEnd: Date | null;
    }
  | { kind: "gift"; plan: PaidPlan; until: Date }
  | { kind: "founding"; plan: PaidPlan; until: Date }
  /** The grant ended; the next request downgrades the row to Free (lib/quota.ts). */
  | { kind: "gift_expired"; plan: PaidPlan; endedOn: Date }
  /** A plan with no subscription and no end date: an org seat or a lifetime code. */
  | { kind: "complimentary"; plan: PaidPlan };

/** Subscription statuses that still mean "you have a subscription" (expired/incomplete do not). */
const LIVE_SUBSCRIPTION = new Set(["active", "on_trial", "past_due", "cancelled", "paused"]);

const PLAN_NAMES: Record<PaidPlan, string> = { PRO: "Pro", TEAM: "Team" };

function toDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function describePlan(input: PlanStatusInput, opts: { founding?: boolean; now?: Date } = {}): PlanStatus {
  const now = opts.now ?? new Date();
  const plan = input.plan === "PRO" || input.plan === "TEAM" ? input.plan : null;
  if (!plan) return { kind: "free" };

  const status = input.subscriptionStatus ?? null;
  if (status && LIVE_SUBSCRIPTION.has(status)) {
    return {
      kind: "subscription",
      plan,
      interval: input.billingInterval ?? null,
      status: status as Extract<PlanStatus, { kind: "subscription" }>["status"],
      periodEnd: toDate(input.currentPeriodEnd),
    };
  }

  const expires = toDate(input.planExpiresAt);
  if (!expires) return { kind: "complimentary", plan };
  if (expires.getTime() <= now.getTime()) return { kind: "gift_expired", plan, endedOn: expires };
  return opts.founding ? { kind: "founding", plan, until: expires } : { kind: "gift", plan, until: expires };
}

export function planName(plan: PaidPlan): string {
  return PLAN_NAMES[plan];
}

/** "November 26, 2026" */
export function longDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

/** "Nov 26, 2026" */
export function mediumDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** The compact label for the app shell: "Pro · until Nov 26" for a gift, "Pro" otherwise. */
export function planShortLabel(status: PlanStatus): string {
  switch (status.kind) {
    case "free":
    case "gift_expired":
      return "Free";
    case "gift":
      return `${planName(status.plan)} · until ${status.until.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
    default:
      return planName(status.plan);
  }
}

/** True when the user should be offered an upgrade (nothing paid is running). */
export function isOnFree(status: PlanStatus): boolean {
  return status.kind === "free" || status.kind === "gift_expired";
}
