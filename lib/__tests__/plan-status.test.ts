import { describePlan, isOnFree, planShortLabel, usageRefillLine } from "@/lib/plan-status";

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

describe("usageRefillLine", () => {
  const dec5 = new Date("2026-12-05T12:00:00Z");

  it("names the gift's end date when it comes before the monthly refill", () => {
    const gift = describePlan({ plan: "PRO", planExpiresAt: in30 }, { now });
    expect(usageRefillLine(gift, dec5, 500)).toEqual({ text: "Your gift ends Nov 26, 2026. Then Free: 500 words a day", planEnds: true });
  });

  it("uses the Founding wording for a Founding grant", () => {
    const founding = describePlan({ plan: "PRO", planExpiresAt: in30 }, { now, founding: true });
    expect(usageRefillLine(founding, dec5, 500).text).toBe("Founding access ends Nov 26, 2026. Then Free: 500 words a day");
  });

  it("refills normally when the gift outlasts the reset", () => {
    const gift = describePlan({ plan: "PRO", planExpiresAt: "2027-01-10T12:00:00Z" }, { now });
    expect(usageRefillLine(gift, dec5, 500)).toEqual({ text: "Words refill December 5, 2026", planEnds: false });
  });

  it("says a cancelled subscription ends before the refill", () => {
    const sub = describePlan({ plan: "PRO", subscriptionStatus: "cancelled", currentPeriodEnd: in30 }, { now });
    expect(usageRefillLine(sub, dec5, 500)).toEqual({ text: "Pro ends Nov 26, 2026, then Free: 500 words a day", planEnds: true });
  });

  it("keeps a normal refill line for an active monthly subscription", () => {
    const sub = describePlan({ plan: "PRO", subscriptionStatus: "active", currentPeriodEnd: in30, billingInterval: "month" }, { now });
    expect(usageRefillLine(sub, dec5, 500)).toEqual({ text: "Words refill December 5, 2026", planEnds: false });
  });

  it("gives Free (and a lapsed gift) the refill date with its time", () => {
    const resets = new Date(2026, 9, 29, 15, 0);
    // ICU versions differ on the date/time joiner ("," or " at") and the space before PM.
    const expected = { text: expect.stringMatching(/^Words refill October 29(,| at) 3:00\sPM$/), planEnds: false };
    expect(usageRefillLine({ kind: "free" }, resets, 500)).toEqual(expected);
    expect(usageRefillLine(describePlan({ plan: "PRO", planExpiresAt: ago2 }, { now }), resets, 500)).toEqual(expected);
  });

  it("falls back when the reset date is unknown", () => {
    expect(usageRefillLine({ kind: "free" }, null, 500)).toEqual({ text: "Words refill soon", planEnds: false });
  });
});
