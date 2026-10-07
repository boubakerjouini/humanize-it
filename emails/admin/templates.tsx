// ===========================================================
// emails/admin/templates.tsx — The admin-written templates: a campaign in the
// branded layout, a personal note in the founder's plain layout (which adds
// the signature, so the note shouldn't sign itself).
// ===========================================================

import { EmailLayout, PlainLayout } from "@/emails/components/layout";
import type { TemplateDef } from "@/emails/registry";
import { MarkdownBody, fillFirstNamePlain } from "@/emails/admin/markdown-body";

export const campaign: TemplateDef<"campaign"> = {
  subject: (p, ctx) => fillFirstNamePlain(p.subject, ctx),
  Component: ({ p, ctx }) => (
    <EmailLayout ctx={ctx} preview={p.preheader ? fillFirstNamePlain(p.preheader, ctx) : undefined}>
      <MarkdownBody bodyMd={p.bodyMd} ctx={ctx} />
    </EmailLayout>
  ),
};

export const personal_note: TemplateDef<"personal_note"> = {
  subject: (p, ctx) => fillFirstNamePlain(p.subject, ctx),
  Component: ({ p, ctx }) => (
    <PlainLayout ctx={ctx}>
      <MarkdownBody bodyMd={p.bodyMd} ctx={ctx} />
    </PlainLayout>
  ),
};
