// ===========================================================
// emails/transactional/waitlist-confirm.tsx — Double opt-in for the Chrome
// extension waitlist (playbook extension_waitlist.1, with the confirm button
// as its one call to action). The extension is not released; say so.
// ===========================================================

import type { TemplateComponentProps, TemplateDef } from "@/emails/registry";
import { EmailLayout } from "@/emails/components/layout";
import { Button, Greeting, P, Signature } from "@/emails/components/primitives";

function WaitlistConfirm({ p, ctx }: TemplateComponentProps<"waitlist_confirm">) {
  return (
    <EmailLayout ctx={ctx} preview="One click so the launch email reaches you.">
      <Greeting ctx={ctx} />
      <P>
        Thanks for joining the waitlist for the HumanizeIt Chrome extension. Please confirm below so the launch email
        reaches you.
      </P>
      <Button href={ctx.link(p.confirmUrl)}>Confirm my spot</Button>
      <P>The goal is simple: check your writing right where you write it, without copying text into another tab.</P>
      <P>
        {
          "There's no launch date yet. I'd rather ship it when it works than promise a date and miss it. Once you confirm, you'll get a few short updates and one email on launch day, and you can unsubscribe in one click at any time."
        }
      </P>
      <P>Until then, the free AI detector on the website runs the same kind of check.</P>
      <P>
        One favor: reply with the one place you write most (Gmail, Google Docs, LinkedIn, somewhere else). I&apos;ll
        make sure it works there first.
      </P>
      <P muted>{"If you didn't ask for this, ignore this email and you won't hear from us."}</P>
      <Signature />
    </EmailLayout>
  );
}

export const waitlistConfirm: TemplateDef<"waitlist_confirm"> = {
  subject: () => "Confirm your spot on the Chrome extension list",
  Component: WaitlistConfirm,
};
