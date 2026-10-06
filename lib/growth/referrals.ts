// ===========================================================
// lib/growth/referrals.ts — STUB created by stream F. Owned by stream D, which
// implements the referral program behind REFERRALS_ENABLED (default off):
// codes on Contact.referralCode, pending referrals at signup, and the reward
// (bonus words for both sides) when the referee runs a first document. The
// signatures are what lib/crm/hooks.ts already calls: keep them.
// ===========================================================
/* eslint-disable @typescript-eslint/no-unused-vars -- stub bodies; stream D implements them */

/** Bonus words each side gets when a referral qualifies. */
export const REFERRAL_REWARD_WORDS = 3000;

/** Record a pending referral when a referred visitor signs up. Never throws. */
export async function attachReferralOnSignup(refereeContactId: string, code: string): Promise<void> {}

/** The referee ran a first document: reward both sides if the rules allow. Never throws. */
export async function qualifyReferral(refereeContactId: string): Promise<void> {}

/** The contact's referral code, created on first use. */
export async function getOrCreateReferralCode(contactId: string): Promise<string> {
  throw new Error("Referral codes are not implemented yet (stream D).");
}
