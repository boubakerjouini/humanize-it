// ===========================================================
// emails/marketing/nurture.tsx — Lead nurture: three value emails, one ask,
// one re-permission email (give, give, give, ask).
// Copy: Growth Kit Email Playbook lead_nurture.2, lead_nurture.3, winback.2
// (the Appeal Kit email) and lead_nurture.4 (FLOW_META.lead_nurture);
// nurture_keep_going follows the spec outline. lead_nurture.4 no longer says
// it is the last email, because the re-permission email follows it.
// ===========================================================

import { EmailLayout } from "@/emails/components/layout";
import { Bullets, Button, Greeting, P, Signature } from "@/emails/components/primitives";
import type { TemplateDef } from "@/emails/registry";
import { CtaAndSignature, FREE_WORDS, Numbered, words } from "@/emails/lifecycle/shared";
import type { MagnetSlug } from "@/lib/growth/constants";
import { MAGNETS } from "@/lib/growth/magnets";
import { magnetDownloadUrl } from "@/lib/email/links";

/** A P.S. that sends the reader back to the magnet they downloaded. */
function MagnetPs({ magnet }: { magnet?: MagnetSlug }) {
  if (!magnet) return null;
  const m = MAGNETS[magnet];
  return <P muted>{`P.S. If you haven't opened your ${m.shortTitle} yet, start with ${m.firstSection}.`}</P>;
}

// lead_nurture.2 — Why careful writers get flagged
export const nurture_why_flags: TemplateDef<"nurture_why_flags"> = {
  subject: () => "Why careful writers get flagged",
  Component: ({ p, ctx }) => (
    <EmailLayout ctx={ctx} preview="What detectors actually measure, in one paragraph.">
      <Greeting ctx={ctx} />
      <P>Here&apos;s the most useful thing I learned building a detector.</P>
      <P>
        Detectors can&apos;t know who wrote a text. Most of them estimate how predictable it is. Text where every
        sentence is a similar length, the words are the safe common ones and the structure is textbook looks
        &quot;machine-like&quot;, whoever wrote it.
      </P>
      <P>
        That&apos;s why careful writers get flagged: people writing in a second language, people trained to write
        formally, people who polish every line. Being careful makes writing more predictable.
      </P>
      <P>The fix isn&apos;t to write worse. It&apos;s to put yourself back in:</P>
      <Bullets
        items={[
          "vary sentence length on purpose,",
          "add one concrete example only you would know,",
          "cut stock phrases like \"it is important to note\".",
        ]}
      />
      <CtaAndSignature href={ctx.link("/blog/ai-detection-how-it-works")}>Read how AI detection works</CtaAndSignature>
      <MagnetPs magnet={p.magnet} />
    </EmailLayout>
  ),
};

// lead_nurture.3 — A use case and a free tool
export const nurture_three_pass: TemplateDef<"nurture_three_pass"> = {
  subject: () => "What I'd do before sending a cover letter",
  Component: ({ ctx }) => (
    <EmailLayout ctx={ctx} preview="A 3-minute check with a free tool. No account needed.">
      <Greeting ctx={ctx} />
      <P>Here&apos;s a concrete use case, because it&apos;s the one I&apos;d use myself.</P>
      <P>
        Say you&apos;re applying for a job. You drafted the cover letter with some help from ChatGPT, then edited it.
        It&apos;s your story and your experience, but it might still read as generic, to a recruiter or to a detector.
      </P>
      <P>Before you send it:</P>
      <Numbered
        items={[
          "Paste it into the free AI detector. No account needed.",
          "Don't fixate on the score. Look at the highlighted sentences and the pattern list.",
          "Rewrite those sentences yourself, with one specific detail: a number, a project name, something only you did.",
          "Check again.",
        ]}
      />
      <P>
        The goal isn&apos;t to fool anyone. It&apos;s to make sure the letter sounds like the person who&apos;ll show
        up to the interview.
      </P>
      <CtaAndSignature href={ctx.link("/ai-detector")}>Try the free detector</CtaAndSignature>
    </EmailLayout>
  ),
};

// winback.2 — The False AI Flag Appeal Kit (or a pointer into it for people who have it)
export const nurture_evidence: TemplateDef<"nurture_evidence"> = {
  subject: () => "If you're ever wrongly flagged as AI",
  Component: ({ p, ctx }) => {
    const kit = MAGNETS["false-ai-flag-appeal-kit"];
    return (
      <EmailLayout ctx={ctx} preview="The email to send, the evidence to gather, what to say.">
        <Greeting ctx={ctx} />
        <P>
          This one isn&apos;t really about HumanizeIt. It&apos;s about people who wrote something themselves and still
          got flagged as AI.
        </P>
        <P>
          It happens more than it should. A Stanford study found that popular detectors labeled most essays by
          non-native English writers as AI-generated (Liang et al., 2023).
        </P>
        {p.hasAppealKit ? (
          <P>
            {`You already have the False AI Flag Appeal Kit. If it ever happens to you, start with ${kit.firstSection}: it tells you what to do first, and what not to touch.`}
          </P>
        ) : (
          <>
            <P>So I put together the False AI Flag Appeal Kit. It&apos;s free, and it has:</P>
            <Bullets
              items={[
                "an email template for a teacher, client or manager,",
                "a checklist of evidence that shows your writing process (version history, drafts, notes),",
                "a short script for the conversation.",
              ]}
            />
          </>
        )}
        <P>
          It won&apos;t make a flag disappear, and it isn&apos;t for defending work you didn&apos;t write. It helps you
          show honest work clearly and calmly.
        </P>
        {p.hasAppealKit ? (
          <CtaAndSignature href={ctx.link(magnetDownloadUrl("false-ai-flag-appeal-kit"))}>
            Open your Appeal Kit
          </CtaAndSignature>
        ) : (
          <CtaAndSignature href={ctx.link("/free/false-ai-flag-appeal-kit")}>Get the Appeal Kit</CtaAndSignature>
        )}
      </EmailLayout>
    );
  },
};

// lead_nurture.4 — Create a free account (the one ask)
export const nurture_free_account: TemplateDef<"nurture_free_account"> = {
  subject: () => "Want to fix flagged sentences in one place?",
  Component: ({ ctx }) => (
    <EmailLayout ctx={ctx} preview="A free account takes 30 seconds. Here's what it adds.">
      <Greeting ctx={ctx} />
      <P>This one is the ask.</P>
      <P>
        {`If the free detector has been useful, a free account adds a workspace where you can check a text, rewrite the flagged parts in a natural tone and check again, side by side. It's free: ${words(FREE_WORDS)} words and one rewrite a day, no card needed.`}
      </P>
      <P>
        If you ever need more, Pro is there. If you don&apos;t, the free plan is genuinely enough for the occasional
        email or cover letter.
      </P>
      <P>Thanks for reading these.</P>
      <CtaAndSignature href={ctx.link("/sign-up")}>Create a free account</CtaAndSignature>
    </EmailLayout>
  ),
};

// Spec outline: re-permission. The unsubscribe link is the button on purpose.
export const nurture_keep_going: TemplateDef<"nurture_keep_going"> = {
  subject: () => "Should I keep sending these?",
  Component: ({ ctx }) => (
    <EmailLayout ctx={ctx} preview="No hard feelings either way.">
      <Greeting ctx={ctx} />
      <P>
        That was the last email in the series you signed up for. From here I send about 2 emails a month: one practical
        tip and, sometimes, an offer.
      </P>
      <P>If that&apos;s useful, you don&apos;t need to do anything. If not, unsubscribe below, no hard feelings.</P>
      {ctx.unsubscribeUrl ? <Button href={ctx.unsubscribeUrl}>Unsubscribe</Button> : null}
      <Signature />
    </EmailLayout>
  ),
};
