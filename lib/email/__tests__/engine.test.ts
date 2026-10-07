// The engine's decisions, as pure functions: exit rules before anything else,
// late steps skipped rather than sent, conditions mapped to skip or hold, and
// each send outcome mapped to advance / hold / stop.

import { actionForOutcome, hasDeliverableStepsLeft, lateStepsAt, planEnrollmentStep, sampleContext, SEQUENCES } from "@/lib/email/sequences";
import type { SequenceContext } from "@/lib/email/sequences";

const H = 3_600_000;
const now = new Date("2026-10-07T08:00:00Z");

function ctx(key: keyof typeof SEQUENCES, patch: (c: SequenceContext) => void = () => {}): SequenceContext {
  const c = sampleContext(key, now);
  c.user = { plan: "FREE", effectivePlan: "FREE", planExpiresAt: null, createdAt: now };
  c.contact.userId = "u1";
  patch(c);
  return c;
}

describe("planEnrollmentStep", () => {
  const onboarding = SEQUENCES.onboarding;

  it("is idle for anything but an active enrollment", () => {
    expect(planEnrollmentStep(onboarding, { status: "paused", stepIndex: 0, anchorAt: now }, ctx("onboarding"), now, 12)).toEqual({ kind: "idle" });
  });

  it("sends a due step and waits for a future one (12h look-ahead for the cron, none inline)", () => {
    expect(planEnrollmentStep(onboarding, { status: "active", stepIndex: 0, anchorAt: now }, ctx("onboarding"), now, 0).kind).toBe("send");
    const anchor = new Date(now.getTime() - 14 * H); // first_run_nudge due in 10h
    const enr = { status: "active", stepIndex: 1, anchorAt: anchor };
    expect(planEnrollmentStep(onboarding, enr, ctx("onboarding"), now, 12).kind).toBe("send");
    expect(planEnrollmentStep(onboarding, enr, ctx("onboarding"), now, 0)).toEqual({ kind: "wait", nextRunAt: new Date(anchor.getTime() + 24 * H) });
  });

  it("skips a step more than 48 hours late instead of sending it", () => {
    const plan = planEnrollmentStep(onboarding, { status: "active", stepIndex: 0, anchorAt: new Date(now.getTime() - 49 * H) }, ctx("onboarding"), now, 12);
    expect(plan).toMatchObject({ kind: "skip", reason: "late" });
  });

  it("maps a failed condition to a condition skip", () => {
    const c = ctx("onboarding", (x) => (x.contact.firstDocumentAt = now));
    const plan = planEnrollmentStep(onboarding, { status: "active", stepIndex: 1, anchorAt: new Date(now.getTime() - 24 * H) }, c, now, 12);
    expect(plan).toMatchObject({ kind: "skip", reason: "condition" });
    expect(plan.kind === "skip" && plan.step.key).toBe("first_run_nudge");
  });

  it("completes after the last step", () => {
    expect(planEnrollmentStep(onboarding, { status: "active", stepIndex: onboarding.steps.length, anchorAt: now }, ctx("onboarding"), now, 12)).toEqual({ kind: "complete" });
  });

  it("checks exit rules first", () => {
    const lead = SEQUENCES.lead_nurture;
    const converted = ctx("lead_nurture", (c) => (c.contact.userId = "u1"));
    expect(planEnrollmentStep(lead, { status: "active", stepIndex: 0, anchorAt: now }, converted, now, 12)).toEqual({ kind: "exit", reason: "converted" });
    const unsubscribed = ctx("lead_nurture", (c) => {
      c.contact.userId = null;
      c.contact.subscribedTopics = [];
    });
    expect(planEnrollmentStep(lead, { status: "active", stepIndex: 0, anchorAt: now }, unsubscribed, now, 12)).toEqual({ kind: "exit", reason: "unsubscribed" });
  });

  it("exits quota_upgrade once the user is no longer on Free", () => {
    const paid = ctx("quota_upgrade", (c) => (c.user = { plan: "PRO", effectivePlan: "PRO", planExpiresAt: null, createdAt: now }));
    expect(planEnrollmentStep(SEQUENCES.quota_upgrade, { status: "active", stepIndex: 0, anchorAt: now }, paid, now, 12)).toEqual({ kind: "exit", reason: "converted" });
  });

  it("winback exits when the user came back", () => {
    const back = ctx("winback_inactive", (c) => (c.contact.lastActiveAt = new Date(c.enrollment.enrolledAt.getTime() + H)));
    expect(planEnrollmentStep(SEQUENCES.winback_inactive, { status: "active", stepIndex: 1, anchorAt: now }, back, new Date(now.getTime() + 2 * H), 12)).toEqual({
      kind: "exit",
      reason: "active_again",
    });
  });

  describe("grant_expiry (the critic's lapse fix)", () => {
    const seq = SEQUENCES.grant_expiry;
    const anchor = new Date("2026-10-01T00:00:00Z");
    const later = new Date(anchor.getTime() + 30 * H); // grant_ended (+24h) is due
    const enr = { status: "active", stepIndex: 4, anchorAt: anchor };
    const grantCtx = (user: SequenceContext["user"], paying = false) =>
      ctx("grant_expiry", (c) => {
        c.now = later;
        c.enrollment.anchorAt = anchor;
        c.user = user;
        c.hasActivePaidSubscription = paying;
      });

    it("keeps running after checkAndResetQuota cleared the lapsed grant", () => {
      const lapsed = grantCtx({ plan: "FREE", effectivePlan: "FREE", planExpiresAt: null, createdAt: now });
      expect(planEnrollmentStep(seq, enr, lapsed, later, 12)).toMatchObject({ kind: "send", step: { key: "grant_ended" } });
    });

    it("keeps running while the expiry is unchanged", () => {
      const same = grantCtx({ plan: "TEAM", effectivePlan: "FREE", planExpiresAt: anchor, createdAt: now });
      expect(planEnrollmentStep(seq, enr, same, later, 12).kind).toBe("send");
    });

    it("exits on a new expiry or a paid subscription", () => {
      const extended = grantCtx({ plan: "TEAM", effectivePlan: "TEAM", planExpiresAt: new Date(anchor.getTime() + 90 * 24 * H), createdAt: now });
      expect(planEnrollmentStep(seq, enr, extended, later, 12)).toEqual({ kind: "exit", reason: "grant_changed" });
      const paying = grantCtx({ plan: "PRO", effectivePlan: "PRO", planExpiresAt: null, createdAt: now }, true);
      expect(planEnrollmentStep(seq, enr, paying, later, 12)).toEqual({ kind: "exit", reason: "converted" });
    });

    it("exits when the grant was made permanent before it ended", () => {
      const early = new Date(anchor.getTime() - 5 * 24 * H);
      const permanent = ctx("grant_expiry", (c) => {
        c.now = early;
        c.enrollment.anchorAt = anchor;
        c.user = { plan: "TEAM", effectivePlan: "TEAM", planExpiresAt: null, createdAt: now };
      });
      expect(planEnrollmentStep(seq, { status: "active", stepIndex: 1, anchorAt: anchor }, permanent, early, 12)).toEqual({ kind: "exit", reason: "grant_changed" });
    });

    it("grant_ends_tomorrow is late after 20 hours, not 48", () => {
      const step = seq.steps[3];
      expect(step.key).toBe("grant_ends_tomorrow");
      const at = new Date(anchor.getTime() - 24 * H + 21 * H);
      const c = grantCtx({ plan: "TEAM", effectivePlan: "TEAM", planExpiresAt: anchor, createdAt: now });
      expect(planEnrollmentStep(seq, { status: "active", stepIndex: 3, anchorAt: anchor }, c, at, 0)).toMatchObject({ kind: "skip", reason: "late" });
    });
  });
});

describe("actionForOutcome", () => {
  it.each([
    [{ status: "sent", messageId: "m", resendId: "r" }, "advance"],
    [{ status: "duplicate", messageId: "m" }, "advance"],
    [{ status: "skipped", reason: "no_consent" }, "advance"],
    [{ status: "failed", messageId: "m", error: "validation_error", retryable: false }, "advance"],
    [{ status: "failed", messageId: "m", error: "network", retryable: true }, "hold"],
    [{ status: "failed", messageId: "m", error: "daily_quota_exceeded", retryable: true, quotaExceeded: true }, "stop"],
    [{ status: "deferred", reason: "allowlist" }, "hold"],
    [{ status: "deferred", reason: "flow_off" }, "hold"],
    [{ status: "deferred", reason: "error" }, "hold"],
    [{ status: "deferred", reason: "budget" }, "stop"],
    [{ status: "deferred", reason: "disabled" }, "stop"],
    [{ status: "deferred", reason: "not_configured" }, "stop"],
  ] as const)("%j → %s", (outcome, action) => {
    expect(actionForOutcome(outcome)).toBe(action);
  });
});

describe("hasDeliverableStepsLeft", () => {
  const user = { userId: "u1", lifecycleEmails: true, subscribedTopics: ["tips"] };

  it("keeps onboarding while lifecycle or tips can still reach the user", () => {
    expect(hasDeliverableStepsLeft(SEQUENCES.onboarding, 0, user)).toBe(true);
    // Lifecycle off: what_paid_users_do (marketing, tips) still can.
    expect(hasDeliverableStepsLeft(SEQUENCES.onboarding, 0, { ...user, lifecycleEmails: false })).toBe(true);
    // Lifecycle off and no tips: nothing left.
    expect(hasDeliverableStepsLeft(SEQUENCES.onboarding, 0, { ...user, lifecycleEmails: false, subscribedTopics: [] })).toBe(false);
    // Only founder_checkin (lifecycle) remains.
    expect(hasDeliverableStepsLeft(SEQUENCES.onboarding, 4, { ...user, lifecycleEmails: false })).toBe(false);
  });

  it("ends lead nurture once tips is withdrawn", () => {
    const lead = { userId: null, lifecycleEmails: true, subscribedTopics: [] as string[] };
    expect(hasDeliverableStepsLeft(SEQUENCES.lead_nurture, 0, lead)).toBe(false);
    expect(hasDeliverableStepsLeft(SEQUENCES.extension_waitlist, 0, { ...lead, subscribedTopics: ["extension_launch"] })).toBe(true);
  });
});

describe("lateStepsAt", () => {
  it("counts the steps a backfill would skip as too late", () => {
    const anchor = new Date(now.getTime() - 100 * H);
    // welcome (+0, 100h ago) is late; first_run_nudge (+24h, 76h ago) is late; check_before_submit (+72h, 28h ago) is not.
    expect(lateStepsAt(SEQUENCES.onboarding, anchor, now)).toBe(2);
    expect(lateStepsAt(SEQUENCES.onboarding, now, now)).toBe(0);
  });
});
