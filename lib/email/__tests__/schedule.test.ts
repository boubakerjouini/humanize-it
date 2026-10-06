import {
  CRON_LOOKAHEAD_HOURS,
  DEFAULT_MAX_LATE_HOURS,
  dueAt,
  grantExpiryExitReason,
  nextDueStep,
  nextRunAfter,
  type SequenceStep,
} from "@/lib/email/schedule";

const HOUR = 60 * 60 * 1000;
const ANCHOR = new Date("2026-10-06T08:00:00Z");
const at = (hoursFromAnchor: number) => new Date(ANCHOR.getTime() + hoursFromAnchor * HOUR);

const steps: SequenceStep<unknown>[] = [
  { key: "welcome", offsetHours: 0, template: "welcome" },
  { key: "nudge", offsetHours: 24, template: "first_run_nudge" },
  { key: "habit", offsetHours: 72, template: "check_before_submit", maxLateHours: 6 },
];
const def = { steps };
const active = (stepIndex: number) => ({ status: "active", stepIndex, anchorAt: ANCHOR });

describe("dueAt", () => {
  it("adds the offset to the anchor, including negative offsets", () => {
    expect(dueAt({ offsetHours: 24 }, ANCHOR)).toEqual(at(24));
    expect(dueAt({ offsetHours: -336 }, ANCHOR)).toEqual(at(-336));
  });
});

describe("nextDueStep", () => {
  it("is idle for anything but an active enrollment", () => {
    for (const status of ["paused", "completed", "exited"]) {
      expect(nextDueStep(def, { status, stepIndex: 0, anchorAt: ANCHOR }, at(1))).toEqual({ kind: "idle" });
    }
  });

  it("completes once every step has run", () => {
    expect(nextDueStep(def, active(3), at(500))).toEqual({ kind: "complete" });
  });

  it("sends a step that is due", () => {
    expect(nextDueStep(def, active(0), at(0))).toEqual({ kind: "send", step: steps[0] });
    expect(nextDueStep(def, active(1), at(30))).toEqual({ kind: "send", step: steps[1] });
  });

  it("waits for a step that isn't due, reporting when it will be", () => {
    expect(nextDueStep(def, active(1), at(2))).toEqual({ kind: "wait", nextRunAt: at(24) });
  });

  it("looks ahead 12 hours for the cron and 0 hours inline", () => {
    expect(CRON_LOOKAHEAD_HOURS).toBe(12);
    // Due at +24h, now is +13h: inside the cron window, outside the inline one.
    expect(nextDueStep(def, active(1), at(13), { lookAheadHours: CRON_LOOKAHEAD_HOURS }).kind).toBe("send");
    expect(nextDueStep(def, active(1), at(13), { lookAheadHours: 0 }).kind).toBe("wait");
    expect(nextDueStep(def, active(1), at(13)).kind).toBe("wait");
    // Exactly at the edge of the window counts as due.
    expect(nextDueStep(def, active(1), at(12), { lookAheadHours: 12 }).kind).toBe("send");
    expect(nextDueStep(def, active(1), at(11.99), { lookAheadHours: 12 }).kind).toBe("wait");
  });

  it("skips a step more than 48 hours late by default", () => {
    expect(DEFAULT_MAX_LATE_HOURS).toBe(48);
    expect(nextDueStep(def, active(1), at(24 + 48)).kind).toBe("send");
    expect(nextDueStep(def, active(1), at(24 + 48.01))).toEqual({ kind: "skip_late", step: steps[1] });
  });

  it("honors a per-step maxLateHours", () => {
    expect(nextDueStep(def, active(2), at(72 + 6)).kind).toBe("send");
    expect(nextDueStep(def, active(2), at(72 + 7))).toEqual({ kind: "skip_late", step: steps[2] });
  });

  it("handles negative offsets anchored on a future date", () => {
    const expiry = { steps: [
      { key: "notice", offsetHours: -336, template: "grant_ending_notice" },
      { key: "tomorrow", offsetHours: -24, template: "grant_ends_tomorrow", maxLateHours: 20 },
      { key: "ended", offsetHours: 24, template: "grant_ended" },
    ] as SequenceStep<unknown>[] };
    const enr = { status: "active", stepIndex: 0, anchorAt: ANCHOR };
    expect(nextDueStep(expiry, enr, at(-400))).toEqual({ kind: "wait", nextRunAt: at(-336) });
    expect(nextDueStep(expiry, enr, at(-330)).kind).toBe("send");
    expect(nextDueStep(expiry, { ...enr, stepIndex: 1 }, at(-5)).kind).toBe("send");
    expect(nextDueStep(expiry, { ...enr, stepIndex: 1 }, at(-3)).kind).toBe("skip_late");
  });
});

describe("nextRunAfter", () => {
  it("returns the next step's due time, or null at the end", () => {
    expect(nextRunAfter(def, 0, ANCHOR)).toEqual(at(24));
    expect(nextRunAfter(def, 2, ANCHOR)).toBeNull();
  });
});

describe("grantExpiryExitReason", () => {
  const base = { anchorAt: ANCHOR, now: at(-100), plan: "TEAM", planExpiresAt: ANCHOR, hasActivePaidSubscription: false };

  it("keeps running while the grant is unchanged", () => {
    expect(grantExpiryExitReason(base)).toBeNull();
    // Past the anchor but not yet downgraded lazily: still the same grant.
    expect(grantExpiryExitReason({ ...base, now: at(30) })).toBeNull();
  });

  it("keeps running after the lapse clears planExpiresAt (FREE, null, after the anchor)", () => {
    expect(grantExpiryExitReason({ ...base, now: at(30), plan: "FREE", planExpiresAt: null })).toBeNull();
    expect(grantExpiryExitReason({ ...base, now: ANCHOR, plan: "FREE", planExpiresAt: null })).toBeNull();
  });

  it("exits as converted on a paid subscription", () => {
    expect(grantExpiryExitReason({ ...base, hasActivePaidSubscription: true })).toBe("converted");
    expect(grantExpiryExitReason({ ...base, now: at(30), plan: "FREE", planExpiresAt: null, hasActivePaidSubscription: true })).toBe("converted");
  });

  it("exits as grant_changed when the expiry moves", () => {
    expect(grantExpiryExitReason({ ...base, planExpiresAt: at(24 * 30) })).toBe("grant_changed");
    expect(grantExpiryExitReason({ ...base, now: at(30), planExpiresAt: at(24 * 365) })).toBe("grant_changed");
  });

  it("exits as grant_changed when the grant is revoked early or made permanent", () => {
    expect(grantExpiryExitReason({ ...base, plan: "FREE", planExpiresAt: null })).toBe("grant_changed");
    expect(grantExpiryExitReason({ ...base, plan: "TEAM", planExpiresAt: null, now: at(30) })).toBe("grant_changed");
  });
});
