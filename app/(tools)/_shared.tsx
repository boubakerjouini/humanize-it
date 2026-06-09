// Shared building blocks for the free tool pages. Server-only (no "use client")
// so the JSON-LD lands in the initial HTML. The FAQ uses native <details> for
// accordion behavior without client JS.
import Link from "next/link";
import { THEME, glow } from "@/lib/theme";

export const toolStyles = {
  h2: {
    fontFamily: THEME.fontHeading,
    fontWeight: 700,
    color: THEME.text,
    fontSize: "24px",
    marginTop: "40px",
    marginBottom: "14px",
    letterSpacing: "-0.01em",
  } as React.CSSProperties,
  p: {
    color: THEME.textDim,
    lineHeight: 1.75,
    marginBottom: "16px",
    fontSize: "16px",
  } as React.CSSProperties,
};

export interface Faq {
  q: string;
  a: string;
}

/** Visible FAQ accordion + a matching FAQPage JSON-LD block (same content). */
export function ToolFaq({ faqs }: { faqs: Faq[] }) {
  return (
    <section style={{ marginTop: "48px" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faqs.map((f) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          }),
        }}
      />
      <h2 style={toolStyles.h2}>Frequently asked questions</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {faqs.map((f) => (
          <details
            key={f.q}
            style={{
              background: THEME.surface1,
              border: `1px solid ${THEME.border}`,
              borderRadius: THEME.radius,
              padding: "14px 18px",
            }}
          >
            <summary style={{ cursor: "pointer", fontWeight: 600, color: THEME.text, fontSize: "15px" }}>
              {f.q}
            </summary>
            <p style={{ ...toolStyles.p, marginTop: "10px", marginBottom: 0, fontSize: "15px" }}>{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

/** SoftwareApplication structured data for a free tool page. */
export function SoftwareAppJsonLd({ name, url, description }: { name: string; url: string; description: string }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name,
          url,
          description,
          applicationCategory: "WritingApplication",
          operatingSystem: "Web",
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        }),
      }}
    />
  );
}

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
        style={{ display: "inline-block", background: THEME.gradient, color: "#fff", fontWeight: 700, fontSize: "16px", padding: "12px 30px", borderRadius: THEME.radius, textDecoration: "none", boxShadow: glow(THEME.brand, 0.32) }}
      >
        Get Started Free &rarr;
      </Link>
    </div>
  );
}
