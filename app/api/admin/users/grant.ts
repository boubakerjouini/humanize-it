// ===========================================================
// app/api/admin/users/grant.ts — What the admin Grant action does to a plan.
//
// A grant only ever adds. It keeps the higher of the current and the granted
// plan, and adds its days to the later of now and the current expiry, so
// "extend your access by a month" can't turn a Team account into Pro or cut
// a longer grant short. A plan with no end date (a paid subscription, a seat,
// a lifetime grant) has nothing to extend, and a timed upgrade on top of it is
// refused: the account would drop to Free when the shorter grant ends.
// Pure: the admin users API applies it and the customer page previews it.
// ===========================================================

export type GrantPlan = "PRO" | "TEAM";
type PlanId = "FREE" | GrantPlan;

/** The longest grant accepted, in days (ten years). */
export const MAX_GRANT_DAYS = 3650;

const DAY_MS = 86_400_000;
const RANK: Record<PlanId, number> = { FREE: 0, PRO: 1, TEAM: 2 };
const NAMES: Record<PlanId, string> = { FREE: "Free", PRO: "Pro", TEAM: "Team" };

export type GrantRequest = { plan: GrantPlan; days: number | null };
export type GrantOutcome = { ok: true; plan: GrantPlan; planExpiresAt: Date | null } | { ok: false; reason: string };
type PlanState = { plan: string; planExpiresAt: Date | null };

/** A whole number of days from 1 to MAX_GRANT_DAYS. */
export function isGrantDays(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= MAX_GRANT_DAYS;
}

function planOf(state: PlanState): PlanId {
  return state.plan === "PRO" || state.plan === "TEAM" ? state.plan : "FREE";
}

/** A paid-tier plan that hasn't ended (no end date, or one still ahead). */
function isLive(state: PlanState, now: Date): boolean {
  return planOf(state) !== "FREE" && (!state.planExpiresAt || state.planExpiresAt.getTime() > now.getTime());
}

/** The plan and expiry a grant leaves, or why it would take something away. `days: null` = no end date. */
export function planAfterGrant(current: PlanState, grant: GrantRequest, now: Date = new Date()): GrantOutcome {
  const days = grant.days;
  // Free, or a grant that already ended: a fresh grant that starts now.
  if (!isLive(current, now)) {
    return { ok: true, plan: grant.plan, planExpiresAt: days ? new Date(now.getTime() + days * DAY_MS) : null };
  }

  const was = planOf(current) as GrantPlan;
  const plan = RANK[grant.plan] > RANK[was] ? grant.plan : was;
  const expiresAt = current.planExpiresAt;

  if (!expiresAt) {
    if (plan === was) return { ok: false, reason: `This account already has ${NAMES[was]} with no end date, so there is nothing to extend.` };
    if (days) {
      return {
        ok: false,
        reason: `This account has ${NAMES[was]} with no end date. A ${days}-day ${NAMES[plan]} grant would end on Free, so nothing was changed. Use Set plan for a permanent change.`,
      };
    }
    return { ok: true, plan, planExpiresAt: null };
  }

  // A live grant with an end date: the days go on top of that end date.
  return { ok: true, plan, planExpiresAt: days ? new Date(expiresAt.getTime() + days * DAY_MS) : null };
}

/** Audit summary, e.g. "Granted PRO +30d → TEAM until 2027-07-08 (was TEAM until 2027-06-08)". */
export function describeGrant(
  current: PlanState,
  grant: GrantRequest,
  outcome: Extract<GrantOutcome, { ok: true }>,
  now: Date = new Date()
): string {
  const state = (plan: string, until: Date | null) => `${plan} ${until ? `until ${until.toISOString().slice(0, 10)}` : "with no end date"}`;
  const asked = `${grant.plan} ${grant.days ? `+${grant.days}d` : "(lifetime)"}`;
  const before = isLive(current, now) ? ` (was ${state(planOf(current), current.planExpiresAt)})` : "";
  return `Granted ${asked} → ${state(outcome.plan, outcome.planExpiresAt)}${before}`;
}
