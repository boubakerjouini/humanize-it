import Link from "next/link";
import type { Metadata } from "next";
import { THEME, glow } from "@/lib/theme";

export const metadata: Metadata = {
  title: "AI Humanizer Use Cases — Students, Copywriters & Agencies",
  description:
    "See how different people use HumanizeIt to make AI-assisted writing read naturally and pass AI detectors — from students beating Turnitin to agencies scaling content.",
  keywords: [
    "AI humanizer use cases",
    "humanize AI text",
    "bypass AI detection",
    "AI writing for students",
    "AI content for agencies",
  ],
  openGraph: {
    title: "AI Humanizer Use Cases — Students, Copywriters & Agencies",
    description:
      "How students, copywriters, and agencies use HumanizeIt to make AI-assisted writing read naturally and pass AI detectors.",
    url: "https://humanizeit.app/use-cases",
    siteName: "HumanizeIt",
    type: "website",
  },
  alternates: { canonical: "https://humanizeit.app/use-cases" },
};

const USE_CASES = [
  {
    href: "/use-cases/students",
    kicker: "For students",
    title: "Students",
    desc: "Make AI-assisted essays and assignments read naturally and avoid false flags from GPTZero and Turnitin — responsibly.",
  },
  {
    href: "/use-cases/copywriters",
    kicker: "For copywriters",
    title: "Copywriters",
    desc: "Turn fast AI drafts into on-brand, human-sounding copy that ranks and converts without tripping AI detectors.",
  },
  {
    href: "/use-cases/agencies",
    kicker: "For agencies",
    title: "Agencies",
    desc: "Scale client content production while keeping every deliverable natural, undetectable, and quality-checked.",
  },
];

export default function UseCasesHubPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      {/* Breadcrumb */}
      <nav className="text-sm mb-8" style={{ color: THEME.textDim }}>
        <Link href="/" className="hover:underline">
          Home
        </Link>
        {" > "}
        <span>Use Cases</span>
      </nav>

      <div className="kicker" style={{ marginBottom: "16px" }}>Use cases</div>
      <h1
        style={{
          fontFamily: THEME.fontHeading,
          fontWeight: 800,
          color: THEME.text,
          fontSize: "clamp(28px, 5vw, 38px)",
          letterSpacing: "-0.02em",
          marginBottom: "16px",
          lineHeight: 1.15,
        }}
      >
        How people use <span style={{ color: THEME.brand }}>HumanizeIt</span>
      </h1>
      <p style={{ color: THEME.textDim, lineHeight: 1.75, marginBottom: "32px", fontSize: "16px" }}>
        HumanizeIt makes AI-assisted writing read naturally and pass AI detectors. Here&apos;s how different
        people put it to work — pick the guide that fits you.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {USE_CASES.map((u) => (
          <Link
            key={u.href}
            href={u.href}
            className="rounded-2xl p-6 transition"
            style={{
              display: "block",
              background: THEME.surface1,
              border: `1px solid ${THEME.border}`,
              textDecoration: "none",
              boxShadow: glow(THEME.brand, 0.08),
            }}
          >
            <div className="kicker" style={{ marginBottom: "10px" }}>{u.kicker}</div>
            <h2
              style={{
                fontFamily: THEME.fontHeading,
                fontWeight: 700,
                color: THEME.text,
                fontSize: "20px",
                marginBottom: "8px",
                letterSpacing: "-0.01em",
              }}
            >
              {u.title}
            </h2>
            <p style={{ color: THEME.textDim, lineHeight: 1.7, fontSize: "15px", marginBottom: "12px" }}>{u.desc}</p>
            <span style={{ color: THEME.brand, fontWeight: 600, fontSize: "14px" }}>Read the guide &rarr;</span>
          </Link>
        ))}
      </div>

      {/* CTA */}
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
          Try HumanizeIt Free
        </h2>
        <p style={{ fontSize: "16px", lineHeight: 1.75, marginBottom: "24px", color: THEME.textDim }}>
          Humanize your first documents free — no credit card required.
        </p>
        <Link
          href="/sign-up"
          className="inline-block font-bold rounded-full px-8 py-3 transition"
          style={{ background: THEME.gradient, color: "#ffffff", boxShadow: glow(THEME.brand, 0.36) }}
        >
          Get Started Free &rarr;
        </Link>
      </div>
    </div>
  );
}
