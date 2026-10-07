// ===========================================================
// emails/transactional/founding-confirm.tsx — Double opt-in for the
// Founding 100 list (lead source founding_waitlist, captured on /lifetime).
//
// Gated by the doi_confirm flow, like the neutral double opt-in it replaces
// for this source. The confirm link goes to /free/confirmed, which confirms
// the pending topics only on an explicit click.
// ===========================================================

import type { TemplateComponentProps, TemplateDef } from "@/emails/registry";
import { EmailLayout } from "@/emails/components/layout";
import { Button, Greeting, P, Signature } from "@/emails/components/primitives";

function FoundingConfirm({ p, ctx }: TemplateComponentProps<"founding_confirm">) {
  return (
    <EmailLayout ctx={ctx} preview="One click so the Founding 100 email reaches you.">
      <Greeting ctx={ctx} />
      <P>Thanks for asking to hear about the Founding 100 offer. Please confirm below so that email reaches you.</P>
      <Button href={ctx.link(p.confirmUrl)}>Confirm my place on the list</Button>
      <P>
        {
          "Confirming also subscribes you to occasional writing tips and offers from HumanizeIt (about 2 emails a month). You can unsubscribe in one click from any of them."
        }
      </P>
      <P>{"I'm Boubaker. I build HumanizeIt on my own, so if you reply with a question, I'm the one reading it."}</P>
      <P muted>{"If you didn't ask for this, ignore this email and you won't hear from us."}</P>
      <Signature />
    </EmailLayout>
  );
}

export const foundingConfirm: TemplateDef<"founding_confirm"> = {
  subject: () => "Confirm your place on the Founding 100 list",
  Component: FoundingConfirm,
};
