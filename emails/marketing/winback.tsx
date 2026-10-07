// ===========================================================
// emails/marketing/winback.tsx — Win-back marketing emails.
// Copy: Growth Kit Email Playbook winback.1 (FLOW_META.winback_inactive), with
// its first bullet driven by WHATS_NEW (passed as props, edited by hand in
// lib/email/whats-new.ts). winback_bonus follows the spec outline; the engine
// sends it only after grantBonusWords() succeeded, and the copy makes no
// expiry promise because that grant's expiry is the engine's choice.
// ===========================================================

import { Link } from "react-email";
import { EmailLayout } from "@/emails/components/layout";
import { BRAND, Bullets, Greeting, P } from "@/emails/components/primitives";
import type { TemplateDef } from "@/emails/registry";
import { CtaAndSignature, words } from "@/emails/lifecycle/shared";

// winback.1 — What's new, plus one free thing
export const winback_one_thing: TemplateDef<"winback_one_thing"> = {
  subject: () => "What changed at HumanizeIt, plus a free guide",
  Component: ({ p, ctx }) => (
    <EmailLayout ctx={ctx} preview="The checker now explains itself. And a guide you can keep.">
      <Greeting ctx={ctx} />
      <P>It&apos;s been a while since you used HumanizeIt, so here&apos;s what changed, in plain terms.</P>
      <Bullets
        items={[
          <>
            <strong>{`${p.headline.replace(/[.!?]+$/, "")}.`}</strong>
            {` ${p.body} `}
            <Link href={ctx.link(p.ctaUrl)} style={{ color: BRAND.color }}>
              {p.ctaLabel}
            </Link>
          </>,
          <>
            <strong>The AI check explains itself.</strong> It looks for about 40 writing patterns and highlights the
            sentences that triggered them, not just a score.
          </>,
          <>
            <strong>Check and rewrite in one place.</strong> The workspace shows the check next to your text, so you
            can fix a flagged sentence and check again.
          </>,
          <>
            <strong>Document upload.</strong> Pro and Team can upload PDF and Word files instead of pasting in chunks.
          </>,
        ]}
      />
      <P>
        And one free thing: the AI Detection Field Guide. It explains what detectors measure, why they misfire on honest
        writers, and how to write so your text sounds like you. You don&apos;t need an account to read it.
      </P>
      <CtaAndSignature href={ctx.link("/free/ai-detection-field-guide")}>Get the free guide</CtaAndSignature>
    </EmailLayout>
  ),
};

// Spec outline: the bonus words were granted before this send.
export const winback_bonus: TemplateDef<"winback_bonus"> = {
  subject: (p) => `I added ${words(p.words)} bonus words to your account`,
  Component: ({ p, ctx }) => (
    <EmailLayout ctx={ctx} preview="No catch. They're already in your account.">
      <Greeting ctx={ctx} />
      <P>{`I added ${words(p.words)} bonus words to your HumanizeIt account. No catch, and nothing to redeem.`}</P>
      <P>
        They&apos;re used automatically for rewrites once your daily allowance runs out. Use them on your next post,
        cover letter or essay draft.
      </P>
      <CtaAndSignature href={ctx.link("/dashboard")}>Use my bonus words</CtaAndSignature>
    </EmailLayout>
  ),
};
