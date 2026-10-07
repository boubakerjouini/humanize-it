// ===========================================================
// lib/growth/referrals.ts — The referral program, behind REFERRALS_ENABLED
// (default off).
//
// A contact's code lives on Contact.referralCode (8 Crockford base32
// characters, the only shape `?ref=` capture accepts). A referred signup
// creates a pending Referral; the referee's first document qualifies it, and
// both sides get REFERRAL_REWARD_WORDS bonus words. Rewards are keyed by the
// referral id, so a replay can never pay twice, and every rejection is
// recorded with its reason. Nothing here throws into a caller.
// ===========================================================

import { randomInt } from "node:crypto";
import { db } from "@/lib/db";
import { grantBonusWords } from "@/lib/crm/bonus";
import { recordEvent } from "@/lib/crm/events";
import { canonicalHash } from "@/lib/email/address";
import { REFERRAL_CODE_ALPHABET, REFERRAL_CODE_LENGTH, normalizeRef } from "@/lib/growth/attribution";
import { appUrl, referralsEnabled } from "@/lib/growth/flags";
import { REFERRAL_CAP_WINDOW_DAYS, REFERRAL_REWARD_WORDS, evaluateReferral } from "@/lib/growth/referral-rules";
import { isUniqueViolation, logGrowthError } from "@/lib/growth/safe";

export { REFERRAL_REWARD_WORDS };

const CODE_ATTEMPTS = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

function randomCode(): string {
  let code = "";
  for (let i = 0; i < REFERRAL_CODE_LENGTH; i++) code += REFERRAL_CODE_ALPHABET[randomInt(REFERRAL_CODE_ALPHABET.length)];
  return code;
}

/** Shareable link for a code: /r/<code> redirects to sign-up with ?ref=. */
export function referralLink(code: string): string {
  return `${appUrl()}/r/${code}`;
}

/** The contact's referral code, created on first use. Throws when the contact is missing. */
export async function getOrCreateReferralCode(contactId: string): Promise<string> {
  for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt++) {
    const contact = await db.contact.findUnique({ where: { id: contactId }, select: { referralCode: true } });
    if (!contact) throw new Error("contact not found");
    if (contact.referralCode) return contact.referralCode;
    try {
      // Conditional: a concurrent request that set a code first wins, and we re-read it.
      await db.contact.updateMany({ where: { id: contactId, referralCode: null }, data: { referralCode: randomCode() } });
    } catch (err) {
      // Another contact already holds this code: draw again.
      if (!isUniqueViolation(err)) throw err;
    }
  }
  throw new Error("could not allocate a referral code");
}

/** Referral counts for the in-app card. Zeros on error. */
export async function referralStats(contactId: string): Promise<{ referred: number; rewarded: number }> {
  try {
    const [referred, rewarded] = await Promise.all([
      db.referral.count({ where: { referrerContactId: contactId } }),
      db.referral.count({ where: { referrerContactId: contactId, status: "rewarded" } }),
    ]);
    return { referred, rewarded };
  } catch (err) {
    logGrowthError("referral-stats", err);
    return { referred: 0, rewarded: 0 };
  }
}

function sameInbox(a: string | null, b: string | null): boolean {
  return !!a && !!b && canonicalHash(a) === canonicalHash(b);
}

/** Record a pending referral when a referred visitor signs up. Never throws. */
export async function attachReferralOnSignup(refereeContactId: string, code: string): Promise<void> {
  try {
    if (!referralsEnabled()) return;
    const ref = normalizeRef(code);
    if (!ref) return;
    const [referrer, referee] = await Promise.all([
      db.contact.findUnique({ where: { referralCode: ref }, select: { id: true, email: true } }),
      db.contact.findUnique({ where: { id: refereeContactId }, select: { id: true, email: true } }),
    ]);
    if (!referrer || !referee) return;

    const selfReason = referrer.id === referee.id ? "self_referral" : sameInbox(referrer.email, referee.email) ? "same_email" : null;
    if (selfReason) {
      await recordEvent({
        contactId: referee.id,
        type: "referral_rejected",
        dedupeKey: `referral_rejected:signup:${referee.id}`,
        props: { reason: selfReason, stage: "signup" },
      });
      return;
    }

    let referralId: string;
    try {
      const row = await db.referral.create({
        data: { referrerContactId: referrer.id, refereeContactId: referee.id, code: ref },
        select: { id: true },
      });
      referralId = row.id;
    } catch (err) {
      // One referral per referee, ever: a second signup hook is a no-op.
      if (isUniqueViolation(err)) return;
      throw err;
    }
    // The referrer's timeline gets the referral id only, never the friend's address.
    await recordEvent({
      contactId: referrer.id,
      type: "referral_signup",
      dedupeKey: `referral_signup:${referralId}`,
      props: { referralId },
    });
  } catch (err) {
    logGrowthError("referral-attach", err);
  }
}

/** The referee ran a first document: reward both sides if the rules allow. Never throws. */
export async function qualifyReferral(refereeContactId: string): Promise<void> {
  try {
    if (!referralsEnabled()) return;
    const referral = await db.referral.findUnique({
      where: { refereeContactId },
      select: {
        id: true,
        status: true,
        referrerContactId: true,
        referrer: { select: { email: true } },
        referee: { select: { email: true, userId: true, emailVerifiedAt: true } },
      },
    });
    if (!referral || referral.status !== "pending") return;

    const now = new Date();
    const rewardedRecently = await db.referral.count({
      where: {
        referrerContactId: referral.referrerContactId,
        status: "rewarded",
        rewardedAt: { gte: new Date(now.getTime() - REFERRAL_CAP_WINDOW_DAYS * DAY_MS) },
      },
    });
    const verdict = evaluateReferral({
      status: referral.status,
      refereeVerified: !!referral.referee.userId && !!referral.referee.emailVerifiedAt,
      sameContact: referral.referrerContactId === refereeContactId,
      sameCanonicalEmail: sameInbox(referral.referrer.email, referral.referee.email),
      referrerRewardedLast30d: rewardedRecently,
      enabled: true,
    });

    if (!verdict.ok) {
      const res = await db.referral.updateMany({
        where: { id: referral.id, status: "pending" },
        data: { status: "rejected", rejectReason: verdict.reason },
      });
      if (res.count === 1) {
        await recordEvent({
          contactId: referral.referrerContactId,
          type: "referral_rejected",
          dedupeKey: `referral_rejected:${referral.id}`,
          props: { referralId: referral.id, reason: verdict.reason },
        });
      }
      return;
    }

    // Claim first: only the call that moves pending → rewarded pays out.
    const claim = await db.referral.updateMany({
      where: { id: referral.id, status: "pending" },
      data: { status: "rewarded", rewardWords: REFERRAL_REWARD_WORDS, rewardedAt: now },
    });
    if (claim.count !== 1) return;

    const sides = [
      { role: "referrer" as const, contactId: referral.referrerContactId },
      { role: "referee" as const, contactId: refereeContactId },
    ];
    const granted = await Promise.all(
      sides.map((side) =>
        grantBonusWords(side.contactId, REFERRAL_REWARD_WORDS, "referral", `ref:${referral.id}:${side.role}`, {
          props: { referralId: referral.id, role: side.role },
        })
      )
    );
    if (granted.some((ok) => !ok)) {
      // The dedupe keys make a manual re-grant safe; nothing else retries this.
      logGrowthError("referral-grant", new Error(`grant incomplete for referral ${referral.id}`));
    }
    await recordEvent({
      contactId: referral.referrerContactId,
      type: "referral_rewarded",
      dedupeKey: `referral_rewarded:${referral.id}`,
      props: { referralId: referral.id, words: REFERRAL_REWARD_WORDS },
    });

    // Lazy: the send pipeline pulls in the renderer, which this module's callers don't need.
    const { sendEmail } = await import("@/lib/email/send");
    for (const [i, side] of sides.entries()) {
      if (!granted[i]) continue;
      await sendEmail({
        contactId: side.contactId,
        template: "referral_reward",
        props: { words: REFERRAL_REWARD_WORDS, role: side.role },
        dedupeKey: `referral_reward:${referral.id}:${side.role}`,
        pool: "inline",
      });
    }
  } catch (err) {
    logGrowthError("referral-qualify", err);
  }
}
