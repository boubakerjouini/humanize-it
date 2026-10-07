// ===========================================================
// /free — Hub for the free resources: the three PDF guides and the two
// no-signup tools. The Appeal Kit leads because a false flag is the most
// urgent problem people arrive with.
// ===========================================================

import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, kitStyles } from "@/components/seo/page-kit";
import { MagnetCover } from "@/components/growth/magnet-cover";
import { MAGNET_LIST, magnetPath } from "@/lib/growth/magnets";
import { THEME } from "@/lib/theme";

const PAGE_URL = "https://humanizeit.app/free";
const TITLE = "Free AI Detection Guides, Kits & Checklists | HumanizeIt";
const DESCRIPTION =
  "Free PDFs for honest writers: what to do if you're falsely flagged as AI, how detectors work, and a checklist for LinkedIn posts and cover letters.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION, url: PAGE_URL, siteName: "HumanizeIt", type: "website" },
  alternates: { canonical: PAGE_URL },
};

const TOOLS = [
  {
    href: "/ai-detector",
    title: "Free AI detector",
    body: "See your AI-likelihood score and the exact patterns behind it. The instant check runs in your browser.",
  },
  {
    href: "/free-ai-humanizer",
    title: "Free AI humanizer",
    body: "Loosen stiff, over-formal wording into something closer to how you talk. Then add your own details.",
  },
];

export default function FreeHubPage() {
  return (
    <div style={{ maxWidth: "56rem", margin: "0 auto", padding: "40px 16px" }}>
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Free resources" }]} />
      <div className="kicker" style={{ marginBottom: "14px" }}>
        Free resources
      </div>
      <h1 style={kitStyles.h1}>Write naturally, avoid false AI flags, check before you submit</h1>
      <p style={{ ...kitStyles.p, fontSize: "17px" }}>
        Three short PDFs and two free tools for people who do their own writing. No hype and no tricks: what detectors
        measure, what to do if one gets it wrong, and how to make AI-assisted drafts sound like you.
      </p>

      <h2 style={kitStyles.h2}>Free guides</h2>
      <div style={{ display: "grid", gap: "16px" }}>
        {MAGNET_LIST.map((m) => (
          <Link
            key={m.slug}
            href={magnetPath(m.slug)}
            style={{
              display: "flex",
              gap: "20px",
              alignItems: "center",
              flexWrap: "wrap",
              background: THEME.surface2,
              border: `1px solid ${THEME.border}`,
              borderRadius: THEME.radiusLg,
              padding: "20px",
              textDecoration: "none",
            }}
          >
            <MagnetCover magnet={m} size="sm" />
            <div style={{ flex: "1 1 260px", minWidth: 0 }}>
              <div style={{ fontSize: "12px", color: THEME.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>
                Free {m.noun} · {m.pages} pages
              </div>
              <div style={{ fontSize: "18px", fontWeight: 700, color: THEME.text, marginBottom: "6px", fontFamily: THEME.fontHeading }}>{m.title}</div>
              <div style={{ fontSize: "15px", color: THEME.textDim, lineHeight: 1.6, marginBottom: "10px" }}>{m.promise}</div>
              <span style={{ fontSize: "14px", fontWeight: 600, color: THEME.brandHi }}>Get the {m.noun} &rarr;</span>
            </div>
          </Link>
        ))}
      </div>

      <h2 style={kitStyles.h2}>Free tools, no signup</h2>
      <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
        {TOOLS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            style={{ display: "block", background: THEME.surface1, border: `1px solid ${THEME.border}`, borderRadius: THEME.radius, padding: "18px", textDecoration: "none" }}
          >
            <div style={{ fontSize: "16px", fontWeight: 700, color: THEME.text, marginBottom: "6px" }}>{t.title}</div>
            <div style={{ fontSize: "14px", color: THEME.textDim, lineHeight: 1.6 }}>{t.body}</div>
          </Link>
        ))}
      </div>

      <p style={{ ...kitStyles.p, marginTop: "32px", fontSize: "14px" }}>
        No tool can promise what a detector will say. Your own voice and a record of how you wrote are what protect you.
        Coming soon:{" "}
        <Link href="/extension" style={{ color: THEME.brandHi }}>
          the Chrome extension
        </Link>
        .
      </p>
    </div>
  );
}
