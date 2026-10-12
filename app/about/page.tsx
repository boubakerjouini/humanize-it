// ===========================================================
// /about — Who builds HumanizeIt, why, what it does and won't promise, and
// how to get in touch. It also tells the real HumanizeIt (humanizeit.app)
// apart from same-name sites. Personal wording: the founder approves changes.
// /contact and /support redirect to #contact (next.config.ts).
// ===========================================================

import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, PageCta, kitStyles } from "@/components/seo/page-kit";
import { PATTERN_COUNT } from "@/lib/algorithms/patterns";
import { OG_IMAGES } from "@/lib/seo/og";
import { THEME } from "@/lib/theme";

const PAGE_URL = "https://humanizeit.app/about";
const TITLE = "About HumanizeIt: Who Builds It and Why";
const DESCRIPTION =
  "A free AI detector and a rewriter that keeps your voice, built by Boubaker Jouini in Tunisia. What HumanizeIt does, what it won't promise, how to reach us.";
const SUPPORT_EMAIL = "support@humanizeit.app";
const LINKEDIN = "https://www.linkedin.com/in/boubakerjouini/";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION, url: PAGE_URL, siteName: "HumanizeIt", type: "website", images: OG_IMAGES },
  alternates: { canonical: PAGE_URL },
};

const listStyle = { margin: "0 0 16px", paddingLeft: "20px", listStyle: "disc", color: THEME.textDim, lineHeight: 1.7, fontSize: "16px" } as const;
const itemStyle = { marginBottom: "8px" } as const;
const linkStyle = { color: THEME.brandHi, fontWeight: 600, textDecoration: "none" } as const;

function AboutJsonLd() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "AboutPage",
          url: PAGE_URL,
          name: TITLE,
          description: DESCRIPTION,
          mainEntity: {
            "@type": "Organization",
            "@id": "https://humanizeit.app/#organization",
            name: "HumanizeIt",
            url: "https://humanizeit.app",
            email: SUPPORT_EMAIL,
            founder: { "@type": "Person", name: "Boubaker Jouini", sameAs: [LINKEDIN] },
          },
        }),
      }}
    />
  );
}

export default function AboutPage() {
  return (
    <div style={{ maxWidth: "48rem", margin: "0 auto", padding: "40px 16px" }}>
      <AboutJsonLd />
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "About" }]} />
      <div className="kicker" style={{ marginBottom: "14px" }}>
        About
      </div>
      <h1 style={kitStyles.h1}>About HumanizeIt</h1>
      <p style={{ ...kitStyles.p, fontSize: "17px" }}>
        HumanizeIt is a free AI detector and a rewriter that keeps your voice. It shows which AI-writing patterns your
        text triggers, and why, so you can fix them in your own words before you submit.
      </p>

      <h2 style={kitStyles.h2}>Who builds it</h2>
      <p style={kitStyles.p}>
        I&apos;m Boubaker Jouini. I build HumanizeIt alone, from Tunisia, after my day job. When you write to support,
        I&apos;m the one who reads it and answers.
      </p>

      <h2 style={kitStyles.h2}>Why it exists</h2>
      <p style={kitStyles.p}>
        AI detectors can be wrong. Research shows they misclassify non-native English writing as AI-generated more often
        (
        <a href="https://arxiv.org/abs/2304.02819" target="_blank" rel="noopener" style={linkStyle}>
          Liang et al., 2023
        </a>
        ). And when your own writing gets flagged, a bare score doesn&apos;t tell you what to fix or how to answer.
        HumanizeIt lists the patterns behind the score, one by one.
      </p>

      <h2 style={kitStyles.h2}>What it does</h2>
      <ul style={listStyle}>
        <li style={itemStyle}>
          A{" "}
          <Link href="/ai-detector" style={linkStyle}>
            free AI detector
          </Link>
          , no signup. It checks your text against {PATTERN_COUNT} patterns and lists the ones your text triggers. The
          instant score is calculated in your browser.
        </li>
        <li style={itemStyle}>
          A{" "}
          <Link href="/free-ai-humanizer" style={linkStyle}>
            rewriter
          </Link>{" "}
          that works on the flagged parts in several passes while keeping your meaning. On paid plans, Voice Match
          learns how you write from 2 or 3 samples.
        </li>
        <li style={itemStyle}>
          <Link href="/free" style={linkStyle}>
            Free guides
          </Link>
          , including an appeal kit for when a detector flags your own work.
        </li>
      </ul>

      <h2 style={kitStyles.h2}>What it won&apos;t promise</h2>
      <ul style={listStyle}>
        <li style={itemStyle}>
          A score on someone else&apos;s detector. Turnitin, GPTZero and the others change often and each weighs things
          differently, so no honest tool can promise how they will score your text.
        </li>
        <li style={itemStyle}>
          Proof of authorship. Our score is an estimate from our own pattern check, not a verdict. Your drafts, notes and
          version history are the real evidence.
        </li>
        <li style={itemStyle}>
          A way around the rules. HumanizeIt is for your own writing: follow your school&apos;s or client&apos;s rules on
          AI.
        </li>
      </ul>

      <h2 style={kitStyles.h2}>The real HumanizeIt</h2>
      <p style={kitStyles.p}>
        HumanizeIt is at humanizeit.app. Other sites use the same name, such as humanizeit.net, humanizeit.online and
        humanizeit.pro. They aren&apos;t run by me, and I can&apos;t answer for what they promise.
      </p>

      <h2 id="contact" style={{ ...kitStyles.h2, scrollMarginTop: "72px" }}>
        Get in touch
      </h2>
      <p style={kitStyles.p}>
        Email{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`} style={linkStyle}>
          {SUPPORT_EMAIL}
        </a>{" "}
        for questions, bug reports, refunds or privacy requests. I read every message. You can also find me on{" "}
        <a href={LINKEDIN} target="_blank" rel="noopener" style={linkStyle}>
          LinkedIn
        </a>
        .
      </p>

      <PageCta
        heading="Check your writing before you submit"
        body="Paste a draft into the free AI detector and see which AI-writing patterns it triggers, and why. No signup."
        href="/ai-detector"
        cta="Analyze My Text"
      />
    </div>
  );
}
