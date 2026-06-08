import Link from "next/link";
import type { Metadata } from "next";
import { THEME, glow } from "@/lib/theme";

export const metadata: Metadata = {
  title: "HumanizeIt for Copywriters — Write Faster, Sound Human | HumanizeIt",
  description:
    "Copywriters use HumanizeIt to speed up content production without triggering AI detectors. Draft with AI, humanize with HumanizeIt, publish with confidence. Pro plan $9/mo.",
  keywords: [
    "AI copywriting",
    "humanize AI content",
    "copywriter AI tools",
    "AI content detection",
    "HumanizeIt copywriters",
    "undetectable AI writing",
    "content writing workflow",
    "AI text humanizer",
  ],
  openGraph: {
    title: "HumanizeIt for Copywriters — Write Faster, Sound Human | HumanizeIt",
    description:
      "Copywriters use HumanizeIt to speed up content production without triggering AI detectors. Pro plan at $9/mo.",
    url: "https://humanizeit.app/use-cases/copywriters",
    type: "website",
  },
  alternates: {
    canonical: "https://humanizeit.app/use-cases/copywriters",
  },
};

const h2Style = {
  fontFamily: THEME.fontHeading,
  fontWeight: 700,
  color: THEME.text,
  fontSize: "24px",
  marginTop: "40px",
  marginBottom: "16px",
  letterSpacing: "-0.01em",
};

const pStyle = {
  color: THEME.textDim,
  lineHeight: 1.75,
  marginBottom: "16px",
  fontSize: "16px",
};

export default function CopywritersUseCasePage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      {/* Breadcrumb */}
      <nav className="text-sm mb-8" style={{ color: THEME.textDim }}>
        <Link href="/" className="hover:underline">
          Home
        </Link>
        {" > "}
        <span>Use Cases</span>
        {" > "}
        <span>Copywriters</span>
      </nav>

      <div className="kicker" style={{ marginBottom: "16px" }}>For copywriters</div>
      <h1
        style={{
          fontFamily: THEME.fontHeading,
          fontWeight: 800,
          color: THEME.text,
          fontSize: "clamp(28px, 5vw, 38px)",
          letterSpacing: "-0.02em",
          marginBottom: "24px",
          lineHeight: 1.15,
        }}
      >
        HumanizeIt for Copywriters: Write Faster Without Sacrificing{" "}
        <span style={{ color: THEME.brand }}>Authenticity</span>
      </h1>

      <p style={pStyle}>
        The copywriting industry has been transformed by AI. Tools like ChatGPT and Claude can produce first drafts in
        minutes that once took hours to write. But there&apos;s a catch that every professional copywriter has run into:
        clients, editors, and publishing platforms are now actively scanning for AI-generated content. Getting flagged
        doesn&apos;t just mean a rejected article — it can mean a lost client, a damaged reputation, and a serious hit to
        your income.
      </p>

      <h2 style={h2Style}>The Copywriter&apos;s Dilemma</h2>
      <p style={pStyle}>
        You&apos;re caught between two forces. On one side, the economics of content creation demand speed. Clients want
        more content, faster, at lower rates. AI drafting tools let you meet that demand. On the other side, the market
        increasingly penalizes AI-generated content. Google has signaled that AI-generated content may be treated
        differently in search rankings. Clients use tools like Originality.ai to scan deliverables before accepting
        them. Publishing platforms run automated checks before articles go live.
      </p>
      <p style={pStyle}>
        The result? Copywriters who use AI to draft content spend just as long manually rewriting it to pass detection as
        they would have spent writing it from scratch. The productivity gains evaporate. That&apos;s where HumanizeIt
        changes everything.
      </p>

      <h2 style={{ ...h2Style, display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
        Save 2+ Hours Per Article
        <span style={{ fontSize: "12px", fontWeight: 700, color: "#ffffff", background: THEME.accent, padding: "4px 12px", borderRadius: "999px", letterSpacing: "0", fontFamily: THEME.fontSans }}>
          10+ hrs/week
        </span>
      </h2>
      <p style={pStyle}>
        Let&apos;s talk numbers. A typical 1,500-word blog post takes 3 to 4 hours to research, outline, draft, and
        polish when writing from scratch. Using AI for the first draft cuts that to about 1 hour of prompting and
        editing. But then you spend another 1 to 2 hours manually rewriting sentences, varying structure, and adding
        &quot;human touches&quot; to pass AI detection.
      </p>
      <p style={pStyle}>
        With HumanizeIt, the humanization step takes about 30 seconds. Paste your AI-assisted draft, click Humanize, and
        you get back polished, natural-sounding copy that passes every major AI detector. That means your total time per
        article drops to roughly 1 hour and 15 minutes — saving you over 2 hours compared to the manual rewriting
        approach. Over a week of producing 5 articles, that&apos;s 10+ hours saved. Over a month, it&apos;s the
        equivalent of an entire work week reclaimed.
      </p>

      <h2 style={h2Style}>The Optimal Copywriting Workflow</h2>
      <p style={pStyle}>
        The most productive copywriters using HumanizeIt follow a four-step workflow that maximizes both speed and
        quality:
      </p>
      <ol style={{ ...pStyle, paddingLeft: "24px", marginBottom: "16px" }}>
        <li style={{ marginBottom: "8px" }}>
          <strong>Draft with AI:</strong> Use ChatGPT, Claude, or your preferred AI tool to generate a solid first draft.
          Focus your prompts on capturing the right angle, tone, and key points.
        </li>
        <li style={{ marginBottom: "8px" }}>
          <strong>Humanize with HumanizeIt:</strong> Paste the draft into HumanizeIt and select your humanization level.
          For most client work, the Medium setting strikes the ideal balance between natural language and content
          preservation.
        </li>
        <li style={{ marginBottom: "8px" }}>
          <strong>Quick manual review:</strong> Spend 10 to 15 minutes reviewing the humanized output. Add your personal
          insights, adjust any brand-specific terminology, and ensure the piece hits every brief requirement.
        </li>
        <li style={{ marginBottom: "8px" }}>
          <strong>Publish with confidence:</strong> Deliver the final piece knowing it will pass AI detection scans and
          read as authentic, engaging content.
        </li>
      </ol>

      <h2 style={h2Style}>Quality Assurance: Your Tone, Your Message</h2>
      <p style={pStyle}>
        One of the biggest concerns copywriters have about humanization tools is losing control of the message.
        HumanizeIt was designed with professional writers in mind. It doesn&apos;t just randomly shuffle words or inject
        awkward phrasings. Instead, it intelligently restructures sentences, varies rhythm and cadence, and adjusts
        vocabulary in ways that preserve your intended tone and message.
      </p>
      <p style={pStyle}>
        Whether you&apos;re writing punchy sales copy, authoritative thought leadership, or conversational blog posts,
        HumanizeIt adapts its humanization to match. The output maintains your voice — it just removes the statistical
        fingerprints that AI detectors look for.
      </p>

      <h2 style={h2Style}>Client Satisfaction: Deliver Human-Quality Content, Faster</h2>
      <p style={pStyle}>
        Your clients care about two things: quality and speed. With HumanizeIt in your workflow, you deliver on both.
        Content arrives faster because you&apos;re not spending hours on manual rewrites. Quality stays high because
        HumanizeIt preserves meaning, structure, and tone while making the text genuinely pleasant to read.
      </p>
      <p style={pStyle}>
        Many of our copywriter users report that client satisfaction scores have actually improved since adopting
        HumanizeIt. The humanized output often reads more naturally than text that was manually &quot;de-AI-ified&quot;
        through hasty rewrites. Clients get better content, and you get to take on more projects — everyone wins.
      </p>

      <h2 style={h2Style}>Pricing That Pays for Itself Instantly</h2>
      <p style={pStyle}>
        Our Pro plan costs just $9 per month. Consider this: if you charge $100 for a blog post and HumanizeIt saves you
        2 hours per article, you&apos;re effectively earning an extra $200+ per month in reclaimed productivity from just
        two articles. The tool pays for itself with a single piece of content. For freelance copywriters operating on
        tight margins, this kind of ROI is rare. And if you&apos;re just getting started, our Free plan lets you
        humanize up to 3 documents per day — enough to test the workflow and see the results for yourself.
      </p>

      {/* CTA Box */}
      <div
        className="rounded-2xl p-8 text-center"
        style={{
          marginTop: "48px",
          background: THEME.surface1,
          border: `1px solid ${THEME.border}`,
          boxShadow: glow(THEME.brand, 0.18),
        }}
      >
        <h2 style={{ fontFamily: THEME.fontHeading, fontWeight: 700, fontSize: "24px", marginBottom: "12px", color: THEME.text, letterSpacing: "-0.02em" }}>
          Supercharge Your Copywriting Workflow
        </h2>
        <p style={{ fontSize: "16px", lineHeight: 1.75, marginBottom: "24px", color: THEME.textDim }}>
          Join thousands of copywriters using HumanizeIt to deliver more content, faster. The Pro plan at $9/mo pays for
          itself with your very first article.
        </p>
        <Link
          href="/sign-up"
          className="inline-block font-bold rounded-full px-8 py-3 transition"
          style={{ background: THEME.gradient, color: "#ffffff", boxShadow: glow(THEME.brand, 0.36) }}
        >
          Get Pro for $9/mo &rarr;
        </Link>
      </div>
    </div>
  );
}
