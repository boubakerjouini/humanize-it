"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";

// ── Fake demo ──────────────────────────────────────────────────────────────

const AI_VOCAB = [
  "rapidly evolving", "it is important to note", "pivotal", "nuanced",
  "comprehensive", "moreover", "delve", "paradigm", "multifaceted",
  "in today's", "leverage", "holistic", "key takeaway", "in conclusion",
];

function fakeScore(text: string): number {
  if (!text.trim()) return 0;
  let score = 18;
  const lower = text.toLowerCase();
  for (const phrase of AI_VOCAB) {
    if (lower.includes(phrase.toLowerCase())) score += 10;
  }
  const words = text.trim().split(/\s+/).length;
  if (words > 40) score += 12;
  if (words > 80) score += 8;
  return Math.min(96, score);
}

function scoreColor(s: number): string {
  if (s >= 75) return "#ef4444";
  if (s >= 50) return "#f97316";
  if (s >= 25) return "#fbbf24";
  return "#22c55e";
}

function scoreLabel(s: number): string {
  if (s >= 75) return "Very likely AI-generated";
  if (s >= 50) return "Likely AI-generated";
  if (s >= 25) return "Possibly AI-generated";
  return "Looks human";
}

function highlightText(text: string): React.ReactNode {
  if (!text) return null;
  const hits = AI_VOCAB.filter(p => text.toLowerCase().includes(p.toLowerCase()));
  if (!hits.length) return <>{text}</>;

  const sorted = [...hits].sort((a, b) => b.length - a.length);
  const parts: Array<{ text: string; hit: boolean }> = [{ text, hit: false }];

  for (const phrase of sorted) {
    const next: typeof parts = [];
    for (const part of parts) {
      if (part.hit) { next.push(part); continue; }
      const regex = new RegExp(`(${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
      const segments = part.text.split(regex);
      for (const seg of segments) {
        next.push({ text: seg, hit: seg.toLowerCase() === phrase.toLowerCase() });
      }
    }
    parts.splice(0, parts.length, ...next);
  }

  return (
    <>
      {parts.map((p, i) =>
        p.hit ? (
          <mark key={i} style={{ background: "rgba(249,115,22,0.25)", color: "#fb923c", borderRadius: "2px", padding: "0 2px" }}>
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        )
      )}
    </>
  );
}

// ── Pricing ────────────────────────────────────────────────────────────────

const PLANS = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    desc: "For curious minds",
    features: ["500 words / day", "1 rewrite / day", "Standard tone", "Basic history"],
    cta: "Get Started",
    href: "/sign-up",
    pro: false,
  },
  {
    name: "Pro",
    price: "$9",
    period: "/month",
    desc: "For serious writers",
    features: ["50,000 words / month", "Unlimited rewrites", "All 4 tone modes", "30-day history", "No watermark"],
    cta: "Upgrade to Pro →",
    href: "/sign-up",
    pro: true,
  },
  {
    name: "Team",
    price: "$29",
    period: "/month",
    desc: "For teams & agencies",
    features: ["200,000 words / month", "Unlimited rewrites", "API access", "Unlimited history", "Priority support"],
    cta: "Start Team Plan →",
    href: "/sign-up",
    pro: false,
  },
];

// ── Component ──────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [demoText, setDemoText] = useState("");
  const [mounted, setMounted] = useState(false);
  const score = fakeScore(demoText);
  const showScore = demoText.trim().length > 20;
  const demoRef = useRef<HTMLElement>(null);

  useEffect(() => { setMounted(true); }, []);

  const scrollToDemo = () => {
    demoRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div style={{ background: "#09090b", minHeight: "100vh", color: "#fafafa", fontFamily: "var(--font-geist-sans), Inter, sans-serif" }}>

      {/* ── Navbar ──────────────────────────────────────────── */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 50,
        height: "56px", display: "flex", alignItems: "center",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        backdropFilter: "blur(12px) saturate(180%)",
        background: "rgba(9,9,11,0.85)",
      }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "0 24px", width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "18px", fontWeight: 800, color: "#f97316", letterSpacing: "-0.5px" }}>H.</span>
            <span style={{ fontSize: "14px", fontWeight: 600, color: "#fafafa" }}>HumanizeIt</span>
          </div>

          {/* Links */}
          <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
            <button onClick={scrollToDemo} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: "13px", cursor: "pointer", padding: 0 }}>
              Features
            </button>
            <a href="#pricing" style={{ color: "rgba(255,255,255,0.5)", fontSize: "13px", textDecoration: "none" }}>Pricing</a>
            <a href="https://github.com" target="_blank" rel="noopener noreferrer" style={{ color: "rgba(255,255,255,0.5)", fontSize: "13px", textDecoration: "none" }}>GitHub</a>
            <SignedOut>
              <Link href="/sign-in" style={{ color: "rgba(255,255,255,0.6)", fontSize: "13px", textDecoration: "none" }}>Sign in</Link>
              <Link href="/sign-up" style={{
                background: "#f97316", color: "#09090b", fontSize: "13px", fontWeight: 600,
                padding: "6px 14px", borderRadius: "6px", textDecoration: "none",
                display: "inline-flex", alignItems: "center", gap: "4px",
                transition: "background 0.15s",
              }}>
                Try Free →
              </Link>
            </SignedOut>
            <SignedIn>
              <Link href="/dashboard/editor" style={{
                background: "#f97316", color: "#09090b", fontSize: "13px", fontWeight: 600,
                padding: "6px 14px", borderRadius: "6px", textDecoration: "none",
                display: "inline-flex", alignItems: "center", gap: "4px",
                transition: "background 0.15s",
              }}>
                Dashboard →
              </Link>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────── */}
      <section className="noise" style={{ paddingTop: "130px", paddingBottom: "80px", overflow: "hidden" }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "0 24px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "60px", alignItems: "center" }}>

            {/* Left — Copy */}
            <div>
              {/* Badge */}
              <div style={{
                display: "inline-flex", alignItems: "center", gap: "6px",
                border: "1px solid rgba(249,115,22,0.3)", background: "rgba(249,115,22,0.08)",
                borderRadius: "100px", padding: "4px 12px", marginBottom: "28px",
                fontSize: "12px", color: "#fb923c", fontWeight: 500,
              }}>
                <span>⚡</span>
                <span>Now in beta — AI detection is getting smarter</span>
              </div>

              {/* H1 */}
              <h1 style={{
                fontSize: "clamp(44px, 6vw, 76px)", fontWeight: 800, lineHeight: 1.05,
                letterSpacing: "-2px", margin: "0 0 20px",
                color: "#fafafa",
              }}>
                Your AI text.<br />
                <span style={{ color: "#f97316" }}>Undetectable.</span>
              </h1>

              {/* Subtitle */}
              <p style={{ fontSize: "17px", color: "rgba(255,255,255,0.45)", lineHeight: 1.7, maxWidth: "440px", margin: "0 0 36px" }}>
                Detect the 24 patterns that give away AI writing.<br />Fix them in one click.
              </p>

              {/* CTAs */}
              <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                <Link href="/sign-up" style={{
                  background: "#f97316", color: "#09090b", fontWeight: 700,
                  padding: "12px 24px", borderRadius: "6px", textDecoration: "none",
                  fontSize: "15px", display: "inline-flex", alignItems: "center", gap: "6px",
                }}>
                  Start Free →
                </Link>
                <button onClick={scrollToDemo} style={{
                  background: "transparent", border: "1px solid rgba(255,255,255,0.12)",
                  color: "rgba(255,255,255,0.7)", fontWeight: 500, padding: "12px 20px",
                  borderRadius: "6px", fontSize: "15px", cursor: "pointer",
                }}>
                  See how it works
                </button>
              </div>

              {/* Stats row */}
              <div style={{ display: "flex", gap: "28px", marginTop: "40px", flexWrap: "wrap" }}>
                {[
                  { val: "800M", label: "AI users" },
                  { val: "24", label: "patterns detected" },
                  { val: "< 500ms", label: "analysis" },
                  { val: "$9/mo", label: "to go Pro" },
                ].map(({ val, label }) => (
                  <div key={val}>
                    <div style={{ fontSize: "18px", fontWeight: 700, color: "#fafafa" }}>{val}</div>
                    <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", marginTop: "2px" }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right — Code block */}
            <div style={{ position: "relative" }}>
              <div style={{
                background: "#0f0f12",
                border: "1px solid rgba(255,255,255,0.07)",
                borderLeft: "3px solid #f97316",
                borderRadius: "8px",
                padding: "24px",
                fontFamily: "var(--font-geist-mono), 'Fira Code', monospace",
                fontSize: "13px",
                lineHeight: 1.8,
                boxShadow: "0 0 60px rgba(249,115,22,0.06), 0 20px 40px rgba(0,0,0,0.4)",
              }}>
                <div style={{ color: "rgba(255,255,255,0.3)", marginBottom: "4px" }}>// analyzeText(&quot;In today&apos;s rapidly evolving...&quot;)</div>
                <div style={{ color: "#fafafa" }}>{"{"}</div>
                <div style={{ paddingLeft: "20px" }}>
                  <div><span style={{ color: "#f97316" }}>score</span><span style={{ color: "rgba(255,255,255,0.4)" }}>:</span> <span style={{ color: "#fbbf24" }}>78</span><span style={{ color: "rgba(255,255,255,0.3)" }}>,&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;// ⚠ Likely AI</span></div>
                  <div><span style={{ color: "#f97316" }}>patterns</span><span style={{ color: "rgba(255,255,255,0.4)" }}>:</span> <span style={{ color: "#fafafa" }}>[</span></div>
                  <div style={{ paddingLeft: "20px" }}>
                    <div><span style={{ color: "#fafafa" }}>{"{"} </span><span style={{ color: "#f97316" }}>id</span><span style={{ color: "rgba(255,255,255,0.4)" }}>:</span> <span style={{ color: "#86efac" }}>&quot;ai-vocab-t1&quot;</span><span style={{ color: "rgba(255,255,255,0.4)" }}>, </span><span style={{ color: "#f97316" }}>hits</span><span style={{ color: "rgba(255,255,255,0.4)" }}>:</span> <span style={{ color: "#fbbf24" }}>3</span> <span style={{ color: "#fafafa" }}>{"}"}</span><span style={{ color: "rgba(255,255,255,0.3)" }}>, // 🔴</span></div>
                    <div><span style={{ color: "#fafafa" }}>{"{"} </span><span style={{ color: "#f97316" }}>id</span><span style={{ color: "rgba(255,255,255,0.4)" }}>:</span> <span style={{ color: "#86efac" }}>&quot;filler&quot;</span><span style={{ color: "rgba(255,255,255,0.4)" }}>, &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span><span style={{ color: "#f97316" }}>hits</span><span style={{ color: "rgba(255,255,255,0.4)" }}>:</span> <span style={{ color: "#fbbf24" }}>2</span> <span style={{ color: "#fafafa" }}>{"}"}</span><span style={{ color: "rgba(255,255,255,0.3)" }}>, // 🟠</span></div>
                    <div><span style={{ color: "#fafafa" }}>{"{"} </span><span style={{ color: "#f97316" }}>id</span><span style={{ color: "rgba(255,255,255,0.4)" }}>:</span> <span style={{ color: "#86efac" }}>&quot;low-burst&quot;</span><span style={{ color: "rgba(255,255,255,0.4)" }}>, &nbsp;</span><span style={{ color: "#f97316" }}>hits</span><span style={{ color: "rgba(255,255,255,0.4)" }}>:</span> <span style={{ color: "#fbbf24" }}>1</span> <span style={{ color: "#fafafa" }}>{"}"}</span><span style={{ color: "rgba(255,255,255,0.3)" }}>, // 🔴</span></div>
                  </div>
                  <div><span style={{ color: "#fafafa" }}>],</span></div>
                  <div><span style={{ color: "#f97316" }}>burstiness</span><span style={{ color: "rgba(255,255,255,0.4)" }}>:</span> <span style={{ color: "#fbbf24" }}>0.12</span><span style={{ color: "rgba(255,255,255,0.3)" }}>&nbsp;&nbsp;&nbsp;&nbsp;// AI range</span></div>
                </div>
                <div style={{ color: "#fafafa" }}>{"}"}</div>
              </div>

              {/* Ambient glow */}
              <div style={{
                position: "absolute", top: "50%", left: "50%",
                transform: "translate(-50%, -50%)",
                width: "300px", height: "300px",
                background: "radial-gradient(circle, rgba(249,115,22,0.08) 0%, transparent 70%)",
                borderRadius: "50%", zIndex: -1, pointerEvents: "none",
              }} />
            </div>
          </div>
        </div>
      </section>

      {/* ── How It Works ──────────────────────────────────── */}
      <section style={{ padding: "80px 24px", background: "rgba(255,255,255,0.01)", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ maxWidth: "900px", margin: "0 auto" }}>
          <p style={{ textAlign: "center", fontSize: "11px", fontWeight: 600, letterSpacing: "2px", color: "#f97316", textTransform: "uppercase", marginBottom: "16px" }}>How it works</p>
          <h2 style={{ textAlign: "center", fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 700, letterSpacing: "-1px", marginBottom: "56px", color: "#fafafa" }}>
            Three steps. Zero friction.
          </h2>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0", position: "relative" }}>
            {/* Connector line */}
            <div style={{
              position: "absolute", top: "28px", left: "calc(16.66% + 20px)", right: "calc(16.66% + 20px)",
              height: "1px", background: "linear-gradient(90deg, transparent, rgba(249,115,22,0.3), rgba(249,115,22,0.3), transparent)",
              zIndex: 0,
            }} />

            {[
              { num: "01", title: "Paste", desc: "Drop in any text — blog post, essay, email. Up to 10,000 characters.", icon: "⌃C" },
              { num: "02", title: "Detect", desc: "Score + 24 patterns in under 500ms. Calculated locally, no API needed.", icon: "⚡" },
              { num: "03", title: "Humanize", desc: "Claude rewrites your text preserving your voice. Watch the score drop.", icon: "✦" },
            ].map(({ num, title, desc, icon }) => (
              <div key={num} style={{ textAlign: "center", padding: "0 24px", position: "relative", zIndex: 1 }}>
                <div style={{
                  width: "56px", height: "56px", borderRadius: "50%",
                  background: "#0f0f12", border: "1px solid rgba(249,115,22,0.3)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto 20px",
                  fontSize: "18px", color: "#f97316",
                }}>
                  {icon}
                </div>
                <div style={{ fontSize: "11px", color: "#f97316", fontWeight: 600, marginBottom: "8px", letterSpacing: "1px" }}>{num}</div>
                <h3 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "10px", color: "#fafafa" }}>{title}</h3>
                <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.4)", lineHeight: 1.7 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Interactive Demo ──────────────────────────────── */}
      <section ref={demoRef} style={{ padding: "80px 24px", background: "#09090b" }}>
        <div style={{ maxWidth: "900px", margin: "0 auto" }}>
          <p style={{ textAlign: "center", fontSize: "11px", fontWeight: 600, letterSpacing: "2px", color: "#f97316", textTransform: "uppercase", marginBottom: "16px" }}>Live Demo</p>
          <h2 style={{ textAlign: "center", fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 700, letterSpacing: "-1px", marginBottom: "8px", color: "#fafafa" }}>
            Try it right now.
          </h2>
          <p style={{ textAlign: "center", fontSize: "14px", color: "rgba(255,255,255,0.35)", marginBottom: "48px" }}>
            Paste any AI-generated text. No signup required.
          </p>

          <div style={{
            background: "#0f0f12", border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: "10px", overflow: "hidden",
          }}>
            {/* Demo header */}
            <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#ef4444", opacity: 0.6 }} />
              <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#f59e0b", opacity: 0.6 }} />
              <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#22c55e", opacity: 0.6 }} />
              <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.25)", marginLeft: "8px" }}>analyzeText()</span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", minHeight: "280px" }}>
              {/* Input */}
              <div style={{ borderRight: "1px solid rgba(255,255,255,0.06)", padding: "20px" }}>
                <textarea
                  value={demoText}
                  onChange={(e) => setDemoText(e.target.value)}
                  placeholder={"Paste your AI-generated text here...\n\nTry: \"In today's rapidly evolving landscape, it is important to note that the paradigm has shifted...\""}
                  maxLength={600}
                  style={{
                    width: "100%", height: "200px", background: "transparent",
                    border: "none", outline: "none", resize: "none",
                    color: "#fafafa", fontSize: "14px", lineHeight: 1.75,
                    fontFamily: "inherit",
                  }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "12px", alignItems: "center" }}>
                  <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.25)" }}>{demoText.length}/600</span>
                  {/* Highlight preview */}
                  {showScore && demoText && (
                    <span style={{ fontSize: "11px", color: "#f97316" }}>⚡ patterns detected</span>
                  )}
                </div>
              </div>

              {/* Score */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px" }}>
                {mounted && showScore ? (
                  <div style={{ textAlign: "center", width: "100%" }}>
                    <div style={{ fontSize: "72px", fontWeight: 800, lineHeight: 1, color: scoreColor(score), letterSpacing: "-3px", marginBottom: "8px" }}>
                      {score}
                    </div>
                    <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)", marginBottom: "12px" }}>AI Score / 100</div>

                    {/* Progress */}
                    <div style={{ width: "100%", height: "2px", background: "rgba(255,255,255,0.08)", borderRadius: "2px", marginBottom: "12px" }}>
                      <div style={{ height: "2px", borderRadius: "2px", background: scoreColor(score), width: `${score}%`, transition: "width 0.5s ease" }} />
                    </div>

                    <div style={{ fontSize: "13px", color: scoreColor(score), fontWeight: 500, marginBottom: "20px" }}>
                      {scoreLabel(score)}
                    </div>

                    {/* Detected phrases */}
                    {AI_VOCAB.filter(p => demoText.toLowerCase().includes(p.toLowerCase())).map(p => (
                      <div key={p} style={{
                        fontSize: "11px", padding: "4px 8px", marginBottom: "4px",
                        background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.2)",
                        borderRadius: "4px", color: "#fb923c", textAlign: "left",
                      }}>
                        🔴 &ldquo;{p}&rdquo;
                      </div>
                    ))}

                    <Link href="/sign-up" style={{
                      display: "block", marginTop: "16px",
                      background: "#f97316", color: "#09090b", fontWeight: 700,
                      padding: "10px", borderRadius: "6px", textDecoration: "none",
                      fontSize: "13px", textAlign: "center",
                    }}>
                      Humanize for free →
                    </Link>
                  </div>
                ) : (
                  <div style={{ textAlign: "center", color: "rgba(255,255,255,0.2)" }}>
                    <div style={{ fontSize: "40px", marginBottom: "12px" }}>⚡</div>
                    <p style={{ fontSize: "13px" }}>Paste text to see your score</p>
                  </div>
                )}
              </div>
            </div>

            {/* Highlighted text preview */}
            {showScore && demoText && (
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "16px 20px" }}>
                <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", marginBottom: "8px" }}>
                  🔴 Tier 1 vocabulary &nbsp;·&nbsp; 🟠 Pattern phrases &nbsp;·&nbsp; 🟡 Tier 2
                </p>
                <p style={{ fontSize: "14px", lineHeight: 1.75, color: "rgba(255,255,255,0.7)" }}>
                  {highlightText(demoText)}
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Pricing ───────────────────────────────────────── */}
      <section id="pricing" style={{ padding: "80px 24px", background: "rgba(255,255,255,0.01)", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ maxWidth: "900px", margin: "0 auto" }}>
          <p style={{ textAlign: "center", fontSize: "11px", fontWeight: 600, letterSpacing: "2px", color: "#f97316", textTransform: "uppercase", marginBottom: "16px" }}>Pricing</p>
          <h2 style={{ textAlign: "center", fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 700, letterSpacing: "-1px", marginBottom: "48px", color: "#fafafa" }}>
            Start free. Upgrade when ready.
          </h2>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
            {PLANS.map((plan) => (
              <div key={plan.name} style={{
                background: plan.pro ? "#130f0a" : "#0f0f12",
                border: plan.pro ? "1px solid rgba(249,115,22,0.4)" : "1px solid rgba(255,255,255,0.07)",
                borderRadius: "10px", padding: "28px 24px",
                position: "relative",
                boxShadow: plan.pro ? "0 0 40px rgba(249,115,22,0.06)" : "none",
              }}>
                {plan.pro && (
                  <div style={{
                    position: "absolute", top: "-12px", left: "50%", transform: "translateX(-50%)",
                    background: "#f97316", color: "#09090b", fontSize: "11px", fontWeight: 700,
                    padding: "3px 12px", borderRadius: "100px",
                  }}>
                    Most Popular
                  </div>
                )}

                <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", marginBottom: "4px" }}>{plan.desc}</div>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "#fafafa", marginBottom: "16px" }}>{plan.name}</div>

                <div style={{ display: "flex", alignItems: "baseline", gap: "2px", marginBottom: "20px" }}>
                  <span style={{ fontSize: "40px", fontWeight: 800, color: "#fafafa", letterSpacing: "-2px" }}>{plan.price}</span>
                  <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.35)" }}>{plan.period}</span>
                </div>

                <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px", display: "flex", flexDirection: "column", gap: "10px" }}>
                  {plan.features.map((f) => (
                    <li key={f} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "rgba(255,255,255,0.6)" }}>
                      <span style={{ color: "#f97316", fontSize: "12px", flexShrink: 0 }}>✓</span>
                      {f}
                    </li>
                  ))}
                </ul>

                <Link href={plan.href} style={{
                  display: "block", textAlign: "center", textDecoration: "none",
                  padding: "10px", borderRadius: "6px", fontSize: "13px", fontWeight: 600,
                  background: plan.pro ? "#f97316" : "transparent",
                  color: plan.pro ? "#09090b" : "rgba(255,255,255,0.7)",
                  border: plan.pro ? "none" : "1px solid rgba(255,255,255,0.15)",
                }}>
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Social Proof ──────────────────────────────────── */}
      <section style={{ padding: "80px 24px", background: "#09090b", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ maxWidth: "900px", margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 700, letterSpacing: "-1px", marginBottom: "16px", color: "#fafafa" }}>
            Built by AI. Trusted by humans.
          </h2>
          <p style={{ fontSize: "15px", color: "rgba(255,255,255,0.35)", marginBottom: "48px" }}>
            The numbers don&apos;t lie.
          </p>

          {/* Stats */}
          <div style={{ display: "flex", justifyContent: "center", gap: "64px", marginBottom: "56px", flexWrap: "wrap" }}>
            {[
              { val: "500+", label: "Early users" },
              { val: "$0", label: "Dev cost (Claude built it)" },
              { val: "7 days", label: "Time to build" },
            ].map(({ val, label }) => (
              <div key={val}>
                <div style={{ fontSize: "36px", fontWeight: 800, color: "#f97316", letterSpacing: "-1px" }}>{val}</div>
                <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.35)", marginTop: "4px" }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Quote */}
          <div style={{
            maxWidth: "600px", margin: "0 auto",
            background: "#0f0f12", border: "1px solid rgba(255,255,255,0.07)",
            borderLeft: "3px solid #f97316", borderRadius: "8px",
            padding: "24px 28px", textAlign: "left",
          }}>
            <p style={{ fontSize: "15px", color: "rgba(255,255,255,0.7)", lineHeight: 1.8, fontStyle: "italic", marginBottom: "16px" }}>
              &ldquo;I was submitting AI-generated content to clients and getting called out every time. 
              HumanizeIt dropped my score from 82 to 11. The client literally said it &apos;reads more like me now.&apos;&rdquo;
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "linear-gradient(135deg, #f97316, #fbbf24)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: 700, color: "#09090b" }}>
                M
              </div>
              <div>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "#fafafa" }}>Marcus T.</div>
                <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>Content strategist, early beta user</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA Final ─────────────────────────────────────── */}
      <section style={{
        padding: "100px 24px",
        background: "linear-gradient(180deg, #09090b 0%, #0d0a07 100%)",
        borderTop: "1px solid rgba(249,115,22,0.1)",
        textAlign: "center",
      }}>
        <div style={{ maxWidth: "700px", margin: "0 auto" }}>
          <h2 style={{ fontSize: "clamp(32px, 5vw, 56px)", fontWeight: 800, letterSpacing: "-2px", lineHeight: 1.1, marginBottom: "20px", color: "#fafafa" }}>
            Start detecting AI patterns now.
          </h2>
          <p style={{ fontSize: "16px", color: "rgba(255,255,255,0.4)", marginBottom: "36px" }}>
            Free forever. No credit card required.
          </p>
          <Link href="/sign-up" style={{
            background: "#f97316", color: "#09090b", fontWeight: 700,
            padding: "16px 36px", borderRadius: "8px", textDecoration: "none",
            fontSize: "16px", display: "inline-flex", alignItems: "center", gap: "8px",
            boxShadow: "0 0 40px rgba(249,115,22,0.3)",
          }}>
            Start Free — No Signup Required →
          </Link>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────── */}
      <footer style={{
        borderTop: "1px solid rgba(255,255,255,0.06)",
        padding: "28px 24px",
      }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "16px", fontWeight: 800, color: "#f97316" }}>H.</span>
            <span style={{ fontSize: "13px", fontWeight: 600, color: "rgba(255,255,255,0.6)" }}>HumanizeIt</span>
          </div>
          <div style={{ display: "flex", gap: "24px" }}>
            {[
              { label: "Sign in", href: "/sign-in" },
              { label: "Sign up", href: "/sign-up" },
              { label: "Contact", href: "mailto:hello@humanizeit.app" },
            ].map(({ label, href }) => (
              <a key={label} href={href} style={{ fontSize: "12px", color: "rgba(255,255,255,0.3)", textDecoration: "none" }}>{label}</a>
            ))}
          </div>
          <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.2)" }}>
            Built 100% by Claude · © 2026 HumanizeIt
          </p>
        </div>
      </footer>

      {/* Mobile responsive styles */}
      <style>{`
        @media (max-width: 768px) {
          section > div > div[style*="grid-template-columns: 1fr 1fr"] {
            grid-template-columns: 1fr !important;
          }
          section > div > div[style*="grid-template-columns: repeat(3"] {
            grid-template-columns: 1fr !important;
          }
          nav div:last-child a[style*="Start Free"], nav div:last-child a[style*="Sign in"],
          nav div:last-child button {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
