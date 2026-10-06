// ===========================================================
// emails/components/layout.tsx — The two email shells.
//   EmailLayout  branded: 560px, white, icon + "H." wordmark, brand buttons
//   PlainLayout  founder style: no images, reads like a personal email
// Both end with the same footer: why you got this, unsubscribe, preferences,
// the postal address when configured, and the site.
// ===========================================================

import type { ReactNode } from "react";
import { Body, Column, Container, Head, Html, Img, Link, Preview, Row, Section, Text } from "react-email";
import type { RenderCtx } from "@/lib/email/render";
import { BRAND, Signature } from "@/emails/components/primitives";

type LayoutProps = { ctx: RenderCtx; preview?: string; children: ReactNode };

const footerText = { fontSize: 12, lineHeight: "18px", color: BRAND.muted, margin: "0 0 6px" } as const;
const footerLink = { color: BRAND.muted, textDecorationLine: "underline" } as const;

export function EmailFooter({ ctx }: { ctx: RenderCtx }) {
  const site = ctx.appUrl.replace(/^https?:\/\//, "");
  return (
    <Section
      style={{ borderTopWidth: 1, borderTopStyle: "solid", borderTopColor: BRAND.border, marginTop: 32, paddingTop: 16 }}
    >
      <Text style={footerText}>{ctx.reason}</Text>
      {ctx.unsubscribeUrl || ctx.preferencesUrl ? (
        <Text style={footerText}>
          {ctx.unsubscribeUrl ? (
            <Link href={ctx.unsubscribeUrl} style={footerLink}>
              Unsubscribe
            </Link>
          ) : null}
          {ctx.unsubscribeUrl && ctx.preferencesUrl ? " · " : null}
          {ctx.preferencesUrl ? (
            <Link href={ctx.preferencesUrl} style={footerLink}>
              Email preferences
            </Link>
          ) : null}
        </Text>
      ) : null}
      {ctx.postalAddress ? <Text style={footerText}>{ctx.postalAddress}</Text> : null}
      <Text style={footerText}>
        {"HumanizeIt · "}
        <Link href={ctx.appUrl} style={footerLink}>
          {site}
        </Link>
      </Text>
    </Section>
  );
}

function Shell({ preview, children }: { preview?: string; children: ReactNode }) {
  return (
    <Html lang="en">
      <Head />
      <Body style={{ backgroundColor: "#ffffff", margin: 0, padding: "24px 0", fontFamily: BRAND.font, color: BRAND.text }}>
        {preview ? <Preview>{preview}</Preview> : null}
        <Container style={{ maxWidth: 560, width: "100%", margin: "0 auto", padding: "0 20px", backgroundColor: "#ffffff" }}>
          {children}
        </Container>
      </Body>
    </Html>
  );
}

export function EmailLayout({ ctx, preview, children }: LayoutProps) {
  return (
    <Shell preview={preview}>
      <Section style={{ margin: "0 0 24px" }}>
        <Row>
          <Column style={{ width: 36, verticalAlign: "middle" }}>
            <Img src={`${ctx.appUrl}/icon.png`} width="28" height="28" alt="HumanizeIt logo" style={{ borderRadius: 6 }} />
          </Column>
          <Column style={{ verticalAlign: "middle" }}>
            <Text style={{ fontSize: 18, fontWeight: 800, color: BRAND.color, margin: 0, letterSpacing: "-0.02em" }}>H.</Text>
          </Column>
        </Row>
      </Section>
      {children}
      <EmailFooter ctx={ctx} />
    </Shell>
  );
}

/** Founder-style note: no images, no buttons needed, signed by Boubaker. */
export function PlainLayout({ ctx, preview, children }: LayoutProps) {
  return (
    <Shell preview={preview}>
      {children}
      <Signature />
      <EmailFooter ctx={ctx} />
    </Shell>
  );
}
