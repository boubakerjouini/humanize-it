// ===========================================================
// components/seo/page-kit.tsx — shared building blocks for marketing/content
// pages. Server-only (no "use client") so all JSON-LD lands in the initial
// HTML. Provides visible UI + matching structured data in one place:
//   - Breadcrumbs   → visible trail + BreadcrumbList JSON-LD
//   - FaqSection    → visible <details> accordion + FAQPage JSON-LD
//   - ArticleJsonLd → BlogPosting structured data
//   - SoftwareAppJsonLd, PageCta, kitStyles
// ===========================================================
import Link from "next/link";
import { THEME, glow } from "@/lib/theme";

const SITE = "https://humanizeit.app";

export const kitStyles = {
  h1: {
    fontFamily: THEME.fontHeading,
    fontWeight: 800,
    color: THEME.text,
    fontSize: "clamp(28px, 5vw, 40px)",
    lineHeight: 1.15,
    letterSpacing: "-0.02em",
    marginBottom: "16px",
  } as React.CSSProperties,
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

export interface Crumb {
  label: string;
  /** Path (e.g. "/bypass"). Omit on the current (last) crumb. */
  href?: string;
}

/** Visible breadcrumb trail + BreadcrumbList JSON-LD. */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.label,
      ...(c.href ? { item: `${SITE}${c.href}` } : {}),
    })),
  };
  return (
    <nav style={{ fontSize: "13px", color: THEME.textMuted, marginBottom: "24px" }} aria-label="Breadcrumb">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {items.map((c, i) => (
        <span key={c.label}>
          {i > 0 && <span style={{ margin: "0 8px", color: THEME.border }}>/</span>}
          {c.href ? (
            <Link href={c.href} style={{ color: THEME.brandHi, textDecoration: "none", fontWeight: 500 }}>
              {c.label}
            </Link>
          ) : (
            <span style={{ color: THEME.textDim }}>{c.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

export interface Faq {
  q: string;
  a: string;
}

/** Visible <details> FAQ accordion + matching FAQPage JSON-LD. */
export function FaqSection({ faqs, heading = "Frequently asked questions" }: { faqs: Faq[]; heading?: string }) {
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
      <h2 style={kitStyles.h2}>{heading}</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {faqs.map((f) => (
          <details key={f.q} style={{ background: THEME.surface1, border: `1px solid ${THEME.border}`, borderRadius: THEME.radius, padding: "14px 18px" }}>
            <summary style={{ cursor: "pointer", fontWeight: 600, color: THEME.text, fontSize: "15px" }}>{f.q}</summary>
            <p style={{ ...kitStyles.p, marginTop: "10px", marginBottom: 0, fontSize: "15px" }}>{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

/** BlogPosting / Article structured data. */
export function ArticleJsonLd({
  headline,
  description,
  url,
  datePublished,
  dateModified,
}: {
  headline: string;
  description: string;
  url: string;
  datePublished: string;
  dateModified?: string;
}) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          headline,
          description,
          mainEntityOfPage: url,
          datePublished,
          dateModified: dateModified ?? datePublished,
          author: { "@type": "Organization", name: "HumanizeIt", url: SITE },
          publisher: {
            "@type": "Organization",
            name: "HumanizeIt",
            url: SITE,
            logo: { "@type": "ImageObject", url: `${SITE}/icon.png` },
          },
        }),
      }}
    />
  );
}

/** SoftwareApplication structured data for a free tool. */
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
export function PageCta({
  heading,
  body,
  href = "/sign-up",
  cta = "Get Started Free",
}: {
  heading: string;
  body: string;
  href?: string;
  cta?: string;
}) {
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
        href={href}
        style={{ display: "inline-block", background: THEME.gradient, color: "#fff", fontWeight: 700, fontSize: "16px", padding: "12px 30px", borderRadius: THEME.radius, textDecoration: "none", boxShadow: glow(THEME.brand, 0.32) }}
      >
        {cta} &rarr;
      </Link>
    </div>
  );
}
