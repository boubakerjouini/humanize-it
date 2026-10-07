// ===========================================================
// /free/[slug] — Landing page for one free lead magnet. Statically generated
// from lib/growth/magnets.ts; unknown slugs 404. The form gives the PDF right
// away; the email copy and the optional tips are extras.
// ===========================================================

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs, FaqSection, PageCta, kitStyles } from "@/components/seo/page-kit";
import { LeadCaptureForm } from "@/components/growth/lead-capture-form";
import { MagnetCover } from "@/components/growth/magnet-cover";
import { MAGNET_LIST, getMagnet, magnetPath } from "@/lib/growth/magnets";
import { THEME } from "@/lib/theme";

export const dynamicParams = false;

export function generateStaticParams() {
  return MAGNET_LIST.map((m) => ({ slug: m.slug }));
}

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const magnet = getMagnet(slug);
  if (!magnet) return {};
  const url = `https://humanizeit.app${magnetPath(magnet.slug)}`;
  return {
    title: magnet.seo.title,
    description: magnet.seo.description,
    keywords: magnet.seo.keywords,
    openGraph: { title: magnet.seo.title, description: magnet.seo.description, url, siteName: "HumanizeIt", type: "website" },
    alternates: { canonical: url },
  };
}

const listStyle = { margin: "0 0 8px", paddingLeft: "20px", listStyle: "disc", color: THEME.textDim, lineHeight: 1.7, fontSize: "16px" } as const;

export default async function MagnetPage({ params }: Params) {
  const { slug } = await params;
  const magnet = getMagnet(slug);
  if (!magnet) notFound();

  const others = MAGNET_LIST.filter((m) => m.slug !== magnet.slug);

  return (
    <div style={{ maxWidth: "52rem", margin: "0 auto", padding: "40px 16px" }}>
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Free resources", href: "/free" }, { label: magnet.shortTitle }]} />

      <div style={{ display: "flex", gap: "32px", alignItems: "flex-start", flexWrap: "wrap-reverse" }}>
        <div style={{ flex: "1 1 340px", minWidth: 0 }}>
          <div className="kicker" style={{ marginBottom: "14px" }}>
            Free {magnet.noun} · {magnet.pages} pages · PDF
          </div>
          <h1 style={kitStyles.h1}>{magnet.title}</h1>
          <p style={{ ...kitStyles.p, fontSize: "18px", color: THEME.text }}>{magnet.promise}</p>
          <p style={kitStyles.p}>{magnet.subtitle}</p>
        </div>
        <div style={{ flex: "0 0 auto", margin: "0 auto" }}>
          <MagnetCover magnet={magnet} />
        </div>
      </div>

      <div style={{ margin: "8px 0 0" }}>
        <LeadCaptureForm source="magnet_page" magnet={magnet.slug} ctaLabel={`Get the free ${magnet.noun}`} thing={`the ${magnet.noun}`} />
      </div>

      {magnet.guardrail ? (
        <p style={{ ...kitStyles.p, fontSize: "14px", marginTop: "14px", color: THEME.textMuted }}>{magnet.guardrail}</p>
      ) : null}

      <h2 style={kitStyles.h2}>What&apos;s inside</h2>
      <ul style={listStyle}>
        {magnet.bullets.map((b) => (
          <li key={b} style={{ marginBottom: "6px" }}>
            {b}
          </li>
        ))}
      </ul>

      <h2 style={kitStyles.h2}>Who it&apos;s for</h2>
      <ul style={listStyle}>
        {magnet.forWho.map((w) => (
          <li key={w} style={{ marginBottom: "6px" }}>
            {w}
          </li>
        ))}
      </ul>

      <p style={{ ...kitStyles.p, marginTop: "20px" }}>
        Made by HumanizeIt, the maker of a free{" "}
        <Link href="/ai-detector" style={{ color: THEME.brandHi }}>
          AI detector
        </Link>
        , which shows every pattern it checks instead of a bare score. Sources are listed at the end of the PDF. No tool,
        ours included, can promise what a detector will say.
      </p>

      <FaqSection faqs={magnet.faqs} />

      <h2 style={kitStyles.h2}>More free resources</h2>
      <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
        {others.map((m) => (
          <Link
            key={m.slug}
            href={magnetPath(m.slug)}
            style={{ display: "block", background: THEME.surface1, border: `1px solid ${THEME.border}`, borderRadius: THEME.radius, padding: "16px 18px", textDecoration: "none" }}
          >
            <div style={{ fontSize: "15px", fontWeight: 600, color: THEME.text, marginBottom: "4px" }}>{m.title}</div>
            <div style={{ fontSize: "14px", color: THEME.textDim, lineHeight: 1.5 }}>{m.promise}</div>
          </Link>
        ))}
      </div>

      <PageCta heading={magnet.nextStep.label} body={magnet.nextStep.body} href={magnet.nextStep.href} cta="Open the free tool" />
    </div>
  );
}
