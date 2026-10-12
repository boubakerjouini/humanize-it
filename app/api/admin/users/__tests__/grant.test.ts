// The admin Grant action only ever adds: it keeps the higher plan, extends from
// the later of now and the current end date, and refuses a timed upgrade that
// would leave a no-end-date plan on Free. The form's defaults (Pro, 30 days)
// can't downgrade or shorten anyone.

import { MAX_GRANT_DAYS, describeGrant, isGrantDays, planAfterGrant } from "../grant";

const DAY = 86_400_000;
const NOW = new Date("2026-10-08T12:00:00Z");
const at = (iso: string) => new Date(iso);
const plusDays = (d: Date, days: number) => new Date(d.getTime() + days * DAY);

describe("planAfterGrant", () => {
  it("extends a comped Team account by a month even when the form says Pro", () => {
    const current = { plan: "TEAM", planExpiresAt: at("2027-06-08T00:00:00Z") };
    expect(planAfterGrant(current, { plan: "PRO", days: 30 }, NOW)).toEqual({
      ok: true,
      plan: "TEAM",
      planExpiresAt: at("2027-07-08T00:00:00Z"),
    });
  });

  it("adds the days to the current end date, never to today, for the same plan", () => {
    const end = plusDays(NOW, 200);
    const out = planAfterGrant({ plan: "TEAM", planExpiresAt: end }, { plan: "TEAM", days: 30 }, NOW);
    expect(out).toEqual({ ok: true, plan: "TEAM", planExpiresAt: plusDays(end, 30) });
  });

  it("upgrades a live Pro grant to Team and still extends from its end date", () => {
    const end = plusDays(NOW, 10);
    const out = planAfterGrant({ plan: "PRO", planExpiresAt: end }, { plan: "TEAM", days: 30 }, NOW);
    expect(out).toEqual({ ok: true, plan: "TEAM", planExpiresAt: plusDays(end, 30) });
  });

  it("starts from now for a Free account or a grant that already ended", () => {
    expect(planAfterGrant({ plan: "FREE", planExpiresAt: null }, { plan: "PRO", days: 7 }, NOW)).toEqual({
      ok: true,
      plan: "PRO",
      planExpiresAt: plusDays(NOW, 7),
    });
    const lapsed = { plan: "TEAM", planExpiresAt: plusDays(NOW, -3) };
    expect(planAfterGrant(lapsed, { plan: "PRO", days: 30 }, NOW)).toEqual({ ok: true, plan: "PRO", planExpiresAt: plusDays(NOW, 30) });
  });

  it("gives no end date when no days are given", () => {
    expect(planAfterGrant({ plan: "FREE", planExpiresAt: null }, { plan: "TEAM", days: null }, NOW)).toEqual({
      ok: true,
      plan: "TEAM",
      planExpiresAt: null,
    });
    expect(planAfterGrant({ plan: "TEAM", planExpiresAt: plusDays(NOW, 5) }, { plan: "PRO", days: null }, NOW)).toEqual({
      ok: true,
      plan: "TEAM",
      planExpiresAt: null,
    });
  });

  it("has nothing to extend on a plan with no end date (subscription, seat, lifetime grant)", () => {
    const out = planAfterGrant({ plan: "TEAM", planExpiresAt: null }, { plan: "PRO", days: 30 }, NOW);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toMatch(/already has Team with no end date/);
  });

  it("refuses a timed upgrade on top of a no-end-date plan, which would end on Free", () => {
    const out = planAfterGrant({ plan: "PRO", planExpiresAt: null }, { plan: "TEAM", days: 30 }, NOW);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toMatch(/would end on Free/);
    // A permanent upgrade has no such trap.
    expect(planAfterGrant({ plan: "PRO", planExpiresAt: null }, { plan: "TEAM", days: null }, NOW)).toEqual({
      ok: true,
      plan: "TEAM",
      planExpiresAt: null,
    });
  });

  it("never returns a lower plan or an earlier end date than the account has", () => {
    const plans = ["FREE", "PRO", "TEAM"] as const;
    const ends = [null, plusDays(NOW, -1), plusDays(NOW, 3), plusDays(NOW, 300)];
    const rank = { FREE: 0, PRO: 1, TEAM: 2 };
    for (const plan of plans) {
      for (const planExpiresAt of ends) {
        for (const grantPlan of ["PRO", "TEAM"] as const) {
          for (const days of [1, 30, 365, null]) {
            const out = planAfterGrant({ plan, planExpiresAt }, { plan: grantPlan, days }, NOW);
            if (!out.ok) continue;
            const live = plan !== "FREE" && (!planExpiresAt || planExpiresAt > NOW);
            if (!live) continue;
            expect(rank[out.plan]).toBeGreaterThanOrEqual(rank[plan]);
            if (out.planExpiresAt && planExpiresAt) expect(out.planExpiresAt.getTime()).toBeGreaterThan(planExpiresAt.getTime());
            if (!planExpiresAt) expect(out.planExpiresAt).toBeNull();
          }
        }
      }
    }
  });
});

describe("isGrantDays", () => {
  it("accepts whole days from 1 to the cap only", () => {
    expect(isGrantDays(1)).toBe(true);
    expect(isGrantDays(30)).toBe(true);
    expect(isGrantDays(MAX_GRANT_DAYS)).toBe(true);
    for (const bad of [0, -5, 1.5, NaN, Infinity, MAX_GRANT_DAYS + 1, "30", null, undefined]) expect(isGrantDays(bad)).toBe(false);
  });
});

describe("describeGrant", () => {
  it("records what was asked, the result and what it replaced", () => {
    const current = { plan: "TEAM", planExpiresAt: at("2027-06-08T00:00:00Z") };
    const grant = { plan: "PRO" as const, days: 30 };
    const out = planAfterGrant(current, grant, NOW);
    if (!out.ok) throw new Error(out.reason);
    expect(describeGrant(current, grant, out, NOW)).toBe("Granted PRO +30d → TEAM until 2027-07-08 (was TEAM until 2027-06-08)");
  });

  it("leaves out the previous state when there was no live plan", () => {
    const current = { plan: "FREE", planExpiresAt: null };
    const grant = { plan: "TEAM" as const, days: null };
    const out = planAfterGrant(current, grant, NOW);
    if (!out.ok) throw new Error(out.reason);
    expect(describeGrant(current, grant, out, NOW)).toBe("Granted TEAM (lifetime) → TEAM with no end date");
  });
});
