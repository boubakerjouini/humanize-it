// ===========================================================
// lib/growth/referral-rules.ts — When a referral may pay out (pure).
//
// Bonus words are real product value, so every reward passes these rules
// first: the program must be on (REFERRALS_ENABLED), the referral still
// pending, the referee a different person with a verified account, and the
// referrer under the rolling cap. lib/growth/referrals.ts gathers the inputs
// and records the reason of any rejection.
// ===========================================================

/** Rewarded referrals a referrer may earn per rolling REFERRAL_CAP_WINDOW_DAYS. */
export const REFERRAL_CAP = 10;
export const REFERRAL_CAP_WINDOW_DAYS = 30;

export type ReferralRejectReason =
  | "disabled"
  | "not_pending"
  | "self_referral"
  | "same_email"
  | "unverified"
  | "referrer_cap";

export type ReferralCheck = {
  /** Referral.status: pending | rewarded | rejected. */
  status: string;
  /** The referee has an account and Clerk verified its address. */
  refereeVerified: boolean;
  /** Referrer and referee are the same contact. */
  sameContact: boolean;
  /** Both addresses fold to the same inbox (Gmail dots, +tags). */
  sameCanonicalEmail?: boolean;
  /** Referrals this referrer was rewarded for in the cap window. */
  referrerRewardedLast30d: number;
  cap?: number;
  enabled: boolean;
};

export type ReferralVerdict = { ok: true } | { ok: false; reason: ReferralRejectReason };

export function evaluateReferral(input: ReferralCheck): ReferralVerdict {
  if (!input.enabled) return { ok: false, reason: "disabled" };
  if (input.status !== "pending") return { ok: false, reason: "not_pending" };
  if (input.sameContact) return { ok: false, reason: "self_referral" };
  if (input.sameCanonicalEmail) return { ok: false, reason: "same_email" };
  if (!input.refereeVerified) return { ok: false, reason: "unverified" };
  const cap = input.cap ?? REFERRAL_CAP;
  if (input.referrerRewardedLast30d >= cap) return { ok: false, reason: "referrer_cap" };
  return { ok: true };
}
