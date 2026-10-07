import Link from "next/link";
import type { Metadata } from "next";
import { THEME, glow } from "@/lib/theme";

export const metadata: Metadata = {
  title: "HumanizeIt vs Undetectable.ai (2026): Honest Comparison",
  description:
    "An honest, side-by-side comparison of HumanizeIt and Undetectable.ai: pricing, free tier, billing transparency, output quality, and how each shows its work.",
  keywords: [
    "HumanizeIt vs Undetectable.ai",
    "Undetectable.ai alternative",
    "AI humanizer comparison",
    "best AI humanizer 2026",
    "Undetectable.ai pricing",
    "AI text humanizer",
  ],
  openGraph: {
    title: "HumanizeIt vs Undetectable.ai (2026): Honest Comparison",
    description:
      "Side-by-side comparison of HumanizeIt and Undetectable.ai covering price, quality, transparency, and features.",
    type: "article",
    url: "https://humanizeit.app/compare/humanizeit-vs-undetectable-ai",
  },
  alternates: {
    canonical: "https://humanizeit.app/compare/humanizeit-vs-undetectable-ai",
  },
};

const h2Style: React.CSSProperties = {
  fontFamily: THEME.fontHeading,
  fontWeight: 700,
  color: THEME.text,
  fontSize: "24px",
  marginTop: "40px",
  marginBottom: "16px",
  letterSpacing: "-0.01em",
};

const pStyle: React.CSSProperties = {
  color: THEME.textDim,
  lineHeight: 1.75,
  marginBottom: "16px",
  fontSize: "16px",
};

const thStyle: React.CSSProperties = {
  padding: "14px 16px",
  textAlign: "left",
  fontWeight: 600,
  fontSize: "13px",
  color: THEME.textDim,
  borderBottom: `1px solid ${THEME.borderStrong}`,
  backgroundColor: THEME.surface1,
};

// HumanizeIt column header — purple highlight.
const thBrandStyle: React.CSSProperties = {
  ...thStyle,
  fontWeight: 800,
  color: THEME.brandHi,
  backgroundColor: THEME.brandDim,
  borderBottom: `2px solid ${THEME.brand}`,
  fontFamily: THEME.fontHeading,
};

const tdStyle: React.CSSProperties = {
  padding: "13px 16px",
  fontSize: "14px",
  color: THEME.textDim,
  borderBottom: `1px solid ${THEME.border}`,
};

const tdAltStyle: React.CSSProperties = {
  ...tdStyle,
  backgroundColor: THEME.surface1,
};

// "Win" cell styling — green highlight on a soft purple HumanizeIt column.
const winStyle: React.CSSProperties = {
  fontWeight: 700,
  color: THEME.human,
  backgroundColor: THEME.brandDim,
  textAlign: "center",
};

// Competitor value cells — centered to align with headers.
const tdValStyle: React.CSSProperties = { ...tdStyle, textAlign: "center" };
const tdValAltStyle: React.CSSProperties = { ...tdAltStyle, textAlign: "center" };

export default function HumanizeItVsUndetectableAi() {
  return (
    <main style={{ maxWidth: "768px", margin: "0 auto", padding: "48px 16px" }}>
      {/* Breadcrumb */}
      <nav style={{ fontSize: "14px", color: THEME.textDim, marginBottom: "32px" }}>
        <Link href="/" style={{ color: THEME.textDim, textDecoration: "none" }}>
          Home
        </Link>
        <span style={{ margin: "0 8px" }}>&gt;</span>
        <Link href="/compare" style={{ color: THEME.textDim, textDecoration: "none" }}>
          Compare
        </Link>
        <span style={{ margin: "0 8px" }}>&gt;</span>
        <span style={{ color: THEME.text }}>HumanizeIt vs Undetectable.ai</span>
      </nav>

      {/* H1 */}
      <div className="kicker" style={{ marginBottom: "16px" }}>Head-to-head comparison</div>
      <h1
        style={{
          fontFamily: THEME.fontHeading,
          fontWeight: 800,
          color: THEME.text,
          fontSize: "clamp(28px, 5vw, 38px)",
          lineHeight: 1.2,
          letterSpacing: "-0.02em",
          marginBottom: "24px",
        }}
      >
        HumanizeIt vs Undetectable.ai (2026): An{" "}
        <span style={{ color: THEME.brand }}>Honest, Side-by-Side</span> Comparison
      </h1>

      <p style={pStyle}>
        Choosing the right AI humanizer can save you money and a lot of rewriting time. In this
        comparison we put HumanizeIt head-to-head against Undetectable.ai — one of the most heavily
        marketed tools in the space — and look at pricing, the free tier, output quality, and billing
        transparency so you can make an informed decision.
      </p>

      {/* Overview */}
      <h2 style={h2Style}>What Is HumanizeIt?</h2>
      <p style={pStyle}>
        HumanizeIt is an AI humanizer and AI detector for students, bloggers, and content teams who
        want natural-sounding writing without breaking the bank. Starting at $9 per month with a
        genuinely free tier, it scores text against the patterns detectors like GPTZero and Turnitin
        look for, shows you exactly which ones triggered, and rewrites the text to reduce them. There
        are no hidden charges, and you can cancel any time from your dashboard.
      </p>

      <h2 style={h2Style}>What Is Undetectable.ai?</h2>
      <p style={pStyle}>
        Undetectable.ai is one of the best-known AI humanizing platforms. It offers a score-only free
        preview and paid plans that start above HumanizeIt&apos;s. The tool produces decent output,
        but public reviews on sites like Reddit and Trustpilot include complaints about unexpected
        renewals and cancellation — worth reading before you subscribe to any tool.
      </p>

      {/* Comparison Table */}
      <h2 style={h2Style}>Feature-by-Feature Comparison</h2>
      <p style={pStyle}>
        The table below summarizes the most important differences between HumanizeIt and
        Undetectable.ai.
      </p>

      <div style={{ overflowX: "auto", marginBottom: "32px" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            border: `1px solid ${THEME.border}`,
            borderRadius: THEME.radius,
            overflow: "hidden",
            background: THEME.surface2,
          }}
        >
          <thead>
            <tr>
              <th style={thStyle}>Feature</th>
              <th style={{ ...thBrandStyle, textAlign: "center" }}>HumanizeIt</th>
              <th style={{ ...thStyle, textAlign: "center" }}>Undetectable.ai</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={tdStyle}>Price</td>
              <td style={{ ...tdStyle, ...winStyle }}>$9/mo</td>
              <td style={tdValStyle}>From $9.99/mo</td>
            </tr>
            <tr>
              <td style={tdAltStyle}>Free Tier</td>
              <td style={{ ...tdAltStyle, ...winStyle }}>Yes</td>
              <td style={tdValAltStyle}>Score-only preview</td>
            </tr>
            <tr>
              <td style={tdStyle}>Billing</td>
              <td style={{ ...tdStyle, ...winStyle }}>Clear pricing, cancel anytime</td>
              <td style={tdValStyle}>Renewal complaints in public reviews</td>
            </tr>
            <tr>
              <td style={tdAltStyle}>Pattern-by-pattern breakdown</td>
              <td style={{ ...tdAltStyle, ...winStyle }}>Yes</td>
              <td style={tdValAltStyle}>Score only</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Pricing */}
      <h2 style={h2Style}>Pricing: Start Free, Then $9/mo</h2>
      <p style={pStyle}>
        HumanizeIt costs $9 per month on the Pro plan — or less with annual billing — for 50,000 words
        a month. Undetectable.ai&apos;s paid plans start higher; check its pricing page for the current
        word limits, and compare what you would actually pay for the volume you need.
      </p>
      <p style={pStyle}>
        More importantly, HumanizeIt includes a genuinely free tier — plus a no-signup{" "}
        <Link href="/free-ai-humanizer" style={{ color: THEME.brandHi }}>free humanizer</Link> — so you
        can test real output before you commit. Undetectable.ai&apos;s free option shows a detection
        score rather than a full rewrite, so you see much less of the output before paying.
      </p>

      {/* Billing Transparency */}
      <h2 style={h2Style}>Billing Transparency: A Critical Difference</h2>
      <p style={pStyle}>
        A search on Reddit or Trustpilot for &ldquo;Undetectable.ai billing&rdquo; turns up user
        complaints about auto-renewals they didn&apos;t expect and trouble cancelling. We can&apos;t
        verify individual stories, but the pattern is worth knowing about before you enter card
        details anywhere.
      </p>
      <p style={pStyle}>
        HumanizeIt keeps billing simple: the price you pick is the price you pay, your subscription
        can be managed and cancelled from your dashboard at any time, and every paid plan, monthly or
        annual, comes with a 14-day money-back guarantee (30 days on Team annual). We believe that if a product is good enough, you should not
        need to trick people into staying.
      </p>

      {/* Output Quality */}
      <h2 style={h2Style}>Output Quality: How Do the Results Compare?</h2>
      <p style={pStyle}>
        Both tools can produce readable, natural-sounding text, and both can stumble: any humanizer
        that paraphrases aggressively can drift from your meaning, so read the output whichever tool
        you use. HumanizeIt&apos;s rewrites are guided by its pattern analysis — they target the
        specific signals in your text and aim to keep your meaning and tone while adding natural
        sentence-level variation.
      </p>
      <p style={pStyle}>
        What we won&apos;t give you is a &ldquo;bypass rate.&rdquo; Detectors update constantly and
        score the same text differently, so any fixed percentage — ours or a competitor&apos;s — is
        marketing, not measurement. The honest test is your own text: run it through both tools, then
        check the results with a{" "}
        <Link href="/ai-detector" style={{ color: THEME.brandHi }}>free AI detector</Link>.
      </p>

      {/* API */}
      <h2 style={h2Style}>API Access</h2>
      <p style={pStyle}>
        If you are a developer or run a content agency, you need programmatic access. HumanizeIt
        offers a documented{" "}
        <Link href="/docs/api" style={{ color: THEME.brandHi }}>REST API</Link> on its paid plans,
        letting you analyze and humanize text from your publishing workflow, CMS, or internal tooling.
        The Team plan also handles PDF and Word uploads of up to 50,000 words.
      </p>

      {/* Verdict */}
      <h2 style={h2Style}>The Verdict</h2>
      <p style={pStyle}>
        Undetectable.ai is a competent tool with a large user base. HumanizeIt is the better fit if
        you want a lower starting price, a free tier that lets you test real output, a pattern-by-
        pattern breakdown instead of a single score, and billing you never have to worry about.
      </p>
      <p style={pStyle}>
        Neither tool can guarantee how a detector will score your text, so judge them on your own
        writing: the free tiers make that easy.
      </p>

      {/* CTA */}
      <div
        style={{
          background: THEME.surface1,
          border: `1px solid ${THEME.border}`,
          boxShadow: glow(THEME.brand, 0.18),
          color: THEME.text,
          borderRadius: THEME.radiusXl,
          padding: "40px 32px",
          textAlign: "center",
          marginTop: "48px",
        }}
      >
        <h2
          style={{
            fontSize: "24px",
            fontWeight: 800,
            marginBottom: "12px",
            color: THEME.text,
            letterSpacing: "-0.02em",
            fontFamily: THEME.fontHeading,
          }}
        >
          Ready to Switch?
        </h2>
        <p style={{ fontSize: "16px", lineHeight: 1.6, marginBottom: "24px", color: THEME.textDim }}>
          Try HumanizeIt free — no credit card required. Compare the output on your own text before you
          decide.
        </p>
        <Link
          href="/sign-up"
          style={{
            display: "inline-block",
            background: THEME.gradient,
            color: "#ffffff",
            fontWeight: 700,
            fontSize: "16px",
            padding: "15px 38px",
            borderRadius: THEME.radius,
            textDecoration: "none",
            boxShadow: glow(THEME.brand, 0.36),
          }}
        >
          Start Free Today &rarr;
        </Link>
      </div>
    </main>
  );
}
