import Link from "next/link";
import type { Metadata } from "next";
import { THEME, glow } from "@/lib/theme";

export const metadata: Metadata = {
  title: "AI Humanizer for Copywriters: Write Faster | HumanizeIt",
  description:
    "Copywriters use HumanizeIt to turn fast AI drafts into natural, on-brand copy and check it for AI-like patterns before clients do. Pro plan $9/mo.",
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
    title: "AI Humanizer for Copywriters: Write Faster | HumanizeIt",
    description:
      "Turn fast AI drafts into natural, on-brand copy and check it for AI-like patterns before clients do. Pro plan at $9/mo.",
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
        <Link href="/use-cases" className="hover:underline">
          Use Cases
        </Link>
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
        more content, faster, at lower rates. AI drafting tools let you meet that demand. On the other side, generic
        AI copy doesn&apos;t perform. Google rewards helpful content however it&apos;s produced, but thin, samey pages
        don&apos;t rank — and that&apos;s what raw drafts often look like. Clients use tools like Originality.ai to scan
        deliverables before accepting them, and some publishing platforms run automated checks before articles go live.
      </p>
      <p style={pStyle}>
        The result? Copywriters who use AI to draft content can spend almost as long rewriting it to sound human as they
        would have spent writing it from scratch, and the productivity gains evaporate. That&apos;s the step HumanizeIt
        speeds up.
      </p>

      <h2 style={{ ...h2Style, display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
        Spend Less Time on Rewrites
        <span style={{ fontSize: "12px", fontWeight: 700, color: "#ffffff", background: THEME.accent, padding: "4px 12px", borderRadius: "999px", letterSpacing: "0", fontFamily: THEME.fontSans }}>
          Example estimate
        </span>
      </h2>
      <p style={pStyle}>
        Here&apos;s a rough example — your numbers will differ. Say a 1,500-word blog post takes 3 to 4 hours to
        research, outline, draft, and polish from scratch. Using AI for the first draft might cut that to about 1 hour
        of prompting and editing, but then you spend another 1 to 2 hours rewriting sentences, varying structure, and
        adding &quot;human touches&quot; so it doesn&apos;t read like a machine wrote it.
      </p>
      <p style={pStyle}>
        With HumanizeIt, the rewrite itself takes seconds. Paste your AI-assisted draft, click Humanize, and you get back
        a more natural-sounding version plus a before-and-after score, so your time goes into reviewing and adding your
        own insight instead of rewriting line by line. In this example that could bring a post down to well under two
        hours — across five articles a week, that adds up fast.
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
          <strong>Check, then deliver:</strong> Run the final piece through the{" "}
          <Link href="/ai-detector" style={{ color: THEME.brandHi }}>AI detector</Link>, fix anything that still reads
          mechanically, and deliver copy that reads as authentic, engaging content.
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
        HumanizeIt adapts its humanization to match. The aim is to keep your voice while reducing the statistical
        patterns that AI detectors look for — and you stay in control of the final edit.
      </p>

      <h2 style={h2Style}>Client Satisfaction: Deliver Human-Quality Content, Faster</h2>
      <p style={pStyle}>
        Your clients care about two things: quality and speed. With HumanizeIt in your workflow, you deliver on both.
        Content arrives faster because you&apos;re not spending hours on manual rewrites. Quality stays high because
        HumanizeIt is built to keep meaning, structure, and tone while making the text more pleasant to read. A careful
        rewrite plus your own review usually beats a hasty manual &quot;de-AI-ifying&quot; pass, and the time you save
        can go into the research and ideas clients actually pay for.
      </p>

      <h2 style={h2Style}>Pricing That Pays for Itself Instantly</h2>
      <p style={pStyle}>
        Our Pro plan costs just $9 per month. Consider this: if you charge $100 for a blog post and HumanizeIt saves you
        2 hours per article, you&apos;re effectively earning an extra $200+ per month in reclaimed productivity from just
        two articles. The tool pays for itself with a single piece of content. For freelance copywriters operating on
        tight margins, that&apos;s a good trade. And if you&apos;re just getting started, the Free plan gives you 500
        words a day — enough to test the workflow and see the results for yourself.
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
          Try the workflow on your next draft. The Pro plan at $9/mo gives you 50,000 words a month.
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
