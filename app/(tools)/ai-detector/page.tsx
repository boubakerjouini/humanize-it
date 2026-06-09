import type { Metadata } from "next";
import Link from "next/link";
import { THEME } from "@/lib/theme";
import { DetectorTool } from "@/components/tools/detector-tool";
import { toolStyles, ToolFaq, SoftwareAppJsonLd, ToolCta, type Faq } from "../_shared";

export const metadata: Metadata = {
  title: "Free AI Detector — Check Text for GPTZero & Turnitin Patterns",
  description:
    "Free, no-signup AI detector. Paste any text to see its AI-likelihood score and the exact patterns GPTZero, Turnitin, and Originality.ai flag — analyzed in your browser.",
  keywords: ["ai detector", "ai checker", "free ai detector", "gptzero alternative", "ai content detector", "detect ai text"],
  openGraph: {
    title: "Free AI Detector — Check Text for GPTZero & Turnitin Patterns",
    description: "Paste any text to see its AI-likelihood score and the exact patterns detectors flag. Free, no signup.",
    url: "https://humanizeit.app/ai-detector",
    siteName: "HumanizeIt",
    type: "website",
  },
  alternates: { canonical: "https://humanizeit.app/ai-detector" },
};

const FAQS: Faq[] = [
  { q: "Is this AI detector free?", a: "Yes — it's completely free with no signup. The analysis runs in your browser, so there's no limit and your text never leaves your device." },
  { q: "How accurate is it?", a: "It scores text against 40+ of the same linguistic and statistical patterns detectors like GPTZero and Turnitin rely on — perplexity, burstiness, vocabulary diversity, and more. No detector is perfect, so treat the score as a strong signal, not a verdict." },
  { q: "Does my text get stored?", a: "No. The detector analyzes text locally in your browser. Nothing is uploaded, logged, or stored." },
  { q: "What's the difference between detecting and humanizing?", a: "Detection scores your text and shows which AI patterns are present. Humanizing rewrites the text to reduce those patterns. You can humanize flagged text for free on our humanizer page." },
  { q: "Will passing this detector mean I pass GPTZero or Turnitin?", a: "It strongly correlates because it measures the same signals, but each platform weights things differently. Use it to find and fix the patterns most likely to flag your text." },
];

export default function AiDetectorPage() {
  return (
    <div style={{ maxWidth: "48rem", margin: "0 auto", padding: "40px 16px" }}>
      <SoftwareAppJsonLd
        name="HumanizeIt Free AI Detector"
        url="https://humanizeit.app/ai-detector"
        description="Free AI detector that scores text against 40+ AI-detection patterns in the browser."
      />

      <nav style={{ fontSize: "13px", color: THEME.textMuted, marginBottom: "24px" }}>
        <Link href="/" style={{ color: THEME.brandHi, textDecoration: "none" }}>Home</Link>
        <span style={{ margin: "0 8px", color: THEME.border }}>/</span>
        <span style={{ color: THEME.textDim }}>AI Detector</span>
      </nav>

      <div className="kicker" style={{ marginBottom: "14px" }}>Free tool</div>
      <h1 style={{ fontFamily: THEME.fontHeading, fontWeight: 800, color: THEME.text, fontSize: "clamp(28px, 5vw, 40px)", lineHeight: 1.15, letterSpacing: "-0.02em", marginBottom: "16px" }}>
        Free AI Detector
      </h1>
      <p style={{ ...toolStyles.p, fontSize: "17px" }}>
        Paste any text to see how likely it is to be flagged as AI-generated — and exactly which patterns trigger it.
        No signup, no limits, and your text never leaves your browser.
      </p>

      <DetectorTool ctaHref="/free-ai-humanizer" />

      <h2 style={toolStyles.h2}>What this detector checks</h2>
      <p style={toolStyles.p}>
        Most AI detectors hand you a single &ldquo;human or AI&rdquo; verdict and hide their reasoning. This one shows the
        full breakdown. It analyzes your text against 40+ patterns that distinguish machine-written from human writing —
        including <strong>perplexity</strong> (how predictable word choices are), <strong>burstiness</strong> (variation
        in sentence length and rhythm), vocabulary diversity, AI-favored phrasing, and structural uniformity. Each
        triggered pattern is listed so you know precisely what to fix.
      </p>

      <h2 style={toolStyles.h2}>From detection to undetectable</h2>
      <p style={toolStyles.p}>
        Spotting the patterns is half the battle. When your text scores high, our{" "}
        <Link href="/free-ai-humanizer" style={{ color: THEME.brandHi }}>free AI humanizer</Link> rewrites it to reduce
        those exact signals while preserving your meaning. For a deeper walkthrough, read our guide on{" "}
        <Link href="/blog/bypass-ai-detection" style={{ color: THEME.brandHi }}>how to bypass AI detection</Link>.
      </p>

      <ToolFaq faqs={FAQS} />

      <ToolCta
        heading="Humanize flagged text for free"
        body="Found AI patterns? Rewrite your text to read naturally and pass detection — no credit card required."
      />
    </div>
  );
}
