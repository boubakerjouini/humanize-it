// ===========================================================
// emails/lifecycle/referral.tsx — The referral reward notice (both sides).
// Spec outline (no playbook email). Sent by lib/growth/referrals.ts only after
// the grant succeeded, and never names the other person or their address.
// Referral grants have no expiry, which is why the copy may say so.
// ===========================================================

import { EmailLayout } from "@/emails/components/layout";
import { Greeting, P } from "@/emails/components/primitives";
import type { TemplateDef } from "@/emails/registry";
import { CtaAndSignature, words } from "@/emails/lifecycle/shared";

export const referral_reward: TemplateDef<"referral_reward"> = {
  subject: (p) => `${words(p.words)} bonus words added to your account`,
  Component: ({ p, ctx }) =>
    p.role === "referrer" ? (
      <EmailLayout ctx={ctx} preview="Your friend ran their first check.">
        <Greeting ctx={ctx} />
        <P>
          {`A friend you invited just ran their first check on HumanizeIt, so you both got ${words(p.words)} bonus words. Thank you for passing it on.`}
        </P>
        <P>
          Bonus words never expire. They&apos;re used automatically once your plan&apos;s word allowance runs out.
        </P>
        <CtaAndSignature href={ctx.link("/dashboard/settings#invite")}>Invite another friend</CtaAndSignature>
      </EmailLayout>
    ) : (
      <EmailLayout ctx={ctx} preview="A welcome bonus, because a friend invited you.">
        <Greeting ctx={ctx} />
        <P>{`Welcome bonus: ${words(p.words)} words, because a friend invited you to HumanizeIt.`}</P>
        <P>
          Bonus words never expire. They&apos;re used automatically for rewrites once your daily allowance runs out.
        </P>
        <CtaAndSignature href={ctx.link("/dashboard")}>Open the editor</CtaAndSignature>
      </EmailLayout>
    ),
};
