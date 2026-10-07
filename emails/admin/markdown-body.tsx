// ===========================================================
// emails/admin/markdown-body.tsx — Renders an admin-written Markdown body.
//
// {{firstName}} becomes the recipient's first name (or "there"). The name comes
// from the user's own profile, so it is escaped for both Markdown and HTML
// before it is spliced in; raw HTML in the body is neutralized too, because
// marked passes it straight through. Links to our own site get the same UTMs
// as every other email link (ctx.link leaves other sites untouched).
// ===========================================================

import { Markdown } from "react-email";
import type { RenderCtx } from "@/lib/email/render";
import { BRAND, greetingName } from "@/emails/components/primitives";

const FIRST_NAME_TOKEN = /\{\{\s*firstName\s*\}\}/g;

/** Backslash-escape Markdown syntax and entity-encode HTML specials. */
export function escapeMarkdownText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/([\\`*_{}[\]()#+\-.!|~])/g, "\\$1");
}

/** {{firstName}} → plain text, for subjects and previews. */
export function fillFirstNamePlain(text: string, ctx: Pick<RenderCtx, "firstName">): string {
  return text.replace(FIRST_NAME_TOKEN, greetingName(ctx));
}

/** The Markdown source that is actually rendered. */
export function prepareMarkdown(bodyMd: string, ctx: Pick<RenderCtx, "firstName" | "link">): string {
  const name = escapeMarkdownText(greetingName(ctx));
  return bodyMd
    .replace(/</g, "&lt;")
    .replace(FIRST_NAME_TOKEN, () => name)
    .replace(/\]\(([^)\s]+)\)/g, (_match, url: string) => `](${ctx.link(url)})`);
}

export function MarkdownBody({ bodyMd, ctx }: { bodyMd: string; ctx: RenderCtx }) {
  return (
    <Markdown
      markdownCustomStyles={{
        p: { fontSize: 15, lineHeight: "24px", color: BRAND.text, margin: "0 0 16px" },
        li: { fontSize: 15, lineHeight: "24px", color: BRAND.text },
        h1: { fontSize: 22, lineHeight: "30px", color: BRAND.text, margin: "0 0 16px" },
        h2: { fontSize: 18, lineHeight: "26px", color: BRAND.text, margin: "0 0 12px" },
        link: { color: BRAND.color },
      }}
    >
      {prepareMarkdown(bodyMd, ctx)}
    </Markdown>
  );
}
