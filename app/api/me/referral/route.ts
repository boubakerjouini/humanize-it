// ===========================================================
// GET /api/me/referral — The signed-in user's referral card data
//
// { enabled, code, link, rewardWords, referred, rewarded, bonusWords }. The
// code is created on first call. With REFERRALS_ENABLED off, no code is made
// and the UI hides every referral surface.
// ===========================================================

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { ensureUser } from "@/lib/user";
import { bonusBalance } from "@/lib/crm/bonus";
import { getOrCreateContactForUser } from "@/lib/crm/contacts";
import { referralsEnabled } from "@/lib/growth/flags";
import { REFERRAL_REWARD_WORDS, getOrCreateReferralCode, referralLink, referralStats } from "@/lib/growth/referrals";

export async function GET() {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Authentication required." } },
        { status: 401 }
      );
    }

    const user = await ensureUser(clerkId);
    const bonus = await bonusBalance(user.id);
    const disabled = {
      enabled: false,
      code: null,
      link: null,
      rewardWords: REFERRAL_REWARD_WORDS,
      referred: 0,
      rewarded: 0,
      bonusWords: bonus.words,
    };
    if (!referralsEnabled()) return NextResponse.json(disabled);

    const contactId = await getOrCreateContactForUser(user.id);
    if (!contactId) return NextResponse.json(disabled);

    const code = await getOrCreateReferralCode(contactId);
    const stats = await referralStats(contactId);
    return NextResponse.json({
      enabled: true,
      code,
      link: referralLink(code),
      rewardWords: REFERRAL_REWARD_WORDS,
      referred: stats.referred,
      rewarded: stats.rewarded,
      bonusWords: bonus.words,
    });
  } catch (err) {
    console.error("[me/referral] error:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Something went wrong." } },
      { status: 500 }
    );
  }
}
