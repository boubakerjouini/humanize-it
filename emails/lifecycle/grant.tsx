// ===========================================================
// emails/lifecycle/grant.tsx — Grant-expiry account notices.
// Copy: Growth Kit Email Playbook comped_expiry.1 and .3
// (FLOW_META.grant_expiry.playbook), generalized from "Team access you
// redeemed" to any complimentary plan or pass. grant_ended and grant_feedback
// follow the spec outline in the same voice.
//
// Honesty rules applied: after the downgrade a Free account sees its newest 5
// documents in History, so no email says "everything stays". No price-lock
// promise (comped_expiry.2's) appears anywhere: we can't verify we'd honor it.
// ===========================================================

import { EmailLayout, PlainLayout } from "@/emails/components/layout";
import { Greeting, P } from "@/emails/components/primitives";
import type { TemplateDef } from "@/emails/registry";
import {
  CtaAndSignature,
  FREE_HISTORY_DOCS,
  FREE_WORDS,
  PLAN_NAMES,
  PRO_WORDS,
  TEAM_WORDS,
  endsWhen,
  fmtDate,
  words,
} from "@/emails/lifecycle/shared";

function planWords(plan: "PRO" | "TEAM"): number {
  return plan === "TEAM" ? TEAM_WORDS : PRO_WORDS;
}

// comped_expiry.1 — What you keep and what you lose
export const grant_ending_notice: TemplateDef<"grant_ending_notice"> = {
  subject: (p, ctx) => `Your ${PLAN_NAMES[p.plan]} access ends ${endsWhen(p.expiresAt, ctx.sentAt)}`,
  Component: ({ p, ctx }) => {
    const plan = PLAN_NAMES[p.plan];
    return (
      <EmailLayout ctx={ctx} preview="What stays, what goes, and no surprise charges.">
        <Greeting ctx={ctx} />
        <P>
          {`A quick heads-up: the complimentary ${plan} access on your account ends on ${fmtDate(p.expiresAt)}. Nothing will be charged. Your account simply moves to the Free plan.`}
        </P>
        <P>
          <strong>What you keep:</strong>
          {` your account, the free AI detector, ${words(FREE_WORDS)} words a day with one rewrite, and your newest ${FREE_HISTORY_DOCS} documents in History.`}
        </P>
        <P>
          <strong>What you lose:</strong>
          {` ${words(planWords(p.plan))} words a month, unlimited rewrites, all 5 tones and Voice Match, older History, PDF and Word upload, and API access.`}
        </P>
        <P>
          If HumanizeIt became part of your work, I&apos;d rather you keep it than lose your setup. The options are on
          your plan page.
        </P>
        <P>And if it didn&apos;t, I&apos;d really like to know why. Reply with one line and I&apos;ll read it myself.</P>
        <CtaAndSignature href={ctx.link("/dashboard/settings")}>Review your plan</CtaAndSignature>
      </EmailLayout>
    );
  },
};

// comped_expiry.3 — A personal note
export const grant_ends_tomorrow: TemplateDef<"grant_ends_tomorrow"> = {
  subject: () => "Before your access ends tomorrow",
  Component: ({ p, ctx }) => {
    const plan = PLAN_NAMES[p.plan];
    return (
      <EmailLayout ctx={ctx} preview="Thank you, and one question.">
        <Greeting ctx={ctx} />
        <P>{`Your ${plan} access ends tomorrow, so I wanted this one to be a note, not a sales email.`}</P>
        <P>
          Thank you for giving HumanizeIt a real try. For something built by one person, that matters a lot.
        </P>
        <P>
          Could you answer one question by replying?{" "}
          <strong>What would HumanizeIt need to do for you to pay for it?</strong> One line is plenty. I read every
          answer, and the next version gets built from them.
        </P>
        <P>
          {`Either way, your account stays open on the Free plan, with your newest ${FREE_HISTORY_DOCS} documents in History.`}
        </P>
        <CtaAndSignature href={ctx.link("/dashboard/settings")}>Review your plan</CtaAndSignature>
      </EmailLayout>
    );
  },
};

// Spec outline: the neutral "it happened" notice.
export const grant_ended: TemplateDef<"grant_ended"> = {
  subject: () => "Your account is now on the Free plan",
  Component: ({ p, ctx }) => (
    <EmailLayout ctx={ctx} preview="What changed, and what you still have.">
      <Greeting ctx={ctx} />
      <P>
        {`Your complimentary ${PLAN_NAMES[p.plan]} access ended on ${fmtDate(p.expiresAt)}, so your account is now on the Free plan: ${words(FREE_WORDS)} words and one rewrite a day, plus the free AI detector.`}
      </P>
      <P>
        {`Your newest ${FREE_HISTORY_DOCS} documents are still in History.`}
      </P>
      <P>Think this is a mistake? Just reply and I&apos;ll look into it myself.</P>
      <CtaAndSignature href={ctx.link("/dashboard")}>Open HumanizeIt</CtaAndSignature>
    </EmailLayout>
  ),
};

// Spec outline: an exit interview, no offer.
export const grant_feedback: TemplateDef<"grant_feedback"> = {
  subject: (p) => `Was ${PLAN_NAMES[p.plan]} worth it? (2 questions)`,
  Component: ({ p, ctx }) => (
    <PlainLayout ctx={ctx} preview="One line is plenty.">
      <Greeting ctx={ctx} />
      <P>{`You had ${PLAN_NAMES[p.plan]} for a while, and I'd love two quick answers:`}</P>
      <P>1) What did you use it for?</P>
      <P>2) What would make it worth paying for?</P>
      <P>One line is plenty. Just hit reply; I read every answer myself.</P>
    </PlainLayout>
  ),
};
