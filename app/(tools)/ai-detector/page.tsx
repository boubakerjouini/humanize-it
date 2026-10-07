import type { Metadata } from "next";
import Link from "next/link";
import { THEME } from "@/lib/theme";
import { DetectorTool } from "@/components/tools/detector-tool";
import { PATTERN_COUNT } from "@/lib/algorithms/patterns";
import { toolStyles, ToolFaq, SoftwareAppJsonLd, ToolCta, type Faq } from "../_shared";

export const metadata: Metadata = {
  title: "Free AI Detector: Check Text for GPTZero & Turnitin Patterns",
  description:
    "Free, no-signup AI detector. See your AI-likelihood score and which patterns make text read as AI-written, the signals GPTZero and Turnitin weigh.",
  keywords: ["ai detector", "ai checker", "free ai detector", "gptzero alternative", "ai content detector", "detect ai text"],
  openGraph: {
    title: "Free AI Detector: Check Text for GPTZero & Turnitin Patterns",
    description: "Paste any text to see its AI-likelihood score and the exact patterns detectors flag. Free, no signup.",
    url: "https://humanizeit.app/ai-detector",
    siteName: "HumanizeIt",
    type: "website",
  },
  alternates: { canonical: "https://humanizeit.app/ai-detector" },
};

const FAQS: Faq[] = [
  { q: "Is this AI detector free?", a: "Yes — it's completely free with no signup. The instant analysis runs in your browser with no limit; the optional AI deep scan has a daily allowance." },
  { q: "How accurate is it?", a: `It scores text against ${PATTERN_COUNT} linguistic and statistical patterns associated with AI writing — the same kinds of signals detectors like GPTZero and Turnitin use, such as predictability, burstiness, and vocabulary diversity. No detector is perfect, ours included: treat the score as an estimate, not a verdict, and run the deep scan for a second opinion.` },
  { q: "Does my text get stored?", a: "No. The instant score is calculated locally in your browser. If you run the optional deep scan, the text is sent to our server to be analyzed and is not stored." },
  { q: "What's the difference between detecting and humanizing?", a: "Detection scores your text and shows which AI patterns are present. Humanizing rewrites the text to reduce those patterns. You can humanize flagged text for free on our humanizer page." },
  { q: "Will passing this detector mean I pass GPTZero or Turnitin?", a: "Not necessarily. It looks for the same kinds of signals, but every detector is trained and weighted differently, and they update often. Use it to find the patterns most likely to get your text flagged, not as a guarantee." },
];

export default function AiDetectorPage() {
  return (
    <div style={{ maxWidth: "48rem", margin: "0 auto", padding: "40px 16px" }}>
      <SoftwareAppJsonLd
        name="HumanizeIt Free AI Detector"
        url="https://humanizeit.app/ai-detector"
        description={`Free AI detector that scores text against ${PATTERN_COUNT} AI-detection patterns in the browser.`}
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
        full breakdown. It analyzes your text against {PATTERN_COUNT} patterns that distinguish machine-written from human writing —
        including <strong>perplexity</strong> (how predictable word choices are), <strong>burstiness</strong> (variation
        in sentence length and rhythm), vocabulary diversity, AI-favored phrasing, and structural uniformity. Each
        triggered pattern is listed so you know precisely what to fix.
      </p>

      <h2 style={toolStyles.h2}>From detection to natural writing</h2>
      <p style={toolStyles.p}>
        Spotting the patterns is half the battle. When your text scores high, our{" "}
        <Link href="/free-ai-humanizer" style={{ color: THEME.brandHi }}>free AI humanizer</Link> rewrites it to reduce
        those exact signals while preserving your meaning. For how each detector works, see our{" "}
        <Link href="/bypass" style={{ color: THEME.brandHi }}>detector-by-detector guides</Link>.
      </p>

      <ToolFaq faqs={FAQS} />

      <ToolCta
        heading="Humanize flagged text for free"
        body="Found AI patterns? Rewrite your text so it reads naturally, then check it again — no credit card required."
      />
    </div>
  );
}
