import { REFERRAL_CAP, evaluateReferral, type ReferralCheck } from "@/lib/growth/referral-rules";

const base: ReferralCheck = {
  status: "pending",
  refereeVerified: true,
  sameContact: false,
  sameCanonicalEmail: false,
  referrerRewardedLast30d: 0,
  enabled: true,
};

describe("evaluateReferral", () => {
  it("rewards a pending referral of a different, verified person under the cap", () => {
    expect(evaluateReferral(base)).toEqual({ ok: true });
  });

  it("rewards nothing while the program is off", () => {
    expect(evaluateReferral({ ...base, enabled: false })).toEqual({ ok: false, reason: "disabled" });
  });

  it("checks the switch before anything else", () => {
    expect(evaluateReferral({ ...base, enabled: false, sameContact: true, status: "rewarded" })).toEqual({
      ok: false,
      reason: "disabled",
    });
  });

  it("rewards each referee at most once", () => {
    expect(evaluateReferral({ ...base, status: "rewarded" })).toEqual({ ok: false, reason: "not_pending" });
    expect(evaluateReferral({ ...base, status: "rejected" })).toEqual({ ok: false, reason: "not_pending" });
  });

  it("rejects self-referral, including the same inbox under an alias", () => {
    expect(evaluateReferral({ ...base, sameContact: true })).toEqual({ ok: false, reason: "self_referral" });
    expect(evaluateReferral({ ...base, sameCanonicalEmail: true })).toEqual({ ok: false, reason: "same_email" });
  });

  it("requires a verified referee", () => {
    expect(evaluateReferral({ ...base, refereeVerified: false })).toEqual({ ok: false, reason: "unverified" });
  });

  it("enforces the 10 per 30 days referrer cap", () => {
    expect(REFERRAL_CAP).toBe(10);
    expect(evaluateReferral({ ...base, referrerRewardedLast30d: 9 })).toEqual({ ok: true });
    expect(evaluateReferral({ ...base, referrerRewardedLast30d: 10 })).toEqual({ ok: false, reason: "referrer_cap" });
    expect(evaluateReferral({ ...base, referrerRewardedLast30d: 25 })).toEqual({ ok: false, reason: "referrer_cap" });
  });

  it("accepts a custom cap", () => {
    expect(evaluateReferral({ ...base, cap: 2, referrerRewardedLast30d: 2 })).toEqual({ ok: false, reason: "referrer_cap" });
  });
});
