// ===========================================================
// emails/lifecycle/onboarding.tsx — Onboarding sequence, account emails.
// Copy: Growth Kit Email Playbook welcome.1–3 (FLOW_META.onboarding.playbook),
// founder_checkin from the spec outline. what_paid_users_do (welcome.4) is a
// marketing email and lives in emails/marketing/onboarding.tsx.
// ===========================================================

import { EmailLayout, PlainLayout } from "@/emails/components/layout";
import { Bullets, Greeting, P } from "@/emails/components/primitives";
import type { TemplateDef } from "@/emails/registry";
import { CtaAndSignature, FREE_WORDS, Numbered, words } from "@/emails/lifecycle/shared";

// welcome.1 — Run your first check
export const welcome: TemplateDef<"welcome"> = {
  subject: () => "Your account is ready. Try this first",
  Component: ({ ctx }) => (
    <EmailLayout ctx={ctx} preview="One 30-second check that shows how your writing reads.">
      <Greeting ctx={ctx} />
      <P>Thanks for signing up. I&apos;m Boubaker, and I build HumanizeIt on my own, so this email really is from me.</P>
      <P>
        Here&apos;s the one thing to try first. Paste something you wrote yourself, like an email, a cover letter or a
        paragraph of an essay, and run the AI check.
      </P>
      <P>
        You&apos;ll get a score, but the useful part is underneath: the exact sentences and patterns that make text read
        as machine-written. Repeated sentence openers. Stock transitions. Sentences that are all the same length.
      </P>
      <P>Most people are surprised by what shows up in their own writing. That&apos;s normal, and it&apos;s fixable.</P>
      <P>
        {`Checks are free and never use words. Your free plan adds ${words(FREE_WORDS)} words of rewriting a day (one rewrite a day). That's enough to fix a full page.`}
      </P>
      <P>If anything breaks or confuses you, just reply. I read every reply.</P>
      <CtaAndSignature href={ctx.link("/dashboard")}>Run your first check</CtaAndSignature>
    </EmailLayout>
  ),
};

// welcome.2 — The patterns detectors flag most
export const check_before_submit: TemplateDef<"check_before_submit"> = {
  subject: () => "5 habits that make writing read as AI",
  Component: ({ ctx }) => (
    <EmailLayout ctx={ctx} preview="Careful human writers have them too. Here's how to fix each one.">
      <Greeting ctx={ctx} />
      <P>
        Our checker looks for about 40 writing patterns. Here are five that are easy to spot and easy to fix, whether
        the draft came from you or from ChatGPT:
      </P>
      <Numbered
        items={[
          <>
            <strong>Stock transitions.</strong> &quot;Furthermore&quot;, &quot;Moreover&quot;, &quot;In
            conclusion&quot;. Use &quot;and&quot;, &quot;but&quot;, &quot;so&quot;, or nothing at all.
          </>,
          <>
            <strong>Same-length sentences.</strong> Real writing mixes short and long. Read it aloud. If it sounds like
            a metronome, split one sentence or join two.
          </>,
          <>
            <strong>Same first word.</strong> Three sentences in a row that start with &quot;This&quot; or
            &quot;The&quot;.
          </>,
          <>
            <strong>Hedging everything.</strong> &quot;It is important to note that&quot; adds nothing. Say the thing.
          </>,
          <>
            <strong>No you in it.</strong> No opinion, no example, no question. Add one detail only you would know.
          </>,
        ]}
      />
      <P>
        Fixing these makes your writing sound more like you. No tool can promise what a detector will say, but this is
        the part you control.
      </P>
      <CtaAndSignature href={ctx.link("/dashboard")}>Check a paragraph for these</CtaAndSignature>
    </EmailLayout>
  ),
};

// welcome.3 — A 2-minute start (the engine sends it only without a document)
export const first_run_nudge: TemplateDef<"first_run_nudge"> = {
  subject: () => "Stuck? Here's a 2-minute start",
  Component: ({ ctx }) => (
    <EmailLayout ctx={ctx} preview="No essay needed. Use the last email you wrote.">
      <Greeting ctx={ctx} />
      <P>
        I noticed you haven&apos;t run anything through HumanizeIt yet. No pressure. But if something got in the way,
        I&apos;d like to know.
      </P>
      <P>If you&apos;re not sure what to try, here&apos;s a 2-minute start:</P>
      <Numbered
        items={[
          "Copy the last long email or message you wrote.",
          "Paste it into HumanizeIt and run the check.",
          "Look at the highlighted sentences and the pattern list underneath.",
        ]}
      />
      <P>
        That&apos;s it. You don&apos;t have to rewrite anything. Just seeing why a sentence gets flagged makes the next
        thing you write better.
      </P>
      <P>
        And if the tool was confusing, hit reply and tell me where you got stuck. One sentence is enough. I&apos;m a
        solo founder, so your answer decides what I fix next.
      </P>
      <CtaAndSignature href={ctx.link("/dashboard")}>Open HumanizeIt</CtaAndSignature>
    </EmailLayout>
  ),
};

// Spec outline (no playbook email): a plain founder question, answered by reply.
export const founder_checkin: TemplateDef<"founder_checkin"> = {
  subject: () => "Quick question (a one-line reply is perfect)",
  Component: ({ ctx }) => (
    <PlainLayout ctx={ctx} preview="What are you using HumanizeIt for?">
      <Greeting ctx={ctx} />
      <P>What are you using HumanizeIt for?</P>
      <Bullets items={["school", "work", "job applications", "something else"]} />
      <P>
        I decide what to build next from these replies, so one line really helps. Just hit reply; I read every one.
      </P>
    </PlainLayout>
  ),
};
