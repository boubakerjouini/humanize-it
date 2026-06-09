import type { Metadata } from "next";
import Link from "next/link";
import { THEME } from "@/lib/theme";
import { DetectorTool } from "@/components/tools/detector-tool";
import { toolStyles, ToolFaq, SoftwareAppJsonLd, ToolCta, type Faq } from "../_shared";

export const metadata: Metadata = {
  title: "Free GPTZero Checker — Test Your Text Before You Submit",
  description:
    "Free GPTZero-style checker. Paste your text to estimate its AI score and see the perplexity and burstiness patterns GPTZero looks for — in your browser, no signup.",
  keywords: ["gptzero checker", "gptzero", "check gptzero score", "gptzero detector", "beat gptzero", "ai detector"],
  openGraph: {
    title: "Free GPTZero Checker — Test Your Text Before You Submit",
    description: "Estimate your GPTZero AI score and see the perplexity & burstiness patterns it looks for. Free, no signup.",
    url: "https://humanizeit.app/gptzero-checker",
    siteName: "HumanizeIt",
    type: "website",
  },
  alternates: { canonical: "https://humanizeit.app/gptzero-checker" },
};

const FAQS: Faq[] = [
  { q: "Is this an official GPTZero tool?", a: "No — it's an independent, free checker that measures the same kinds of signals GPTZero uses (perplexity and burstiness). Use it to estimate risk and find what to fix before you run the real thing." },
  { q: "How does GPTZero detect AI text?", a: "GPTZero scores two main signals: perplexity (how predictable your word choices are) and burstiness (how much sentence length and complexity vary). AI text tends to be low-perplexity and low-burstiness — smooth and uniform. This checker flags those same patterns." },
  { q: "Is it free and private?", a: "Yes. There's no signup and the analysis runs locally in your browser, so your text is never uploaded or stored." },
  { q: "My text scored high — what now?", a: "Use our free humanizer to rewrite the flagged passages so they read more naturally, then re-check. The goal is to raise perplexity and burstiness back into the human range." },
];

export default function GptzeroCheckerPage() {
  return (
    <div style={{ maxWidth: "48rem", margin: "0 auto", padding: "40px 16px" }}>
      <SoftwareAppJsonLd
        name="HumanizeIt Free GPTZero Checker"
        url="https://humanizeit.app/gptzero-checker"
        description="Free checker that estimates a GPTZero-style AI score from perplexity and burstiness patterns, in the browser."
      />

      <nav style={{ fontSize: "13px", color: THEME.textMuted, marginBottom: "24px" }}>
        <Link href="/" style={{ color: THEME.brandHi, textDecoration: "none" }}>Home</Link>
        <span style={{ margin: "0 8px", color: THEME.border }}>/</span>
        <Link href="/ai-detector" style={{ color: THEME.brandHi, textDecoration: "none" }}>AI Detector</Link>
        <span style={{ margin: "0 8px", color: THEME.border }}>/</span>
        <span style={{ color: THEME.textDim }}>GPTZero Checker</span>
      </nav>

      <div className="kicker" style={{ marginBottom: "14px" }}>Free tool</div>
      <h1 style={{ fontFamily: THEME.fontHeading, fontWeight: 800, color: THEME.text, fontSize: "clamp(28px, 5vw, 40px)", lineHeight: 1.15, letterSpacing: "-0.02em", marginBottom: "16px" }}>
        Free GPTZero Checker
      </h1>
      <p style={{ ...toolStyles.p, fontSize: "17px" }}>
        Test your writing against the perplexity and burstiness patterns GPTZero looks for — before you submit. Free,
        instant, and private: the check runs entirely in your browser.
      </p>

      <DetectorTool ctaHref="/free-ai-humanizer" />

      <h2 style={toolStyles.h2}>What GPTZero actually measures</h2>
      <p style={toolStyles.p}>
        GPTZero relies on two signals. <strong>Perplexity</strong> measures how surprising your word choices are: language
        models pick the most statistically likely next word, which makes their output smooth but predictable.{" "}
        <strong>Burstiness</strong> measures variation — humans mix long, clause-heavy sentences with short, punchy ones,
        while AI tends toward uniform length. This checker estimates both, along with 40+ related patterns, and lists
        exactly what triggered so you can fix it.
      </p>

      <h2 style={toolStyles.h2}>Lower your score the right way</h2>
      <p style={toolStyles.p}>
        When you score high, the fix is to add genuine variation rather than swap synonyms. Our{" "}
        <Link href="/free-ai-humanizer" style={{ color: THEME.brandHi }}>free humanizer</Link> does this automatically,
        and our guide on{" "}
        <Link href="/blog/bypass-ai-detection" style={{ color: THEME.brandHi }}>bypassing AI detection</Link> covers the
        manual techniques.
      </p>

      <ToolFaq faqs={FAQS} />

      <ToolCta
        heading="Beat GPTZero with one click"
        body="Humanize flagged text for free so it reads naturally and scores in the human range — no credit card required."
      />
    </div>
  );
}
