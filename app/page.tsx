"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { analyzeText } from "@/lib/algorithms/analyzeText";

function scoreColor(s: number): string {
  if (s >= 75) return "#ef4444";
  if (s >= 50) return "#8b5cf6";
  if (s >= 25) return "#a78bfa";
  return "#22c55e";
}

function scoreLabel(s: number): string {
  if (s >= 75) return "Very likely AI";
  if (s >= 50) return "Likely AI";
  if (s >= 25) return "Possibly AI";
  return "Looks human ✓";
}

function highlightText(text: string, hits: string[]): React.ReactNode {
  if (!text || !hits.length) return <>{text}</>;
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
          <mark key={i} style={{
            background: "rgba(139,92,246,0.25)",
            color: "#c4b5fd",
            borderRadius: "3px",
            padding: "0 3px",
            border: "1px solid rgba(139,92,246,0.4)",
          }}>
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        )
      )}
    </>
  );
}

// ── Pricing Plans ──────────────────────────────────────────────────────────

const PLANS = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    desc: "For curious minds",
    features: ["500 words / day", "1 rewrite / day", "Standard tone", "Basic history"],
    cta: "Get Started Free",
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

// ── VIOLET PALETTE ──────────────────────────────────────────────────────────

const V = {
  brand: "#8b5cf6",       // violet-500
  brandHover: "#7c3aed",  // violet-600
  brandDim: "rgba(139,92,246,0.08)",
  brandBorder: "rgba(139,92,246,0.3)",
  brandGlow: "rgba(139,92,246,0.2)",
  brandGlowSoft: "rgba(139,92,246,0.06)",
};

// ── Component ──────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [text, setText] = useState("");
  const [mounted, setMounted] = useState(false);
  const [focused, setFocused] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const result = text.trim().length > 10 ? analyzeText(text) : null;
  const score = result?.score ?? 0;
  const highlights = result?.patterns
    .filter(p => p.category === "vocabulary")
    .flatMap(p => p.examples) ?? [];
  const patternCount = result?.patterns.length ?? 0;
  const showScore = text.trim().length > 10 && result !== null;
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;

  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
  }, []);

  return (
    <div style={{
      background: "#09090b",
      minHeight: "100vh",
      color: "#fafafa",
      fontFamily: "var(--font-geist-sans), Inter, -apple-system, sans-serif",
    }}>

      {/* ════════════════════════════════════════════════════
          NAVBAR — Fixed, 52px, backdrop blur
      ════════════════════════════════════════════════════ */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 50,
        height: "52px",
        display: "flex", alignItems: "center",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        backdropFilter: "blur(16px) saturate(180%)",
        background: "rgba(9,9,11,0.88)",
      }}>
        <div style={{
          maxWidth: "1140px", margin: "0 auto", padding: "0 24px",
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          {/* Logo */}
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: "7px", textDecoration: "none" }}>
            <span style={{ fontSize: "19px", fontWeight: 800, color: V.brand, letterSpacing: "-0.5px", lineHeight: 1 }}>H.</span>
            <span style={{ fontSize: "14px", fontWeight: 600, color: "#fafafa" }}>HumanizeIt</span>
          </Link>

          {/* Center links */}
          <div className="navbar-links" style={{ display: "flex", alignItems: "center", gap: "28px" }}>
            <a href="#how-it-works" style={{ color: "rgba(255,255,255,0.45)", fontSize: "13px", textDecoration: "none" }}>How it works</a>
            <a href="#pricing" style={{ color: "rgba(255,255,255,0.45)", fontSize: "13px", textDecoration: "none" }}>Pricing</a>
          </div>

          {/* Auth */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <SignedOut>
              <Link href="/sign-in" style={{
                color: "rgba(255,255,255,0.55)", fontSize: "13px", textDecoration: "none",
                padding: "5px 12px", borderRadius: "6px",
                border: "1px solid rgba(255,255,255,0.10)",
              }}>
                Sign in
              </Link>
              <Link href="/sign-up" style={{
                background: V.brand, color: "#fafafa", fontSize: "13px", fontWeight: 600,
                padding: "5px 14px", borderRadius: "6px", textDecoration: "none",
                display: "inline-flex", alignItems: "center", gap: "4px",
              }}>
                Start Free
              </Link>
            </SignedOut>
            <SignedIn>
              <Link href="/dashboard/editor" style={{
                background: V.brand, color: "#fafafa", fontSize: "13px", fontWeight: 600,
                padding: "5px 14px", borderRadius: "6px", textDecoration: "none",
                display: "inline-flex", alignItems: "center", gap: "4px",
              }}>
                Dashboard →
              </Link>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>
          </div>
        </div>
      </nav>

      {/* ════════════════════════════════════════════════════
          SECTION 1 — Hero + Live Editor (above the fold)
      ════════════════════════════════════════════════════ */}
      <section className="noise" style={{
        minHeight: "100vh",
        paddingTop: "52px",
        display: "flex",
        alignItems: "center",
        overflow: "hidden",
      }}>
        <div style={{ maxWidth: "1140px", margin: "0 auto", padding: "40px 24px", width: "100%" }}>
          <div className="hero-grid" style={{
            display: "grid",
            gridTemplateColumns: "2fr 3fr",
            gap: "48px",
            alignItems: "center",
          }}>

            {/* ── Left: Pitch (40%) ── */}
            <div>
              {/* Badge */}
              <div style={{
                display: "inline-flex", alignItems: "center", gap: "6px",
                border: `1px solid ${V.brandBorder}`,
                background: V.brandDim,
                borderRadius: "100px", padding: "4px 12px", marginBottom: "28px",
                fontSize: "12px", color: "#c4b5fd", fontWeight: 500,
              }}>
                <span>⚡</span>
                <span>Detect AI writing in &lt; 500ms</span>
              </div>

              {/* H1 */}
              <h1 className="hero-h1" style={{
                fontSize: "clamp(38px, 5vw, 60px)",
                fontWeight: 800,
                lineHeight: 1.08,
                letterSpacing: "-2px",
                margin: "0 0 18px",
                color: "#fafafa",
              }}>
                Is your text<br />
                <span style={{ color: V.brand }}>obviously AI?</span>
              </h1>

              {/* Subtitle */}
              <p style={{
                fontSize: "16px",
                color: "rgba(255,255,255,0.45)",
                lineHeight: 1.7,
                margin: "0 0 28px",
                maxWidth: "380px",
              }}>
                Detect the 24 patterns that give away ChatGPT.
                Fix them in one click.
              </p>

              {/* Trust signals */}
              <div style={{
                display: "flex", gap: "16px", flexWrap: "wrap",
                marginBottom: "28px",
              }}>
                {["🔒 Private", "⚡ < 500ms", "🆓 Free to try"].map((sig) => (
                  <span key={sig} style={{
                    fontSize: "12px",
                    color: "rgba(255,255,255,0.35)",
                    display: "flex", alignItems: "center", gap: "4px",
                  }}>
                    {sig}
                  </span>
                ))}
              </div>

              {/* Scroll hint */}
              <a href="#how-it-works" style={{
                fontSize: "12px",
                color: "rgba(255,255,255,0.25)",
                textDecoration: "none",
                display: "inline-flex", alignItems: "center", gap: "4px",
              }}>
                How it works ↓
              </a>
              <a href="/sign-up" className="md:hidden" style={{
                display: "inline-flex", alignItems: "center", gap: "6px",
                background: "#8b5cf6", color: "#fafafa",
                fontSize: "14px", fontWeight: 700,
                padding: "10px 22px", borderRadius: "8px",
                textDecoration: "none", marginTop: "16px",
              }}>
                Start Free →
              </a>
            </div>

            {/* ── Right: Live Editor (60%) ── */}
            <div style={{
              background: "#0f0f12",
              border: `1px solid ${focused ? V.brandBorder : "rgba(255,255,255,0.07)"}`,
              borderRadius: "12px",
              overflow: "hidden",
              boxShadow: focused
                ? `0 0 0 1px ${V.brandBorder}, 0 0 40px ${V.brandGlowSoft}`
                : "0 20px 60px rgba(0,0,0,0.4)",
              transition: "border-color 0.2s ease, box-shadow 0.2s ease",
            }}>
              {/* Editor toolbar top */}
              <div style={{
                padding: "10px 16px",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                display: "flex", alignItems: "center", gap: "8px",
              }}>
                <div style={{ width: "9px", height: "9px", borderRadius: "50%", background: "#ef4444", opacity: 0.6 }} />
                <div style={{ width: "9px", height: "9px", borderRadius: "50%", background: "#7c3aed", opacity: 0.6 }} />
                <div style={{ width: "9px", height: "9px", borderRadius: "50%", background: "#22c55e", opacity: 0.6 }} />
                <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.2)", marginLeft: "8px", fontFamily: "var(--font-geist-mono), monospace" }}>
                  analyzeText()
                </span>
              </div>

              {/* Editor body */}
              <div className="editor-inner-grid" style={{ display: "grid", gridTemplateColumns: "1fr auto", minHeight: "260px" }}>
                {/* Textarea */}
                <div style={{ padding: "16px", borderRight: "1px solid rgba(255,255,255,0.05)" }}>
                  <textarea
                    value={text}
                    onChange={handleTextChange}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    placeholder={"Paste your AI-generated text here...\n\ne.g. \"In today's rapidly evolving landscape, it is important to note that the paradigm has shifted fundamentally, offering unprecedented opportunities for holistic transformation...\""}
                    style={{
                      width: "100%",
                      height: "200px",
                      background: "transparent",
                      border: "none",
                      outline: "none",
                      resize: "none",
                      color: "#fafafa",
                      fontSize: "13.5px",
                      lineHeight: 1.8,
                      fontFamily: "inherit",
                    }}
                  />
                  {/* Heatmap preview */}
                  {showScore && highlights.length > 0 && (
                    <div style={{
                      marginTop: "12px",
                      padding: "10px 12px",
                      background: "rgba(139,92,246,0.04)",
                      borderRadius: "6px",
                      border: "1px solid rgba(139,92,246,0.12)",
                    }}>
                      <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.25)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        AI patterns detected
                      </div>
                      <div style={{ fontSize: "13px", lineHeight: 1.75, color: "rgba(255,255,255,0.6)" }}>
                        {highlightText(text.length > 200 ? text.slice(0, 200) + "…" : text, highlights)}
                      </div>
                    </div>
                  )}
                </div>

                {/* Score panel */}
                <div className="editor-score-side" style={{
                  width: "130px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "20px 12px",
                  gap: "8px",
                }}>
                  {mounted && showScore ? (
                    <>
                      <div style={{
                        fontSize: "56px",
                        fontWeight: 800,
                        lineHeight: 1,
                        color: scoreColor(score),
                        letterSpacing: "-2px",
                        transition: "color 0.4s ease",
                        fontVariantNumeric: "tabular-nums",
                      }}>
                        {score}
                      </div>
                      <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", textAlign: "center" }}>AI Score / 100</div>

                      {/* Progress bar */}
                      <div style={{
                        width: "100%", height: "3px",
                        background: "rgba(255,255,255,0.08)",
                        borderRadius: "2px", overflow: "hidden",
                      }}>
                        <div style={{
                          height: "3px",
                          borderRadius: "2px",
                          background: scoreColor(score),
                          width: `${score}%`,
                          transition: "width 0.5s ease, background 0.4s ease",
                        }} />
                      </div>

                      <div style={{
                        fontSize: "11px",
                        color: scoreColor(score),
                        fontWeight: 600,
                        textAlign: "center",
                        lineHeight: 1.3,
                        transition: "color 0.4s ease",
                      }}>
                        {scoreLabel(score)}
                      </div>
                    </>
                  ) : (
                    <div style={{ textAlign: "center", color: "rgba(255,255,255,0.15)" }}>
                      <div style={{ fontSize: "28px", marginBottom: "8px" }}>⚡</div>
                      <div style={{ fontSize: "11px", lineHeight: 1.4 }}>Paste text<br />to score</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Editor bottom toolbar */}
              <div style={{
                padding: "10px 16px",
                borderTop: "1px solid rgba(255,255,255,0.06)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}>
                <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.25)" }}>
                  {wordCount} word{wordCount !== 1 ? "s" : ""}
                  {patternCount > 0 && (
                    <span style={{ marginLeft: "10px", color: V.brand }}>
                      · {patternCount} AI pattern{patternCount !== 1 ? "s" : ""} found
                    </span>
                  )}
                </span>
                <Link href="/sign-up" style={{
                  background: V.brand,
                  color: "#fafafa",
                  fontSize: "12px",
                  fontWeight: 700,
                  padding: "6px 16px",
                  borderRadius: "6px",
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  transition: "background 0.15s",
                }}>
                  Analyze Free →
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Ambient background glow */}
        <div style={{
          position: "absolute",
          top: "30%", right: "10%",
          width: "500px", height: "500px",
          background: `radial-gradient(circle, ${V.brandGlowSoft} 0%, transparent 65%)`,
          borderRadius: "50%",
          zIndex: 0,
          pointerEvents: "none",
        }} />
      </section>

      {/* ════════════════════════════════════════════════════
          SECTION 2 — How It Works (minimalist 3-step)
      ════════════════════════════════════════════════════ */}
      <section id="how-it-works" style={{
        padding: "80px 24px",
        background: "rgba(255,255,255,0.01)",
        borderTop: "1px solid rgba(255,255,255,0.05)",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
      }}>
        <div style={{ maxWidth: "860px", margin: "0 auto" }}>
          <p style={{
            textAlign: "center", fontSize: "11px", fontWeight: 700,
            letterSpacing: "2px", color: V.brand, textTransform: "uppercase",
            marginBottom: "14px",
          }}>
            How it works
          </p>
          <h2 style={{
            textAlign: "center",
            fontSize: "clamp(24px, 3.5vw, 36px)",
            fontWeight: 700, letterSpacing: "-1px",
            marginBottom: "52px", color: "#fafafa",
          }}>
            Three steps. Zero friction.
          </h2>

          <div className="steps-grid" style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "0",
            position: "relative",
          }}>
            {/* Connector */}
            <div style={{
              position: "absolute", top: "26px",
              left: "calc(16.66% + 16px)", right: "calc(16.66% + 16px)",
              height: "1px",
              background: `linear-gradient(90deg, transparent, ${V.brandBorder}, ${V.brandBorder}, transparent)`,
              zIndex: 0,
            }} />

            {[
              { num: "01", icon: "⌃C", title: "Paste", desc: "Drop any text — essay, email, blog post. Up to 10,000 chars." },
              { num: "02", icon: "⚡", title: "Detect", desc: "Score + 24 patterns in < 500ms. Runs locally, instant results." },
              { num: "03", icon: "✦", title: "Humanize", desc: "One click. Claude rewrites it preserving your voice. Score drops." },
            ].map(({ num, icon, title, desc }) => (
              <div key={num} style={{ textAlign: "center", padding: "0 20px", position: "relative", zIndex: 1 }}>
                <div style={{
                  width: "52px", height: "52px", borderRadius: "50%",
                  background: "#0f0f12",
                  border: `1px solid ${V.brandBorder}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto 18px",
                  fontSize: "17px", color: V.brand,
                }}>
                  {icon}
                </div>
                <div style={{ fontSize: "10px", color: V.brand, fontWeight: 700, marginBottom: "7px", letterSpacing: "1px" }}>
                  {num}
                </div>
                <h3 style={{ fontSize: "17px", fontWeight: 700, marginBottom: "9px", color: "#fafafa" }}>{title}</h3>
                <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.38)", lineHeight: 1.7 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════
          SECTION 3 — Pricing (3 cards violet)
      ════════════════════════════════════════════════════ */}
      <section id="pricing" style={{ padding: "80px 24px", background: "#09090b" }}>
        <div style={{ maxWidth: "900px", margin: "0 auto" }}>
          <p style={{
            textAlign: "center", fontSize: "11px", fontWeight: 700,
            letterSpacing: "2px", color: V.brand, textTransform: "uppercase",
            marginBottom: "14px",
          }}>
            Pricing
          </p>
          <h2 style={{
            textAlign: "center",
            fontSize: "clamp(24px, 3.5vw, 36px)",
            fontWeight: 700, letterSpacing: "-1px",
            marginBottom: "48px", color: "#fafafa",
          }}>
            Start free. Upgrade when ready.
          </h2>

          <div className="pricing-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
            {PLANS.map((plan) => (
              <div key={plan.name} style={{
                background: plan.pro ? "rgba(139,92,246,0.05)" : "#0f0f12",
                border: plan.pro ? `1px solid ${V.brand}` : "1px solid rgba(255,255,255,0.07)",
                borderRadius: "12px",
                padding: "28px 22px",
                position: "relative",
                boxShadow: plan.pro ? `0 0 40px ${V.brandGlowSoft}, 0 0 80px rgba(139,92,246,0.04)` : "none",
              }}>
                {plan.pro && (
                  <div style={{
                    position: "absolute", top: "-12px", left: "50%", transform: "translateX(-50%)",
                    background: V.brand, color: "#fafafa",
                    fontSize: "11px", fontWeight: 700,
                    padding: "3px 14px", borderRadius: "100px",
                    whiteSpace: "nowrap",
                  }}>
                    Most Popular
                  </div>
                )}

                <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)", marginBottom: "4px" }}>{plan.desc}</div>
                <div style={{ fontSize: "14px", fontWeight: 700, color: "#fafafa", marginBottom: "16px" }}>{plan.name}</div>

                <div style={{ display: "flex", alignItems: "baseline", gap: "2px", marginBottom: "20px" }}>
                  <span style={{ fontSize: "40px", fontWeight: 800, color: "#fafafa", letterSpacing: "-2px" }}>{plan.price}</span>
                  <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.3)" }}>{plan.period}</span>
                </div>

                <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px", display: "flex", flexDirection: "column", gap: "10px" }}>
                  {plan.features.map((f) => (
                    <li key={f} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "rgba(255,255,255,0.55)" }}>
                      <span style={{ color: V.brand, fontSize: "12px", flexShrink: 0 }}>✓</span>
                      {f}
                    </li>
                  ))}
                </ul>

                <Link href={plan.href} style={{
                  display: "block", textAlign: "center", textDecoration: "none",
                  padding: "10px", borderRadius: "7px",
                  fontSize: "13px", fontWeight: 600,
                  background: plan.pro ? V.brand : "transparent",
                  color: plan.pro ? "#fafafa" : "rgba(255,255,255,0.6)",
                  border: plan.pro ? "none" : "1px solid rgba(255,255,255,0.12)",
                  transition: "background 0.15s",
                }}>
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════
          SECTION 4 — Social Proof
      ════════════════════════════════════════════════════ */}
      <section style={{
        padding: "80px 24px",
        background: "rgba(255,255,255,0.01)",
        borderTop: "1px solid rgba(255,255,255,0.05)",
      }}>
        <div style={{ maxWidth: "860px", margin: "0 auto", textAlign: "center" }}>
          <h2 style={{
            fontSize: "clamp(24px, 3.5vw, 36px)",
            fontWeight: 700, letterSpacing: "-1px",
            marginBottom: "12px", color: "#fafafa",
          }}>
            Built by AI. Used by humans.
          </h2>
          <p style={{ fontSize: "15px", color: "rgba(255,255,255,0.3)", marginBottom: "48px" }}>
            The numbers don&apos;t lie.
          </p>

          <div className="stats-grid" style={{ display: "flex", justifyContent: "center", gap: "64px", flexWrap: "wrap", marginBottom: "52px" }}>
            {[
              { val: "800M+", label: "AI users worldwide" },
              { val: "24", label: "patterns detected" },
              { val: "< 500ms", label: "analysis time" },
            ].map(({ val, label }) => (
              <div key={val}>
                <div style={{ fontSize: "36px", fontWeight: 800, color: V.brand, letterSpacing: "-1px" }}>{val}</div>
                <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.3)", marginTop: "4px" }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Testimonial */}
          <div style={{
            maxWidth: "580px", margin: "0 auto",
            background: "#0f0f12",
            border: "1px solid rgba(255,255,255,0.07)",
            borderLeft: `3px solid ${V.brand}`,
            borderRadius: "8px",
            padding: "22px 26px",
            textAlign: "left",
          }}>
            <p style={{
              fontSize: "14px",
              color: "rgba(255,255,255,0.65)",
              lineHeight: 1.8,
              fontStyle: "italic",
              marginBottom: "14px",
            }}>
              &ldquo;I was submitting AI-generated content and getting called out every time.
              HumanizeIt dropped my score from 82 to 11. The client literally said it &apos;reads more like me now.&apos;&rdquo;
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{
                width: "32px", height: "32px", borderRadius: "50%",
                background: `linear-gradient(135deg, ${V.brand}, #a78bfa)`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "13px", fontWeight: 700, color: "#fafafa",
              }}>
                M
              </div>
              <div>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "#fafafa" }}>Marcus T.</div>
                <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)" }}>Content strategist, beta user</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════
          SECTION 5 — Final CTA
      ════════════════════════════════════════════════════ */}
      <section style={{
        padding: "100px 24px",
        background: "#09090b",
        borderTop: `1px solid ${V.brandBorder.replace("0.3", "0.1")}`,
        textAlign: "center",
      }}>
        <div style={{ maxWidth: "600px", margin: "0 auto" }}>
          <h2 style={{
            fontSize: "clamp(28px, 4.5vw, 50px)",
            fontWeight: 800,
            letterSpacing: "-2px",
            lineHeight: 1.1,
            marginBottom: "20px",
            color: "#fafafa",
          }}>
            Stop sounding like ChatGPT.
          </h2>
          <Link href="/sign-up" style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            background: V.brand,
            color: "#fafafa",
            fontWeight: 700,
            padding: "14px 32px",
            borderRadius: "8px",
            textDecoration: "none",
            fontSize: "15px",
            boxShadow: `0 0 40px ${V.brandGlow}`,
            transition: "background 0.15s, box-shadow 0.15s",
          }}>
            Start Free — No Credit Card →
          </Link>
          <p style={{ marginTop: "16px", fontSize: "12px", color: "rgba(255,255,255,0.2)" }}>
            Free forever. Upgrade when you need more.
          </p>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════
          FOOTER
      ════════════════════════════════════════════════════ */}
      <footer style={{
        borderTop: "1px solid rgba(255,255,255,0.06)",
        padding: "24px",
      }}>
        <div style={{
          maxWidth: "1140px", margin: "0 auto",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", gap: "16px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
            <span style={{ fontSize: "16px", fontWeight: 800, color: V.brand }}>H.</span>
            <span style={{ fontSize: "13px", fontWeight: 600, color: "rgba(255,255,255,0.5)" }}>HumanizeIt</span>
          </div>
          <div style={{ display: "flex", gap: "20px" }}>
            {[
              { label: "Sign in", href: "/sign-in" },
              { label: "Sign up", href: "/sign-up" },
              { label: "Contact", href: "mailto:hello@humanizeit.app" },
            ].map(({ label, href }) => (
              <a key={label} href={href} style={{ fontSize: "12px", color: "rgba(255,255,255,0.25)", textDecoration: "none" }}>
                {label}
              </a>
            ))}
          </div>
          <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.18)" }}>
            Built 100% by Claude · © 2026 HumanizeIt
          </p>
        </div>
      </footer>

      {/* Mobile responsive */}
      <style>{`
        @media (max-width: 768px) {
          section > div > div[style*="grid-template-columns: 2fr 3fr"],
          section > div > div[style*="gridTemplateColumns: 2fr 3fr"] {
            grid-template-columns: 1fr !important;
          }
          section > div > div[style*="grid-template-columns: repeat(3"],
          section > div > div[style*="gridTemplateColumns: repeat(3"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
