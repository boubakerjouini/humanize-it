// ===========================================================
// emails/lifecycle/winback.tsx — The win-back sequence's account email.
// Copy: Growth Kit Email Playbook winback.3 ("Should I stop emailing you?"),
// merged with the spec's no-pitch question. The playbook's "Keep me on the
// list" button relied on click tracking, which was cut, so this version asks
// for a reply instead and promises nothing a click would have to honor.
// ===========================================================

import { PlainLayout } from "@/emails/components/layout";
import { Greeting, P } from "@/emails/components/primitives";
import type { TemplateDef } from "@/emails/registry";

export const winback_ask: TemplateDef<"winback_ask"> = {
  subject: () => "Should I stop emailing you?",
  Component: ({ ctx }) => (
    <PlainLayout ctx={ctx} preview="No hard feelings either way.">
      <Greeting ctx={ctx} />
      <P>
        I&apos;ve sent you a couple of emails and haven&apos;t heard back, which is completely fine. Inboxes are full.
      </P>
      <P>
        I don&apos;t want to be one more sender you ignore, so this is the last one in this series. Your account stays
        open, and the free detector is there whenever you need it.
      </P>
      <P>
        One question before I go quiet, and no pitch: was it the free limits, the quality, or did you just not need it?
        A one-word reply helps me fix the right thing.
      </P>
    </PlainLayout>
  ),
};
