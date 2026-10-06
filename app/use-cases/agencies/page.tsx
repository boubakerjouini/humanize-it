import Link from "next/link";
import type { Metadata } from "next";
import { THEME, glow } from "@/lib/theme";

export const metadata: Metadata = {
  title: "AI Humanizer for Agencies: Content at Scale | HumanizeIt",
  description:
    "Agencies use HumanizeIt to check and humanize AI-assisted drafts at scale: document uploads, a REST API, and per-seat team organizations. Team plan $29/mo.",
  keywords: [
    "bulk AI humanization",
    "agency AI content",
    "AI content at scale",
    "HumanizeIt agencies",
    "team AI writing",
    "API AI humanizer",
    "content agency tools",
    "undetectable AI bulk",
  ],
  openGraph: {
    title: "AI Humanizer for Agencies: Content at Scale | HumanizeIt",
    description:
      "Check and humanize AI-assisted drafts at scale with document uploads, a REST API, and per-seat team organizations. Team plan $29/mo.",
    url: "https://humanizeit.app/use-cases/agencies",
    type: "website",
  },
  alternates: {
    canonical: "https://humanizeit.app/use-cases/agencies",
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

export default function AgenciesUseCasePage() {
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
        <span>Agencies</span>
      </nav>

      <div className="kicker" style={{ marginBottom: "16px" }}>For agencies</div>
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
        HumanizeIt for Agencies: AI Humanization{" "}
        <span style={{ color: THEME.brand }}>at Scale</span>
      </h1>

      <p style={pStyle}>
        Content agencies operate in a world where volume and quality are equally non-negotiable. Your clients expect a
        steady stream of high-quality articles, landing pages, email sequences, and social media copy — and they expect
        it fast. AI writing tools have been a game-changer for production speed, but they&apos;ve also introduced a new
        challenge: how do you make sure dozens or hundreds of AI-assisted pieces per month read as genuinely
        human-written content — and hold up when a client runs them through an AI detector?
      </p>

      <h2 style={h2Style}>The Agency Challenge: Quality at Scale</h2>
      <p style={pStyle}>
        Managing content production for multiple clients means juggling different brand voices, style guidelines, and
        quality standards simultaneously. When you have a team of 5, 10, or 20 writers all using AI tools to accelerate
        their output, consistency becomes a nightmare. Each writer has their own approach to &quot;humanizing&quot; AI
        drafts — some are good at it, others aren&apos;t. The result is inconsistent quality, missed deadlines from
        manual rewrites, and the constant anxiety that a client will run a piece through an AI detector and question your
        agency&apos;s integrity.
      </p>
      <p style={pStyle}>
        HumanizeIt gives your team one consistent process: the same pattern checks, the same rewrite levels, and a
        score before and after for every piece — regardless of which writer produced it.
      </p>

      <h2 style={h2Style}>Document Uploads and Room to Scale</h2>
      <p style={pStyle}>
        The Team plan includes 200,000 words a month and lets you upload PDF and Word documents of up to 50,000 words,
        so long-form deliverables go through in one pass instead of paste by paste. Each document gets its own pattern
        breakdown, so editors can see at a glance which pieces need the most attention.
      </p>
      <p style={pStyle}>
        You choose the rewrite level per document (Light, Medium, or Heavy). A technical white paper might need only a
        Light pass to preserve precise terminology, while a casual blog post might benefit from Medium or Heavy for a
        more natural flow.
      </p>

      <h2 style={h2Style}>API Access: Integrate into Your Existing Workflow</h2>
      <p style={pStyle}>
        For agencies that have built custom content management systems or use automation tools like Zapier and Make
        (through their HTTP steps), HumanizeIt&apos;s REST API lets you analyze and humanize content as part of your
        production pipeline.
      </p>
      <p style={pStyle}>
        Imagine this workflow: a writer submits an AI-assisted draft through your project management tool. A webhook
        triggers the HumanizeIt API, which humanizes the text and routes the output to your editing queue. By the time an
        editor picks it up, the draft has already been humanized and scored, so the review starts from a cleaner
        version.
      </p>
      <p style={pStyle}>
        The API takes a tone and a rewrite level and returns the AI-likelihood score before and after humanization.
        It&apos;s included with the Team plan, and the{" "}
        <Link href="/docs/api" style={{ color: THEME.brandHi }}>API documentation</Link> covers authentication and
        every endpoint.
      </p>

      <h2 style={h2Style}>Team Collaboration Features</h2>
      <p style={pStyle}>
        For a whole team, create an organization and buy seats: each seat costs $12 a month (or $120 a year), gives a
        member Team-level features, and adds 100,000 words to the organization&apos;s shared monthly pool. Admins invite
        writers and editors with a personal invite link and manage seats from one place.
      </p>

      <h2 style={h2Style}>ROI That Speaks for Itself</h2>
      <p style={pStyle}>
        Let&apos;s do some rough math — plug in your own numbers. If your agency has 5 writers and each spends 2 hours
        a day manually rewriting AI-assisted drafts so they sound human, that&apos;s 10 hours of labor per day — roughly
        $300 to $500 in wages, depending on your rates.
      </p>
      <p style={pStyle}>
        HumanizeIt&apos;s Team plan costs $29 a month, and organization seats are $12 per member. Even if it only takes
        a fraction of that rewriting time off each writer&apos;s plate, it pays for itself quickly, and the hours you
        get back can go into client work that needs a human.
      </p>

      <h2 style={h2Style}>A Practical Agency Workflow</h2>
      <p style={pStyle}>
        Writers draft with whatever AI tools your clients allow. Each draft goes through the{" "}
        <Link href="/ai-detector" style={{ color: THEME.brandHi }}>AI detector</Link> so the editor can see which
        patterns stand out, then gets humanized at the level that fits the content. An editor reviews every piece for
        accuracy, brand voice, and the brief before it ships — the rewrite handles texture, your team handles judgment.
      </p>
      <p style={pStyle}>
        No tool can guarantee how a client&apos;s detector will score a piece, and detectors change often, so build a
        re-check into delivery rather than promising a score. And if a contract says anything about how AI may be used,
        follow it: humanizing a draft doesn&apos;t change how it was produced.
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
          Scale Your Agency&apos;s Content Production
        </h2>
        <p style={{ fontSize: "16px", lineHeight: 1.75, marginBottom: "24px", color: THEME.textDim }}>
          The Team plan at $29/mo includes 200,000 words a month, document uploads, and full API access. Add teammates
          with $12/month organization seats.
        </p>
        <Link
          href="/sign-up"
          className="inline-block font-bold rounded-full px-8 py-3 transition"
          style={{ background: THEME.gradient, color: "#ffffff", boxShadow: glow(THEME.brand, 0.36) }}
        >
          Get Team for $29/mo &rarr;
        </Link>
      </div>
    </div>
  );
}
