// ===========================================================
// emails/registry.ts — Every implemented email template, keyed by catalog key.
// Each folder owns its own registry (transactional: stream C; lifecycle,
// marketing and admin: stream D); this file only merges them. A key missing
// here makes renderEmail throw TemplateNotImplementedError, which the send
// pipeline records as a non-retryable failure.
// ===========================================================

import type { ComponentType } from "react";
import type { TemplateKey, TemplateProps } from "@/lib/email/catalog";
import type { RenderCtx } from "@/lib/email/render";
import { TRANSACTIONAL } from "@/emails/transactional";
import { LIFECYCLE } from "@/emails/lifecycle";
import { MARKETING } from "@/emails/marketing";
import { ADMIN } from "@/emails/admin";

export type TemplateComponentProps<K extends TemplateKey> = { p: TemplateProps[K]; ctx: RenderCtx };

export type TemplateDef<K extends TemplateKey> = {
  /** Subject line; never empty. */
  subject: (p: TemplateProps[K], ctx: RenderCtx) => string;
  Component: ComponentType<TemplateComponentProps<K>>;
};

export type TemplateRegistry = { [K in TemplateKey]?: TemplateDef<K> };

export const REGISTRY: TemplateRegistry = { ...TRANSACTIONAL, ...LIFECYCLE, ...MARKETING, ...ADMIN };

export function getTemplate<K extends TemplateKey>(key: K): TemplateDef<K> | undefined {
  return REGISTRY[key] as TemplateDef<K> | undefined;
}
