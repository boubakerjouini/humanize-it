import { describePlan, isOnFree, planShortLabel } from "@/lib/plan-status";

// Noon UTC keeps the en-US date labels stable in any test machine timezone.
const now = new Date("2026-10-27T12:00:00Z");
const in30 = "2026-11-26T12:00:00Z";
const ago2 = "2026-10-25T12:00:00Z";

describe("describePlan", () => {
  it("is free for FREE and unknown plans", () => {
    expect(describePlan({ plan: "FREE" }, { now })).toEqual({ kind: "free" });
    expect(describePlan({ plan: "WHATEVER" }, { now })).toEqual({ kind: "free" });
  });

  it("reads a live subscription with its interval and period end", () => {
    const s = describePlan({ plan: "PRO", subscriptionStatus: "active", currentPeriodEnd: in30, billingInterval: "year", planExpiresAt: null }, { now });
    expect(s).toEqual({ kind: "subscription", plan: "PRO", interval: "year", status: "active", periodEnd: new Date(in30) });
  });

  it("keeps a subscription cancelled at period end as a subscription", () => {
    expect(describePlan({ plan: "TEAM", subscriptionStatus: "cancelled", currentPeriodEnd: in30 }, { now }).kind).toBe("subscription");
  });

  it("treats a comped plan (end date, no subscription) as a gift", () => {
    const s = describePlan({ plan: "PRO", planExpiresAt: in30, subscriptionStatus: null }, { now });
    expect(s).toEqual({ kind: "gift", plan: "PRO", until: new Date(in30) });
    expect(planShortLabel(s)).toBe("Pro · until Nov 26");
    expect(isOnFree(s)).toBe(false);
  });

  it("ignores an ended subscription row when a grant is running", () => {
    expect(describePlan({ plan: "PRO", planExpiresAt: in30, subscriptionStatus: "expired" }, { now }).kind).toBe("gift");
  });

  it("labels a Founding 100 grant as founding, not a gift", () => {
    const s = describePlan({ plan: "PRO", planExpiresAt: in30 }, { now, founding: true });
    expect(s.kind).toBe("founding");
    expect(planShortLabel(s)).toBe("Pro");
  });

  it("reports a lapsed grant as expired and offers the upgrade", () => {
    const s = describePlan({ plan: "PRO", planExpiresAt: ago2 }, { now });
    expect(s).toEqual({ kind: "gift_expired", plan: "PRO", endedOn: new Date(ago2) });
    expect(planShortLabel(s)).toBe("Free");
    expect(isOnFree(s)).toBe(true);
  });

  it("calls a paid plan with no subscription and no end date complimentary", () => {
    expect(describePlan({ plan: "TEAM", planExpiresAt: null, subscriptionStatus: null }, { now })).toEqual({ kind: "complimentary", plan: "TEAM" });
  });
});
