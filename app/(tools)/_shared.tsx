// Shared building blocks for the free tool pages. Server-only (no "use client")
// so the JSON-LD lands in the initial HTML. The FAQ, SoftwareApplication JSON-LD
// and text styles come from the SEO page kit so the tool pages and the content
// pages emit the same structured data; only the sign-up CTA is tool-specific.
import Link from "next/link";
import { THEME, glow } from "@/lib/theme";

export {
  kitStyles as toolStyles,
  FaqSection as ToolFaq,
  SoftwareAppJsonLd,
  Breadcrumbs,
  type Faq,
} from "@/components/seo/page-kit";

/** Shared bottom CTA. */
export function ToolCta({ heading, body }: { heading: string; body: string }) {
  return (
    <div
      style={{
        marginTop: "48px",
        border: `1px solid ${THEME.border}`,
        borderRadius: THEME.radiusLg,
        background: THEME.surface1,
        padding: "36px 28px",
        textAlign: "center",
        boxShadow: glow(THEME.brand, 0.16),
      }}
    >
      <h2 style={{ fontFamily: THEME.fontHeading, fontWeight: 700, fontSize: "23px", marginBottom: "10px", color: THEME.text, letterSpacing: "-0.01em" }}>
        {heading}
      </h2>
      <p style={{ fontSize: "16px", lineHeight: 1.7, marginBottom: "22px", color: THEME.textDim }}>{body}</p>
      <Link
        href="/sign-up"
        className="cta-full"
        style={{ display: "inline-block", background: THEME.gradient, color: "#fff", fontWeight: 700, fontSize: "16px", padding: "12px 30px", borderRadius: THEME.radius, textDecoration: "none", boxShadow: glow(THEME.brand, 0.32) }}
      >
        Get Started Free
      </Link>
    </div>
  );
}
