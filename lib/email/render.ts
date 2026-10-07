// ===========================================================
// lib/email/render.ts — Turn a catalog template + props into subject, HTML and
// plain text with react-email. RenderCtx carries everything a template needs
// besides its props: links, the footer reason, the unsubscribe and preference
// URLs, and the postal address.
//
// Templates must import helpers from emails/components/*, not from this file:
// this module imports the registry, so importing it back would form a cycle.
// ===========================================================

import { createElement } from "react";
import { render } from "react-email";
import { getTemplate } from "@/emails/registry";
import { TEMPLATES, type TemplateKey, type TemplateProps } from "@/lib/email/catalog";
import { preferencesUrl, unsubscribePageUrl, withUtm } from "@/lib/email/links";
import type { UnsubScope } from "@/lib/email/tokens";
import { TOPIC_LABELS, type EmailStream, type Topic } from "@/lib/growth/constants";
import { appUrl, postalAddress } from "@/lib/growth/flags";

export type RenderCtx = {
  appUrl: string;
  stream: EmailStream;
  topic: Topic | null;
  template: TemplateKey;
  /** null → copy says "there". */
  firstName: string | null;
  /** Absolute URL with UTMs for links on our own site; external links pass through. */
  link: (pathOrUrl: string) => string;
  /** Footer "Unsubscribe" (preference center with the unsubscribe action highlighted). */
  unsubscribeUrl: string | null;
  preferencesUrl: string | null;
  postalAddress: string | null;
  /** Why the recipient gets this email (footer). */
  reason: string;
  sentAt: Date;
};

export type RenderedEmail = { subject: string; html: string; text: string };

export class TemplateNotImplementedError extends Error {
  readonly template: string;
  constructor(template: string) {
    super(`Email template "${template}" is not implemented`);
    this.name = "TemplateNotImplementedError";
    this.template = template;
  }
}

export function reasonFor(stream: EmailStream, topic: Topic | null): string {
  switch (stream) {
    case "transactional":
      return "You requested this at humanizeit.app.";
    case "lifecycle":
      return "You're receiving this because you have a HumanizeIt account.";
    case "marketing":
      return `You're receiving this because you subscribed to HumanizeIt ${topic ? TOPIC_LABELS[topic] : "emails"}.`;
    case "personal":
      return "A personal note from the founder of HumanizeIt.";
  }
}

/** First word of a display name, for greetings. */
export function firstNameFrom(name: string | null | undefined): string | null {
  const first = name?.trim().split(/\s+/)[0];
  return first ? first.slice(0, 40) : null;
}

/** Which unsubscribe a footer link performs for a stream. */
export function unsubscribeScopeFor(stream: EmailStream): UnsubScope {
  if (stream === "marketing") return "marketing";
  if (stream === "lifecycle") return "lifecycle";
  return "all";
}

/** Signing needs EMAIL_TOKEN_SECRET; previews without it render without the links. */
function trySign(fn: () => string): string | null {
  try {
    return fn();
  } catch {
    return null;
  }
}

export function buildRenderCtx(opts: {
  contactId: string | null;
  template: TemplateKey;
  /** Overrides the catalog stream (rarely needed). */
  stream?: EmailStream;
  /** Marketing topic; campaigns pass theirs. Defaults to the catalog topic. */
  topic?: Topic | null;
  firstName?: string | null;
  sentAt?: Date;
}): RenderCtx {
  const meta = TEMPLATES[opts.template];
  const stream = opts.stream ?? meta.stream;
  const topic = opts.topic ?? meta.topic;
  const contactId = opts.contactId;
  const medium = stream;
  const campaign = opts.template;
  return {
    appUrl: appUrl(),
    stream,
    topic,
    template: opts.template,
    firstName: opts.firstName?.trim() || null,
    link: (pathOrUrl) => withUtm(pathOrUrl, { medium, campaign }),
    unsubscribeUrl: contactId ? trySign(() => unsubscribePageUrl(contactId, unsubscribeScopeFor(stream))) : null,
    preferencesUrl: contactId ? trySign(() => preferencesUrl(contactId)) : null,
    postalAddress: postalAddress(),
    reason: reasonFor(stream, topic),
    sentAt: opts.sentAt ?? new Date(),
  };
}

export async function renderEmail<K extends TemplateKey>(template: K, props: TemplateProps[K], ctx: RenderCtx): Promise<RenderedEmail> {
  const def = getTemplate(template);
  if (!def) throw new TemplateNotImplementedError(template);
  const element = createElement(def.Component, { p: props, ctx });
  const [html, text] = await Promise.all([render(element), render(element, { plainText: true })]);
  const subject = def.subject(props, ctx).replace(/\s+/g, " ").trim();
  if (!subject) throw new Error(`Email template "${template}" produced an empty subject`);
  return { subject, html, text };
}
