// ===========================================================
// emails/marketing/offers.tsx — The emails that mention a price: the honest
// Pro note (onboarding), the quota menu and pass (quota_upgrade), the keep-it
// offer and pass midpoint (grant_expiry) and the checkout question.
// Copy: Growth Kit Email Playbook welcome.4, quota_hit.1, quota_hit.2 and
// comped_expiry.2 (FLOW_META playbook mappings); trial_midpoint and
// checkout_help follow the spec outline in the same voice.
//
// Every price and limit comes from props or lib/plans.ts. No email promises a
// detector result, a price lock or a refund beyond /refunds (REFUND_LINE).
// The Free quota is a rolling 24 hours from the last reset, not midnight UTC.
// ===========================================================

import { EmailLayout } from "@/emails/components/layout";
import { Bullets, Greeting, P } from "@/emails/components/primitives";
import type { TemplateDef } from "@/emails/registry";
import {
  CtaAndSignature,
  FREE_WORDS,
  Numbered,
  PLAN_NAMES,
  PRO_HISTORY_DAYS,
  PRO_WORDS,
  REFUND_LINE,
  TEAM_WORDS,
  daysUntil,
  endsWhen,
  fmtDate,
  perMonth,
  usd,
  words,
} from "@/emails/lifecycle/shared";
import { PLANS } from "@/lib/plans";
import { referralsEnabled } from "@/lib/growth/flags";
import { REFERRAL_REWARD_WORDS } from "@/lib/growth/referral-rules";

// welcome.4 — An honest Pro offer (the engine sends it on day 7, only on Free)
export const what_paid_users_do: TemplateDef<"what_paid_users_do"> = {
  subject: () => "Should you upgrade? An honest answer",
  Component: ({ p, ctx }) => (
    <EmailLayout ctx={ctx} preview="Probably not, unless one of these is true.">
      <Greeting ctx={ctx} />
      <P>You&apos;ve had HumanizeIt for a week, so here&apos;s my honest take on Pro.</P>
      <P>
        {`Stay on Free if you check a page now and then. ${words(FREE_WORDS)} words a day covers that, and the AI detector stays free.`}
      </P>
      <P>Pro is worth it if:</P>
      <Bullets
        items={[
          `you write long things (Pro handles ${words(PRO_WORDS)} words a month and lets you upload PDF and Word files),`,
          "you need more than one rewrite a day to get the wording right,",
          `you want more tones, ${PRO_HISTORY_DAYS} days of history and no watermark.`,
        ]}
      />
      <P>
        {`Pro is ${usd(p.proPrice)} a month, or ${usd(p.proAnnual)} for the year (about ${perMonth(p.proAnnual)} a month). ${REFUND_LINE}`}
      </P>
      <P>
        What Pro won&apos;t do: promise that any detector gives a certain result. Nobody honest can. It helps your
        writing read naturally and sound like you.
      </P>
      <CtaAndSignature href={ctx.link("/dashboard/settings")}>Compare Free and Pro</CtaAndSignature>
    </EmailLayout>
  ),
};

// quota_hit.1 — Two ways to get more (the referral line only while referrals are on)
export const limit_hit_menu: TemplateDef<"limit_hit_menu"> = {
  subject: () => "You hit today's limit. Two ways to get more",
  Component: ({ p, ctx }) => {
    const referrals = referralsEnabled();
    return (
      <EmailLayout ctx={ctx} preview="One of them is free.">
        <Greeting ctx={ctx} />
        <P>
          You used your free words for today. That usually means you&apos;re in the middle of something, so here&apos;s
          how to keep going.
        </P>
        <P>
          <strong>The free way.</strong>
          {" Your free allowance resets 24 hours after it last reset, so fresh words are never more than a day away."}
          {referrals
            ? ` And if you invite a friend from your dashboard, you both get ${words(REFERRAL_REWARD_WORDS)} bonus words once they sign up and run their first check.`
            : null}
        </P>
        <P>
          <strong>The paid way.</strong>
          {` Pro gives you ${words(PRO_WORDS)} words a month and unlimited rewrites, for ${usd(p.proPrice)} a month or ${usd(p.proAnnual)} for the year.`}
        </P>
        <P>
          {referrals
            ? "If you're on a deadline today, Pro is the faster fix. If not, the next reset and a referral may be all you need. Both are fine with me."
            : "If you're on a deadline today, Pro is the faster fix. If not, the next reset may be all you need. Both are fine with me."}
        </P>
        <CtaAndSignature href={ctx.link("/dashboard/settings")}>See what Pro includes</CtaAndSignature>
      </EmailLayout>
    );
  },
};

// quota_hit.2 — The annual offer, plus the one-time pass the engine issued for this send
export const trial_offer: TemplateDef<"trial_offer"> = {
  subject: () => "12 months of Pro for less than 9",
  Component: ({ p, ctx }) => {
    const monthly = PLANS.PRO.price;
    const annual = PLANS.PRO.priceAnnual ?? monthly * 12;
    const saving = monthly * 12 - annual;
    return (
      <EmailLayout ctx={ctx} preview="The cheapest way to stop running into the limit.">
        <Greeting ctx={ctx} />
        <P>
          A few days ago you hit the free limit. If that keeps happening, here&apos;s the cheapest way to stop worrying
          about it.
        </P>
        <P>
          {`Pro annual is ${usd(annual)}. Paying monthly for a year would cost ${usd(monthly * 12)}, so annual saves you ${usd(saving)}, which is more than three months free.`}
        </P>
        <P>
          It also comes with a 14-day money-back guarantee. Use it on real work for two weeks. If it doesn&apos;t earn
          its place, email me and you get a full refund.
        </P>
        <P>
          {`You get ${words(PRO_WORDS)} words a month, unlimited rewrites, more tones, PDF and Word upload, and ${PRO_HISTORY_DAYS} days of history.`}
        </P>
        <P>
          {`Rather try it first? Here's a one-time code for ${p.days} days of Pro, no card needed: `}
          <strong>{p.code}</strong>
          {`. Redeem it in Settings before ${fmtDate(p.expiresAt)}: it expires then because I fund a limited number of passes each month.`}
        </P>
        <P>
          {`If ${usd(annual)} is more than you need right now, that's fine too. The free plan and the detector aren't going anywhere.`}
        </P>
        <CtaAndSignature href={ctx.link("/dashboard/settings")}>Get Pro for the year</CtaAndSignature>
      </EmailLayout>
    );
  },
};

// comped_expiry.2 — The honest options, sized to what the account actually used
export const grant_keep_offer: TemplateDef<"grant_keep_offer"> = {
  subject: (p) => `Keeping ${PLAN_NAMES[p.recommended]} after ${fmtDate(p.expiresAt)}: the honest math`,
  Component: ({ p, ctx }) => {
    const plan = PLAN_NAMES[p.plan];
    const recommended = PLAN_NAMES[p.recommended];
    const proAnnual = PLANS.PRO.priceAnnual ?? PLANS.PRO.price * 12;
    return (
      <EmailLayout
        ctx={ctx}
        preview={
          p.recommended === "TEAM"
            ? `Or Pro at ${usd(proAnnual)} a year if you work alone.`
            : "What keeping it costs, and what happens if you don't."
        }
      >
        <Greeting ctx={ctx} />
        <P>{`Your ${plan} access ends ${endsWhen(p.expiresAt, ctx.sentAt)}. Here are the honest options.`}</P>
        <P>
          {`In the last 30 days you used ${words(p.wordsUsed30d)} words. ${recommended} includes ${words(p.recommended === "TEAM" ? TEAM_WORDS : PRO_WORDS)} words a month.`}
        </P>
        <Numbered
          items={[
            <>
              <strong>{`${recommended} annual, ${usd(p.annual)} a year.`}</strong>
              {` That's about ${perMonth(p.annual)} a month instead of ${usd(p.monthly)}.`}
            </>,
            p.recommended === "TEAM" ? (
              <>
                <strong>{`Pro annual, ${usd(proAnnual)} a year,`}</strong>
                {` if you work alone: ${words(PRO_WORDS)} words a month and unlimited rewrites.`}
              </>
            ) : (
              <>
                <strong>{`Pro monthly, ${usd(p.monthly)} a month,`}</strong>
                {" if you'd rather not commit to a year. Cancel any time."}
              </>
            ),
            <>
              <strong>Do nothing.</strong> You move to Free. No charge, no hard feelings.
            </>,
          ]}
        />
        <P>{REFUND_LINE}</P>
        <CtaAndSignature href={ctx.link("/dashboard/settings")}>Choose a plan</CtaAndSignature>
      </EmailLayout>
    );
  },
};

// Spec outline: halfway through a 7-day pass, two things worth trying.
export const trial_midpoint: TemplateDef<"trial_midpoint"> = {
  subject: (p, ctx) => {
    const days = daysUntil(p.expiresAt, ctx.sentAt);
    return days && days > 1
      ? `${days} days left on your Pro pass: try these two things`
      : "Your Pro pass ends soon: try these two things";
  },
  Component: ({ p, ctx }) => (
    <EmailLayout ctx={ctx} preview="Two things that show what Pro is for.">
      <Greeting ctx={ctx} />
      <P>{`Your Pro pass ends on ${fmtDate(p.expiresAt)}. If you only try two things before then, make it these:`}</P>
      <Numbered
        items={[
          "Upload a full PDF or Word file and work through it in one go, instead of pasting it in chunks.",
          "Check, rewrite only the flagged sentences in your own words, then check again. Rewrites are unlimited on Pro.",
        ]}
      />
      <P>If something doesn&apos;t work the way you expected, reply and tell me. I read every reply.</P>
      <CtaAndSignature href={ctx.link("/dashboard")}>Open the editor</CtaAndSignature>
    </EmailLayout>
  ),
};

// Spec outline: one personal question after a started checkout.
export const checkout_help: TemplateDef<"checkout_help"> = {
  subject: () => "Did something stop you at checkout?",
  Component: ({ p, ctx }) => (
    <EmailLayout ctx={ctx} preview="If you have a question, I'll answer it myself.">
      <Greeting ctx={ctx} />
      <P>{`You started a ${PLAN_NAMES[p.plan]} checkout recently and didn't finish it. That's completely fine.`}</P>
      <P>
        If something stopped you, like the price, invoices or the payment methods, reply and I&apos;ll answer
        personally.
      </P>
      <P>
        {`If annual felt like too much, monthly is ${usd(p.monthly)} and you can cancel any time. ${REFUND_LINE}`}
      </P>
      <CtaAndSignature href={ctx.link("/dashboard/settings")}>Resume checkout</CtaAndSignature>
    </EmailLayout>
  ),
};
