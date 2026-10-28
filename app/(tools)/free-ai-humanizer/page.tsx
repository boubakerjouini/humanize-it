import type { Metadata } from "next";
import Link from "next/link";
import { THEME } from "@/lib/theme";
import { PLANS, TONES } from "@/lib/plans";
import { HumanizerTool } from "@/components/tools/humanizer-tool";
import { toolStyles, ToolFaq, SoftwareAppJsonLd, ToolCta, type Faq } from "../_shared";

export const metadata: Metadata = {
  title: "Free AI Humanizer — Make AI Text Sound Human, No Signup",
  description:
    "Free AI humanizer, no signup. Paste ChatGPT, Claude or Gemini text and get a natural rewrite that keeps your meaning, with your AI score before and after.",
  keywords: ["free ai humanizer", "humanize ai text free", "ai humanizer", "humanize chatgpt", "ai text humanizer"],
  openGraph: {
    title: "Free AI Humanizer — Make AI Text Sound Human, No Signup",
    description: "Paste AI text and get a natural, human-sounding rewrite, with your AI score before and after. Free, no signup for your first rewrites.",
    url: "https://humanizeit.app/free-ai-humanizer",
    siteName: "HumanizeIt",
    type: "website",
  },
  alternates: { canonical: "https://humanizeit.app/free-ai-humanizer" },
};

// What a free account and Pro give, from lib/plans.ts. The no-signup caps live in
// app/api/public/humanize/route.ts.
const FREE = PLANS.FREE;
const PRO = PLANS.PRO;
const FREE_REWRITES = `${FREE.rewriteLimit} rewrite${FREE.rewriteLimit === 1 ? "" : "s"} a day`;
const PRO_WORDS = PRO.wordsLimit.toLocaleString("en-US");

const FAQS: Faq[] = [
  { q: "Is the humanizer really free?", a: `Yes. You can humanize short passages here, up to 300 words each, with no signup and no credit card, within a small daily limit. A free account gives you the editor, with ${FREE.wordsLimit} words of rewriting a day (${FREE_REWRITES}, Standard tone) and free AI checks. Pro ($${PRO.price} a month) gives you ${PRO_WORDS} words a month with unlimited rewrites and all ${TONES.length} tones.` },
  { q: "Is there a word limit?", a: `Yes. The no-signup version is capped at 300 words per rewrite so we can keep it free and fast. A free account covers ${FREE.wordsLimit} words of rewriting a day. Pro covers ${PRO_WORDS} words a month and lets you upload PDF and Word files.` },
  { q: "Will the output pass AI detectors?", a: "No tool can guarantee that — every detector works differently and they update often. The humanizer rewrites your text to reduce the patterns detectors like GPTZero and Turnitin tend to flag, and shows your score before and after. Run the result through our free AI detector and read it over before you use it." },
  { q: "Does it work with ChatGPT, Claude, and Gemini text?", a: `Yes — it works with output from any major AI model. Paste it in and humanize it. The free tool and the Free plan use the Standard tone; Pro unlocks all ${TONES.length}.` },
  { q: "Is my text stored?", a: "No. Text is processed to generate the rewrite and is not stored or used for training." },
];

export default function FreeAiHumanizerPage() {
  return (
    <div style={{ maxWidth: "48rem", margin: "0 auto", padding: "40px 16px" }}>
      <SoftwareAppJsonLd
        name="HumanizeIt Free AI Humanizer"
        url="https://humanizeit.app/free-ai-humanizer"
        description="Free, no-signup AI humanizer that rewrites AI text to read naturally and shows the AI score before and after."
      />

      <nav aria-label="Breadcrumb" style={{ fontSize: "13px", color: THEME.textMuted, marginBottom: "24px" }}>
        <Link href="/" style={{ color: THEME.brandHi, textDecoration: "underline", textUnderlineOffset: 2 }}>Home</Link>
        <span style={{ margin: "0 8px", color: THEME.border }}>/</span>
        <span style={{ color: THEME.textDim }}>Free AI Humanizer</span>
      </nav>

      <div className="kicker" style={{ marginBottom: "14px" }}>Free tool</div>
      <h1 style={{ fontFamily: THEME.fontHeading, fontWeight: 800, color: THEME.text, fontSize: "clamp(28px, 5vw, 40px)", lineHeight: 1.15, letterSpacing: "-0.02em", marginBottom: "16px" }}>
        Free AI Humanizer
      </h1>
      <p style={{ ...toolStyles.p, fontSize: "17px" }}>
        Paste your ChatGPT, Claude, or Gemini text and get a natural, human-sounding version in seconds, rewritten to
        reduce the patterns AI detectors flag. No signup for your first rewrites.
      </p>

      <HumanizerTool />

      <h2 style={toolStyles.h2}>How the free humanizer works</h2>
      <p style={toolStyles.p}>
        The humanizer first scores your text against the patterns AI detectors flag, then rewrites the riskiest passages
        — varying sentence length and rhythm, diversifying vocabulary, and shifting register — so the result reads as
        naturally while keeping your meaning. You see the before and after AI-likelihood scores so you can check the
        improvement yourself.
      </p>

      <h2 style={toolStyles.h2}>Check your result</h2>
      <p style={toolStyles.p}>
        Want to verify? Paste the output into our{" "}
        <Link href="/ai-detector" style={{ color: THEME.brandHi }}>free AI detector</Link> to see the full pattern
        breakdown, or read{" "}
        <Link href="/blog/humanize-chatgpt-text" style={{ color: THEME.brandHi }}>how to humanize ChatGPT text</Link>{" "}
        for tips. Need to humanize whole documents?{" "}
        <Link href="/#pricing" style={{ color: THEME.brandHi }}>Pro</Link> covers {PRO_WORDS} words a month, with PDF and
        Word upload.
      </p>

      <ToolFaq faqs={FAQS} />

      <ToolCta
        heading={`Rewrite up to ${FREE.wordsLimit} words a day, free`}
        body={`A free account gives you the editor with ${FREE.wordsLimit} words of rewriting a day (${FREE_REWRITES}, Standard tone), free AI checks and your recent documents. Need more? Pro gives you ${PRO_WORDS} words a month, unlimited rewrites and all ${TONES.length} tones.`}
      />
    </div>
  );
}
