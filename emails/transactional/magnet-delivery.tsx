// ===========================================================
// emails/transactional/magnet-delivery.tsx — Delivers a lead magnet PDF
// (playbook lead_nurture.1). The button opens the thanks page, which shows
// the download and, only if tips were ticked, a "Yes, send me tips" button:
// opening the page confirms nothing on its own.
// ===========================================================

import { Link } from "react-email";
import type { TemplateComponentProps, TemplateDef } from "@/emails/registry";
import { EmailLayout } from "@/emails/components/layout";
import { BRAND, Button, Greeting, P, Signature } from "@/emails/components/primitives";
import { MAGNETS } from "@/lib/growth/magnets";

function MagnetDelivery({ p, ctx }: TemplateComponentProps<"magnet_delivery">) {
  const magnet = MAGNETS[p.magnet];
  return (
    <EmailLayout ctx={ctx} preview="Your download link, and how to get the most from it.">
      <Greeting ctx={ctx} />
      <P>{`Here's the ${magnet.shortTitle} you asked for. The link below works any time, so feel free to keep this email.`}</P>
      <P>
        {`One tip so it doesn't sit unread in your downloads folder: open it now and read just ${magnet.firstSection}. It takes two minutes and covers the part people need most.`}
      </P>
      <Button href={ctx.link(p.confirmUrl)}>{`Download the ${magnet.shortTitle}`}</Button>
      {p.consentPending ? (
        <P>
          {
            "You also ticked the box for writing tips. The download page has a \"Yes, send me tips\" button, and nothing is sent until you click it. If you do, I'll send a few short emails over the next couple of weeks: why careful writers get flagged, a real use case with a free tool, and what a free account adds. You can unsubscribe with one click at the bottom of any of them."
          }
        </P>
      ) : null}
      <P>{"I'm Boubaker. I build HumanizeIt on my own, so if you reply, I'm the one reading it."}</P>
      <Signature />
      <P muted>
        {"Button not working? Open the PDF directly: "}
        <Link href={p.downloadUrl} style={{ color: BRAND.muted, textDecorationLine: "underline" }}>
          {p.downloadUrl}
        </Link>
      </P>
    </EmailLayout>
  );
}

export const magnetDelivery: TemplateDef<"magnet_delivery"> = {
  subject: (p) => `Here's your ${MAGNETS[p.magnet].shortTitle}`,
  Component: MagnetDelivery,
};
