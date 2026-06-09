import type { Metadata } from "next";
import Link from "next/link";
import { THEME } from "@/lib/theme";
import { HumanizerTool } from "@/components/tools/humanizer-tool";
import { toolStyles, ToolFaq, SoftwareAppJsonLd, ToolCta, type Faq } from "../_shared";

export const metadata: Metadata = {
  title: "Free AI Humanizer — Make AI Text Undetectable, No Signup",
  description:
    "Free AI humanizer. Paste ChatGPT or Claude text and get a natural, human version that bypasses GPTZero, Turnitin & Originality.ai. No signup for your first rewrites.",
  keywords: ["free ai humanizer", "humanize ai text free", "ai humanizer", "humanize chatgpt", "undetectable ai free", "ai text humanizer"],
  openGraph: {
    title: "Free AI Humanizer — Make AI Text Undetectable, No Signup",
    description: "Paste AI text and get a natural, human version that bypasses detectors. Free, no signup for your first rewrites.",
    url: "https://humanizeit.app/free-ai-humanizer",
    siteName: "HumanizeIt",
    type: "website",
  },
  alternates: { canonical: "https://humanizeit.app/free-ai-humanizer" },
};

const FAQS: Faq[] = [
  { q: "Is the humanizer really free?", a: "Yes — you can humanize a few short passages per day with no signup and no credit card. For longer text and unlimited rewrites, you can sign up for a free account." },
  { q: "Is there a word limit?", a: "The no-signup version is capped at 300 words per rewrite so we can keep it free and fast. Sign up free to humanize longer documents." },
  { q: "Will the output pass AI detectors?", a: "The humanizer rewrites your text to reduce the exact patterns GPTZero, Turnitin, and Originality.ai look for, while preserving your meaning. Most text moves well into the human range — run the result through our free AI detector to confirm." },
  { q: "Does it work with ChatGPT, Claude, and Gemini text?", a: "Yes — it works with output from any major AI model. Paste it in and pick a tone." },
  { q: "Is my text stored?", a: "No. Text is processed to generate the rewrite and is not stored or used for training." },
];

export default function FreeAiHumanizerPage() {
  return (
    <div style={{ maxWidth: "48rem", margin: "0 auto", padding: "40px 16px" }}>
      <SoftwareAppJsonLd
        name="HumanizeIt Free AI Humanizer"
        url="https://humanizeit.app/free-ai-humanizer"
        description="Free, no-signup AI humanizer that rewrites AI text to read naturally and bypass AI detectors."
      />

      <nav style={{ fontSize: "13px", color: THEME.textMuted, marginBottom: "24px" }}>
        <Link href="/" style={{ color: THEME.brandHi, textDecoration: "none" }}>Home</Link>
        <span style={{ margin: "0 8px", color: THEME.border }}>/</span>
        <span style={{ color: THEME.textDim }}>Free AI Humanizer</span>
      </nav>

      <div className="kicker" style={{ marginBottom: "14px" }}>Free tool</div>
      <h1 style={{ fontFamily: THEME.fontHeading, fontWeight: 800, color: THEME.text, fontSize: "clamp(28px, 5vw, 40px)", lineHeight: 1.15, letterSpacing: "-0.02em", marginBottom: "16px" }}>
        Free AI Humanizer
      </h1>
      <p style={{ ...toolStyles.p, fontSize: "17px" }}>
        Paste your ChatGPT, Claude, or Gemini text and get a natural, human-sounding version in seconds — built to bypass
        GPTZero, Turnitin, and Originality.ai. No signup for your first rewrites.
      </p>

      <HumanizerTool />

      <h2 style={toolStyles.h2}>How the free humanizer works</h2>
      <p style={toolStyles.p}>
        The humanizer first scores your text against the patterns AI detectors flag, then rewrites the riskiest passages
        — varying sentence length and rhythm, diversifying vocabulary, and shifting register — so the result reads as
        genuinely human while keeping your meaning intact. You see the before and after AI-likelihood scores so you can
        confirm the improvement.
      </p>

      <h2 style={toolStyles.h2}>Check your result</h2>
      <p style={toolStyles.p}>
        Want to verify? Paste the output into our{" "}
        <Link href="/ai-detector" style={{ color: THEME.brandHi }}>free AI detector</Link> to see the full pattern
        breakdown, or read{" "}
        <Link href="/blog/humanize-chatgpt-text" style={{ color: THEME.brandHi }}>how to humanize ChatGPT text</Link>{" "}
        for tips. Need to humanize whole documents? <Link href="/sign-up" style={{ color: THEME.brandHi }}>Sign up free</Link>.
      </p>

      <ToolFaq faqs={FAQS} />

      <ToolCta
        heading="Humanize longer text, free"
        body="Create a free account to humanize full documents, save your history, and remove the word cap."
      />
    </div>
  );
}
