// ===========================================================
// emails/marketing/waitlist.tsx — The Chrome extension waitlist update.
// Spec outline (the playbook's extension_waitlist.1 is the confirm email, owned
// by stream C), written in that email's voice: what it is for, no launch date
// promise, no "beats detectors" claim, and a one-word reply as the CTA.
// ===========================================================

import { PlainLayout } from "@/emails/components/layout";
import { Greeting, P } from "@/emails/components/primitives";
import type { TemplateDef } from "@/emails/registry";

export const waitlist_update: TemplateDef<"waitlist_update"> = {
  subject: () => "Extension update #1: what it will (and won't) do",
  Component: ({ ctx }) => (
    <PlainLayout ctx={ctx} preview="What it's for, what it isn't, and one question.">
      <Greeting ctx={ctx} />
      <P>A quick update on the HumanizeIt Chrome extension you joined the waitlist for.</P>
      <P>
        <strong>What it will do:</strong> check your writing right where you write it, in places like Gmail, Google
        Docs, LinkedIn and Notion, and help you polish it so it sounds like you, without copying text into another tab.
      </P>
      <P>
        <strong>What it won&apos;t do:</strong> promise to &quot;beat&quot; any detector. No tool can honestly promise
        that, so I won&apos;t.
      </P>
      <P>
        There&apos;s still no launch date. I&apos;d rather ship it when it works than promise a date and miss it. Until
        then, the free AI detector on the website runs the same kind of check.
      </P>
      <P>
        One favor: reply with the one site you&apos;d use it on most. I&apos;ll make sure version 1 works there first.
      </P>
    </PlainLayout>
  ),
};
