import Link from "next/link";
import type { Metadata } from "next";
import { THEME, glow } from "@/lib/theme";

export const metadata: Metadata = {
  title: "HumanizeIt for Agencies — Bulk AI Humanization | HumanizeIt",
  description:
    "Content agencies use HumanizeIt to humanize AI-generated text at scale. Bulk processing, API access, team collaboration. TEAM plan at $29/mo with unlimited members.",
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
    title: "HumanizeIt for Agencies — Bulk AI Humanization | HumanizeIt",
    description:
      "Content agencies use HumanizeIt to humanize AI-generated text at scale. Bulk processing, API access, and team features. TEAM plan $29/mo.",
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
        challenge: how do you ensure that dozens or hundreds of AI-assisted pieces per month pass AI detection checks and
        read as genuinely human-written content?
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
        HumanizeIt eliminates this bottleneck entirely. By standardizing the humanization process through a single
        platform, every piece of content that leaves your agency meets the same high bar for natural, human-sounding
        prose — regardless of which writer produced it.
      </p>

      <h2 style={h2Style}>Bulk Processing: Humanize Dozens of Articles at Once</h2>
      <p style={pStyle}>
        The TEAM plan unlocks HumanizeIt&apos;s bulk processing mode, designed specifically for high-volume content
        operations. Instead of pasting articles one by one, you can upload an entire batch of documents and humanize them
        all in a single operation. Upload 20 blog posts on Monday morning and have them all humanized and ready for
        review by lunchtime.
      </p>
      <p style={pStyle}>
        Bulk processing supports all three humanization levels (Light, Medium, and Aggressive), and you can set different
        levels for different documents within the same batch. A technical white paper might need only Light humanization
        to preserve precise terminology, while a casual blog post might benefit from the Medium or Aggressive setting for
        maximum natural flow.
      </p>

      <h2 style={h2Style}>API Access: Integrate into Your Existing Workflow</h2>
      <p style={pStyle}>
        For agencies that have built custom content management systems or use automation tools like Zapier and Make,
        HumanizeIt&apos;s REST API opens up powerful integration possibilities. Automatically humanize content as part of
        your production pipeline — no manual steps required.
      </p>
      <p style={pStyle}>
        Imagine this workflow: a writer submits an AI-assisted draft through your project management tool. A webhook
        triggers the HumanizeIt API, which humanizes the text and routes the output to your editing queue. By the time an
        editor picks it up, the content already reads naturally and passes AI detection. The entire humanization step
        happens in the background, invisibly, without adding time to anyone&apos;s workflow.
      </p>
      <p style={pStyle}>
        The API supports all humanization levels, batch processing, and returns detailed metadata including estimated AI
        detection scores before and after humanization. Full documentation and SDKs for Python, Node.js, and PHP are
        included with the TEAM plan.
      </p>

      <h2 style={h2Style}>Team Collaboration Features</h2>
      <p style={pStyle}>
        The TEAM plan includes unlimited team members at no extra cost. Every writer, editor, and project manager at your
        agency gets their own account under a single subscription. A centralized dashboard lets managers track usage,
        monitor humanization quality, and manage permissions across the team.
      </p>
      <p style={pStyle}>
        Shared templates allow you to save humanization presets for different clients or content types. Set up a
        &quot;Client A - Blog Posts&quot; template with Medium humanization and specific style preferences, and every
        writer on that account uses the same settings. No more guesswork, no more inconsistency.
      </p>

      <h2 style={h2Style}>ROI That Speaks for Itself</h2>
      <p style={pStyle}>
        Let&apos;s do the math. If your agency has 5 writers and each spends an average of 2 hours per day manually
        rewriting AI-assisted content to pass detection checks, that&apos;s 10 hours of labor per day — roughly $300 to
        $500 in wages, depending on your rates. Over a month, that&apos;s $6,000 to $10,000 spent purely on manual
        humanization work.
      </p>
      <p style={pStyle}>
        HumanizeIt&apos;s TEAM plan costs $29 per month. That&apos;s it. Unlimited team members, bulk processing, and
        API access for less than what a single writer costs for one hour. The tool doesn&apos;t just pay for itself on
        day one — it pays for itself within the first hour of the first day. The remaining savings go straight to your
        bottom line or can be reinvested in acquiring more clients and scaling your operation further.
      </p>

      <h2 style={h2Style}>Case Study: How One Agency Tripled Their Content Output</h2>
      <p style={pStyle}>
        Consider the experience of a mid-sized digital marketing agency managing content for 12 clients across various
        industries. Before HumanizeIt, their team of 8 writers produced an average of 40 articles per week. Each writer
        spent roughly half their day on manual rewrites to ensure AI-assisted drafts would pass client-side AI detection
        scans.
      </p>
      <p style={pStyle}>
        After integrating HumanizeIt into their workflow — using the API to automatically humanize drafts as they moved
        through the production pipeline — the same team began producing over 120 articles per week. That&apos;s a 3x
        increase in content output with zero additional hires. Client satisfaction remained high: not a single piece was
        flagged by AI detection tools, and the quality ratings from client feedback surveys actually improved by 15%.
      </p>
      <p style={pStyle}>
        The agency was able to take on 5 new clients within the first quarter of using HumanizeIt, generating an
        additional $18,000 in monthly recurring revenue — all while keeping their team size and overhead the same.
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
          The TEAM plan at $29/mo gives your entire agency unlimited team members, bulk processing, and full API access.
          It pays for itself before lunch on day one.
        </p>
        <Link
          href="/sign-up"
          className="inline-block font-bold rounded-full px-8 py-3 transition"
          style={{ background: THEME.gradient, color: "#ffffff", boxShadow: glow(THEME.brand, 0.36) }}
        >
          Get TEAM for $29/mo &rarr;
        </Link>
      </div>
    </div>
  );
}
