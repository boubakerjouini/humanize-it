// ===========================================================
// emails/components/primitives.tsx — Building blocks for email templates.
// Inline styles only (email clients ignore stylesheets), solid colors
// (gradients don't render in Outlook) and explicit border styles.
// ===========================================================

import type { ReactNode } from "react";
import { Button as EmailButton, Heading, Hr, Section, Text } from "react-email";

export const BRAND = {
  color: "#7c3aed",
  text: "#1d1726",
  muted: "#6b6478",
  border: "#e9e3f3",
  tint: "#f7f5fb",
  font: "Inter, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
} as const;

/** The recipient's first name, or "there" (the copy rule for every email). */
export function greetingName(ctx: { firstName: string | null }): string {
  return ctx.firstName?.trim() || "there";
}

export function Greeting({ ctx }: { ctx: { firstName: string | null } }) {
  // One string, so React doesn't split it with <!-- --> text separators.
  return <P>{`Hi ${greetingName(ctx)},`}</P>;
}

export function H1({ children }: { children: ReactNode }) {
  return (
    <Heading as="h1" style={{ fontSize: 22, lineHeight: "30px", fontWeight: 700, color: BRAND.text, margin: "0 0 16px" }}>
      {children}
    </Heading>
  );
}

export function P({ children, muted = false }: { children: ReactNode; muted?: boolean }) {
  return (
    <Text style={{ fontSize: 15, lineHeight: "24px", color: muted ? BRAND.muted : BRAND.text, margin: "0 0 16px" }}>
      {children}
    </Text>
  );
}

/** The one call to action of an email. Link text must say where it goes. */
export function Button({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Section style={{ margin: "8px 0 24px" }}>
      <EmailButton
        href={href}
        style={{
          backgroundColor: BRAND.color,
          color: "#ffffff",
          borderRadius: 8,
          padding: "12px 20px",
          fontSize: 15,
          fontWeight: 600,
          textDecoration: "none",
          display: "inline-block",
          boxSizing: "border-box",
        }}
      >
        {children}
      </EmailButton>
    </Section>
  );
}

export function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul style={{ margin: "0 0 16px", paddingLeft: 20, color: BRAND.text }}>
      {items.map((item, i) => (
        <li key={i} style={{ fontSize: 15, lineHeight: "24px", margin: "0 0 6px" }}>
          {item}
        </li>
      ))}
    </ul>
  );
}

export function Callout({ children }: { children: ReactNode }) {
  return (
    <Section
      style={{
        backgroundColor: BRAND.tint,
        borderLeftWidth: 3,
        borderLeftStyle: "solid",
        borderLeftColor: BRAND.color,
        borderRadius: 6,
        padding: "12px 16px",
        margin: "0 0 16px",
      }}
    >
      {children}
    </Section>
  );
}

export function Signature() {
  return (
    <Text style={{ fontSize: 15, lineHeight: "24px", color: BRAND.text, margin: "24px 0 0" }}>
      Boubaker, founder of HumanizeIt
    </Text>
  );
}

export function Divider() {
  return <Hr style={{ borderColor: BRAND.border, borderStyle: "solid", borderWidth: "1px 0 0 0", margin: "24px 0" }} />;
}
