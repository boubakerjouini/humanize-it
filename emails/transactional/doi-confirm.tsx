// ===========================================================
// emails/transactional/doi-confirm.tsx — Neutral double opt-in request for
// pending topics. No promotion on purpose: some EU regulators treat a DOI
// email that advertises as marketing sent without consent.
// ===========================================================

import type { TemplateComponentProps, TemplateDef } from "@/emails/registry";
import { EmailLayout } from "@/emails/components/layout";
import { Button, H1, P } from "@/emails/components/primitives";
import { TOPIC_LABELS, type Topic } from "@/lib/growth/constants";

export function describeTopics(topics: readonly Topic[]): string {
  const labels = [...new Set(topics)].map((t) => TOPIC_LABELS[t]);
  if (labels.length === 0) return "emails from HumanizeIt";
  const list = labels.length === 1 ? labels[0] : `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
  return `HumanizeIt ${list}`;
}

function DoiConfirm({ p, ctx }: TemplateComponentProps<"doi_confirm">) {
  return (
    <EmailLayout ctx={ctx} preview="Please confirm you want these emails.">
      <H1>Confirm your subscription</H1>
      <P>{`Please confirm you want ${describeTopics(p.topics)}. You asked for them at humanizeit.app.`}</P>
      <Button href={ctx.link(p.confirmUrl)}>Confirm subscription</Button>
      <P muted>{"If you didn't ask for this, ignore this email and you won't hear from us. The link expires in 30 days."}</P>
    </EmailLayout>
  );
}

export const doiConfirm: TemplateDef<"doi_confirm"> = {
  subject: () => "Confirm your HumanizeIt subscription",
  Component: DoiConfirm,
};
