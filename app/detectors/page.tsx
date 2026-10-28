import Link from "next/link";
import type { Metadata } from "next";
import { OG_IMAGES } from "@/lib/seo/og";
import { kitStyles, Breadcrumbs, FaqSection, PageCta } from "@/components/seo/page-kit";
import { THEME } from "@/lib/theme";

const URL = "https://humanizeit.app/detectors";

const TITLE = "AI Detector Guides: How Each One Scores Your Writing";
const DESCRIPTION =
  "How Turnitin, GPTZero, ZeroGPT, Originality.ai, Copyleaks and Winston AI score text, why they flag honest writing, and how to read a result before you submit.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "AI detector guide",
    "how AI detectors work",
    "AI detector false positive",
    "Turnitin AI detection",
    "GPTZero false positive",
    "ZeroGPT accuracy",
    "Originality.ai false positive",
    "Copyleaks AI detector",
    "Winston AI accuracy",
  ],
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: URL,
    siteName: "HumanizeIt",
    type: "website",
    images: OG_IMAGES,
  },
  alternates: {
    canonical: URL,
  },
};

const detectorLink = {
  color: THEME.brandHi,
  fontWeight: 600,
  textDecoration: "none",
};

export default function DetectorsHubPage() {
  return (
    <div style={{ maxWidth: "48rem", margin: "0 auto", padding: "40px 16px" }}>
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "AI Detector Guides" }]} />

      <div className="kicker" style={{ marginBottom: "14px" }}>Detector guides</div>

      <h1 style={kitStyles.h1}>
        AI Detector Guides: How Each One Scores Your Writing
      </h1>

      <p style={{ ...kitStyles.p, fontSize: "17px" }}>
        &quot;AI detection&quot; sounds like one test, but it isn&apos;t. Every detector measures
        something slightly different, weights its signals differently, and draws its
        AI-versus-human line in a different place. A passage that one tool calls human can light up
        another, and honest human writing gets flagged more often than most people expect. This hub
        explains how the six most common detectors actually work and links to a focused guide for
        each, so you can understand a flag instead of guessing at it. If you want to see which
        sentences in your own draft read as machine-like, run it through our free{" "}
        <Link href="/ai-detector" style={{ color: THEME.brandHi }}>AI detector</Link>.
      </p>

      <h2 style={kitStyles.h2}>What every AI detector is really measuring</h2>
      <p style={kitStyles.p}>
        Almost all current detectors are built on the same underlying idea: large language models
        produce text that is statistically smoother and more predictable than most human writing.
        Two terms come up constantly. <strong>Perplexity</strong> measures how surprising each word
        is given the words before it &mdash; low perplexity means the text takes the &quot;obvious&quot;
        next word again and again, which is typical of a model optimizing for the most likely token.
        <strong> Burstiness</strong> measures variation across sentences: humans mix long, winding
        sentences with short, blunt ones, while models tend to settle into a uniform rhythm.
      </p>
      <p style={kitStyles.p}>
        Detectors differ in how they turn those signals into a verdict. Some classify the whole
        document at once; others score sentence by sentence and aggregate. Some were trained mostly
        on older GPT output and lag behind newer models; others retrain frequently. The practical
        consequence is that detector scores are estimates of how AI-like a pattern looks, not proof
        of authorship &mdash; which is exactly why false positives on genuine human writing remain a
        well-documented problem, especially for non-native English writers. For a deeper
        walkthrough, see{" "}
        <Link href="/blog/ai-detection-how-it-works" style={{ color: THEME.brandHi }}>how AI detection works</Link>.
      </p>

      <h2 style={kitStyles.h2}>Turnitin</h2>
      <p style={kitStyles.p}>
        Turnitin is the detector most students encounter because it&apos;s built into the platforms
        schools use to collect assignments. Its AI writing indicator scores sentences individually,
        then reports the percentage of the document it believes is AI-generated. Two things make it
        distinct: instructors usually cannot see the underlying sentence highlights the way you can
        with consumer tools, and Turnitin itself acknowledges the score is an indicator rather than a
        determination of misconduct. That gap between a number and a verdict is where most disputes
        happen.
      </p>
      <p style={kitStyles.p}>
        <Link href="/detectors/turnitin" style={detectorLink}>Read the Turnitin guide</Link>
      </p>

      <h2 style={kitStyles.h2}>GPTZero</h2>
      <p style={kitStyles.p}>
        GPTZero popularized the perplexity-and-burstiness framing and is one of the most widely used
        standalone checkers. It returns a per-document probability plus a sentence-level highlight
        view, and it tends to react strongly to text that is uniformly fluent with little structural
        variation. Because it is free and fast, GPTZero is often the first tool people use to
        sanity-check a draft. You can compare its behavior against ours with our dedicated{" "}
        <Link href="/gptzero-checker" style={{ color: THEME.brandHi }}>GPTZero checker</Link>.
      </p>
      <p style={kitStyles.p}>
        <Link href="/detectors/gptzero" style={detectorLink}>Read the GPTZero guide</Link>
      </p>

      <h2 style={kitStyles.h2}>ZeroGPT</h2>
      <p style={kitStyles.p}>
        ZeroGPT is a free, ad-supported checker that returns a blunt &quot;percentage AI&quot; figure
        and highlights the spans it considers machine-written. It is popular precisely because it has
        no sign-up wall, but it is also known for being noisy: it can swing hard on short inputs and
        sometimes flags plainly human text. Treat its number as a rough temperature reading rather
        than a precise measurement, and never assume a ZeroGPT score predicts what a stricter
        detector will say.
      </p>
      <p style={kitStyles.p}>
        <Link href="/detectors/zerogpt" style={detectorLink}>Read the ZeroGPT guide</Link>
      </p>

      <h2 style={kitStyles.h2}>Originality.ai</h2>
      <p style={kitStyles.p}>
        Originality.ai is aimed at publishers, agencies, and SEO teams who want to vet freelance and
        outsourced content at scale. It is generally one of the stricter detectors and pairs its AI
        score with a plagiarism check, which is why it shows up in editorial and{" "}
        <Link href="/use-cases/agencies" style={{ color: THEME.brandHi }}>agency</Link> workflows.
        Its strictness cuts both ways: it catches lightly edited AI output that lenient tools miss,
        but it also produces more false positives on dense, formal human writing.
      </p>
      <p style={kitStyles.p}>
        <Link href="/detectors/originality-ai" style={detectorLink}>Read the Originality.ai guide</Link>
      </p>

      <h2 style={kitStyles.h2}>Copyleaks</h2>
      <p style={kitStyles.p}>
        Copyleaks markets itself to enterprises and institutions and offers AI detection alongside
        plagiarism scanning, with support across many languages. It typically returns a confidence
        level rather than a single hard percentage, and it is frequently integrated into learning
        management systems and content platforms via its API. Because it is positioned as an
        institutional tool, a Copyleaks flag often carries more procedural weight than a casual
        consumer check.
      </p>
      <p style={kitStyles.p}>
        <Link href="/detectors/copyleaks" style={detectorLink}>Read the Copyleaks guide</Link>
      </p>

      <h2 style={kitStyles.h2}>Winston AI</h2>
      <p style={kitStyles.p}>
        Winston AI targets educators and content teams and reports a &quot;human score,&quot; where a
        higher number means the text reads as more human. It also offers OCR for scanned documents and
        a readability breakdown, which makes it common in classroom settings. Like the others, its
        score is a probability estimate, and the same caveats about false positives apply &mdash;
        especially on short, plain, or highly templated writing.
      </p>
      <p style={kitStyles.p}>
        <Link href="/detectors/winston-ai" style={detectorLink}>Read the Winston AI guide</Link>
      </p>

      <h2 style={kitStyles.h2}>How to use these guides</h2>
      <p style={kitStyles.p}>
        The approach is the same regardless of detector: start with writing you actually own, check
        it to see which passages read as flat or mechanical, and revise them so they recover the
        natural variation in word choice and sentence length your writing usually has. Our rewriting
        assistant can suggest a more natural version of a passage while keeping your meaning; it is a
        polishing step, not a substitute for doing the work, and it cannot promise any detector
        score. Detectors update their models regularly, so no result &mdash; clean or flagged
        &mdash; should be treated as permanent or absolute. Always follow your school&apos;s or
        employer&apos;s rules on AI use.
      </p>
      <p style={kitStyles.p}>
        If your own honest writing keeps getting mislabeled, the workflow is simple: check it with
        the{" "}
        <Link href="/ai-detector" style={{ color: THEME.brandHi }}>AI detector</Link> to see which
        sentences trigger the flag, revise them in your own voice (or with the{" "}
        <Link href="/free-ai-humanizer" style={{ color: THEME.brandHi }}>rewriting assistant</Link>),
        and read the result yourself to make sure it still says what you mean.
      </p>

      <FaqSection
        faqs={[
          {
            q: "Can any tool guarantee a detector score?",
            a: "No. Writing that varies its word choice and sentence rhythm the way human writing naturally does tends to read as less machine-like, but no tool or method can guarantee what any detector will say &mdash; detectors retrain, and each one weights its signals differently. We do not promise detector outcomes, and you should be wary of anyone who does.",
          },
          {
            q: "Are AI detectors accurate?",
            a: "They are estimators, not proof. Detectors measure statistical patterns such as perplexity and burstiness and report a probability that text is AI-generated. Independent testing and the detector vendors' own disclaimers acknowledge that false positives occur, particularly on short, formal, or templated human writing. A score should inform a judgment, not replace one.",
          },
          {
            q: "Why does one detector flag my text while another clears it?",
            a: "Each tool was trained on different data, classifies at a different level (whole-document versus sentence-by-sentence), and sets its threshold in a different place. A passage that looks borderline to a strict tool like Originality.ai can read as clean to a more lenient one. That is why we publish a separate guide per detector.",
          },
          {
            q: "What should I do if my own writing is flagged?",
            a: "Keep your drafts, notes and version history, which are the strongest evidence of authorship. Ask which tool produced the score, and point out that detector vendors describe their scores as indicators, not proof. Passing off generated work as your own where rules forbid it is never acceptable; these guides explain how the tools work so honest writers can understand and contest a false flag.",
          },
          {
            q: "Will rewriting my text change its meaning?",
            a: "A good rewrite varies phrasing while preserving your argument and facts, but no rewrite is perfect. Always read the output before you use it to confirm it still says what you intended and hasn't introduced errors, especially in technical or cited passages.",
          },
        ]}
      />

      <PageCta
        heading="See which sentences read as AI, before you submit"
        body="Paste your draft into the free AI detector to see which sentences trigger the patterns detectors look for, and why. No account needed."
        href="/ai-detector"
        cta="Check My Writing"
      />
    </div>
  );
}
