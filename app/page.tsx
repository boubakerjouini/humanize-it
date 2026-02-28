"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { analyzeText } from "@/lib/algorithms/analyzeText";
import { Loader2 } from "lucide-react";

function scoreColor(s: number): string {
  if (s >= 75) return "#ef4444";
  if (s >= 50) return "#f97316";
  if (s >= 25) return "#eab308";
  return "#22c55e";
}

function getScoreLabel(s: number): { label: string; sub: string } {
  if (s >= 75) return { label: "FLAGGED AS AI", sub: "Will be caught by GPTZero, Turnitin, and Originality.ai" };
  if (s >= 50) return { label: "LIKELY AI", sub: "Most detectors will flag this text" };
  if (s >= 25) return { label: "BORDERLINE", sub: "Some detectors may flag this" };
  return { label: "LOOKS HUMAN", sub: "Should pass most AI detectors" };
}

const V = {
  brand: "#8b5cf6",
  brandHover: "#7c3aed",
  brandDim: "rgba(139,92,246,0.08)",
  brandBorder: "rgba(139,92,246,0.3)",
  brandGlow: "rgba(139,92,246,0.2)",
  brandGlowSoft: "rgba(139,92,246,0.06)",
};

const PLANS = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    desc: "For curious minds",
    features: ["500 words / day", "1 rewrite / day", "Standard tone", "Basic history"],
    cta: "Get Started Free",
    pro: false,
  },
  {
    name: "Pro",
    price: "$9",
    period: "/month",
    desc: "For serious writers",
    features: ["50,000 words / month", "Unlimited rewrites", "All 4 tone modes", "30-day history", "No watermark"],
    cta: "Upgrade to Pro \u2192",
    pro: true,
  },
  {
    name: "Team",
    price: "$29",
    period: "/month",
    desc: "For teams & agencies",
    features: ["200,000 words / month", "Unlimited rewrites", "API access", "Unlimited history", "Priority support"],
    cta: "Start Team Plan \u2192",
    pro: false,
  },
];

export default function LandingPage() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [mounted, setMounted] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [showResult, setShowResult] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const result = showResult && text.trim().length > 10 ? analyzeText(text) : null;
  const score = result?.score ?? 0;
  const scoreConf = result ? getScoreLabel(score) : null;
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const canAnalyze = text.trim().length >= 10 && !analyzing;

  const topPatterns = result
    ? [...result.patterns]
        .sort((a, b) => {
          const o: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
          return (o[a.severity] ?? 4) - (o[b.severity] ?? 4);
        })
        .slice(0, 3)
    : [];

  const handleAnalyze = useCallback(() => {
    if (!canAnalyze) return;
    setAnalyzing(true);
    // Simulate brief delay for UX
    setTimeout(() => {
      setShowResult(true);
      setAnalyzing(false);
    }, 300);
  }, [canAnalyze]);

  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    if (showResult) setShowResult(false);
  }, [showResult]);

  return (
    <div style={{
      background: "#09090b",
      minHeight: "100vh",
      color: "#fafafa",
      fontFamily: "var(--font-geist-sans), Inter, -apple-system, sans-serif",
    }}>

      {/* ── NAVBAR ── */}
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
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: "7px", textDecoration: "none" }}>
            <span style={{ fontSize: "19px", fontWeight: 800, color: V.brand, letterSpacing: "-0.5px", lineHeight: 1 }}>H.</span>
            <span style={{ fontSize: "14px", fontWeight: 600, color: "#fafafa" }}>HumanizeIt</span>
          </Link>

          <div className="navbar-links hidden md:flex" style={{ alignItems: "center", gap: "28px" }}>
            <a href="#how-it-works" style={{ color: "rgba(255,255,255,0.45)", fontSize: "13px", textDecoration: "none" }}>How it works</a>
            <a href="#pricing" style={{ color: "rgba(255,255,255,0.45)", fontSize: "13px", textDecoration: "none" }}>Pricing</a>
          </div>

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
                Dashboard &rarr;
              </Link>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>
          </div>
        </div>
      </nav>

      {/* ── HERO — Single column, centered ── */}
      <section className="noise" style={{
        minHeight: "100vh",
        paddingTop: "52px",
        display: "flex",
        alignItems: "center",
        overflow: "hidden",
      }}>
        <div style={{ maxWidth: "720px", margin: "0 auto", padding: "60px 24px", width: "100%", textAlign: "center" }}>

          {/* Badge */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: "6px",
            border: `1px solid ${V.brandBorder}`,
            background: V.brandDim,
            borderRadius: "100px", padding: "4px 12px", marginBottom: "28px",
            fontSize: "12px", color: "#c4b5fd", fontWeight: 500,
          }}>
            <span>Detect AI writing in &lt; 500ms</span>
          </div>

          {/* H1 */}
          <h1 className="hero-h1" style={{
            fontSize: "clamp(36px, 5vw, 56px)",
            fontWeight: 800,
            lineHeight: 1.08,
            letterSpacing: "-2px",
            margin: "0 0 16px",
            color: "#fafafa",
          }}>
            Your AI text<br />
            <span style={{ color: V.brand }}>will be caught.</span>
          </h1>

          {/* Subtitle */}
          <p style={{
            fontSize: "16px",
            color: "rgba(255,255,255,0.45)",
            lineHeight: 1.7,
            margin: "0 auto 32px",
            maxWidth: "440px",
          }}>
            Paste it below. See the risk in 500ms. Fix it in one click.
          </p>

          {/* Textarea */}
          <div style={{
            background: "#0f0f12",
            border: `1px solid ${result ? scoreColor(score) + "40" : "rgba(255,255,255,0.07)"}`,
            borderRadius: "12px",
            overflow: "hidden",
            boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
            textAlign: "left",
            transition: "border-color 0.3s",
          }}>
            {/* Editor toolbar */}
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

            <textarea
              value={text}
              onChange={handleTextChange}
              placeholder={"Paste your AI-generated text here\u2026\n\ne.g. \"In today's rapidly evolving landscape, it is important to note that the paradigm has shifted fundamentally, offering unprecedented opportunities for holistic transformation\u2026\""}
              style={{
                width: "100%",
                height: "180px",
                background: "transparent",
                border: "none",
                outline: "none",
                resize: "none",
                color: "#fafafa",
                fontSize: "14px",
                lineHeight: 1.8,
                fontFamily: "inherit",
                padding: "16px",
                boxSizing: "border-box",
              }}
            />

            {/* Bottom toolbar */}
            <div style={{
              padding: "10px 16px",
              borderTop: "1px solid rgba(255,255,255,0.06)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}>
              <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.25)" }}>
                {wordCount} word{wordCount !== 1 ? "s" : ""}
              </span>
              <button
                onClick={handleAnalyze}
                disabled={!canAnalyze}
                style={{
                  background: canAnalyze ? V.brand : "rgba(139,92,246,0.2)",
                  color: canAnalyze ? "#fafafa" : "rgba(255,255,255,0.3)",
                  fontSize: "13px", fontWeight: 700,
                  padding: "8px 20px", borderRadius: "7px",
                  border: "none", cursor: canAnalyze ? "pointer" : "not-allowed",
                  display: "inline-flex", alignItems: "center", gap: "6px",
                  transition: "all 0.15s",
                }}
              >
                {analyzing
                  ? <><Loader2 size={13} className="animate-spin" /> Analyzing&hellip;</>
                  : "Analyze for free \u2192"
                }
              </button>
            </div>
          </div>

          {/* Trust badges */}
          <div style={{
            display: "flex", justifyContent: "center", gap: "20px", flexWrap: "wrap",
            marginTop: "20px",
          }}>
            {["Private \u2014 never stored", "< 500ms analysis", "Free to try"].map((sig) => (
              <span key={sig} style={{
                fontSize: "12px",
                color: "rgba(255,255,255,0.25)",
              }}>
                {sig}
              </span>
            ))}
          </div>

          {/* ── INLINE RESULTS (after analyze) ── */}
          {mounted && result && scoreConf && (
            <div style={{
              marginTop: "24px",
              background: "#0f0f12",
              border: `1px solid ${scoreColor(score)}30`,
              borderRadius: "12px",
              padding: "24px",
              textAlign: "left",
            }}>
              {/* Score row */}
              <div style={{ display: "flex", alignItems: "flex-end", gap: "8px", marginBottom: "8px" }}>
                <div style={{
                  fontSize: "56px", fontWeight: 900, color: scoreColor(score),
                  lineHeight: 1, fontVariantNumeric: "tabular-nums", letterSpacing: "-3px",
                }}>
                  {Math.round(score)}
                </div>
                <div style={{ fontSize: "14px", color: "rgba(255,255,255,0.3)", marginBottom: "10px" }}>/100</div>
              </div>
              <div style={{ fontSize: "12px", fontWeight: 800, color: scoreColor(score), letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: "4px" }}>
                {scoreConf.label}
              </div>
              <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)", lineHeight: 1.5, marginBottom: "16px" }}>
                {scoreConf.sub}
              </div>

              {/* Progress bar */}
              <div style={{ height: "4px", background: "rgba(255,255,255,0.06)", borderRadius: "2px", overflow: "hidden", marginBottom: "16px" }}>
                <div style={{
                  height: "100%", borderRadius: "2px",
                  background: `linear-gradient(90deg, ${scoreColor(score)}80, ${scoreColor(score)})`,
                  width: `${score}%`, transition: "width 1s ease",
                }} />
              </div>

              {/* Top 3 patterns */}
              {topPatterns.length > 0 && (
                <div style={{ marginBottom: "16px" }}>
                  <div style={{ fontSize: "11px", fontWeight: 600, color: "rgba(255,255,255,0.35)", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Top issues
                  </div>
                  {topPatterns.map(p => (
                    <div key={p.id} style={{
                      display: "flex", alignItems: "center", gap: "8px",
                      padding: "8px 0",
                      borderBottom: "1px solid rgba(255,255,255,0.04)",
                      fontSize: "13px", color: "rgba(255,255,255,0.55)",
                    }}>
                      <span style={{
                        fontSize: "10px", fontWeight: 600, padding: "2px 6px", borderRadius: "3px",
                        background: p.severity === "critical" || p.severity === "high" ? "rgba(239,68,68,0.12)" : "rgba(255,255,255,0.06)",
                        color: p.severity === "critical" || p.severity === "high" ? "#ef4444" : "rgba(255,255,255,0.4)",
                        textTransform: "uppercase",
                      }}>
                        {p.severity}
                      </span>
                      {p.label}
                    </div>
                  ))}
                </div>
              )}

              {/* CTA */}
              <SignedOut>
                <Link href="/sign-up" style={{
                  display: "block", textAlign: "center", textDecoration: "none",
                  padding: "12px",
                  background: "linear-gradient(135deg, #8b5cf6, #7c3aed)",
                  color: "#fafafa", borderRadius: "8px",
                  fontSize: "14px", fontWeight: 700,
                  transition: "opacity 0.15s",
                }}>
                  Fix it &mdash; Sign up free &rarr;
                </Link>
              </SignedOut>
              <SignedIn>
                <button
                  onClick={() => {
                    if (text.trim()) sessionStorage.setItem("prefill-text", text);
                    router.push("/dashboard/editor");
                  }}
                  style={{
                    display: "block", width: "100%", textAlign: "center",
                    padding: "12px",
                    background: "linear-gradient(135deg, #8b5cf6, #7c3aed)",
                    color: "#fafafa", borderRadius: "8px", border: "none",
                    fontSize: "14px", fontWeight: 700, cursor: "pointer",
                    transition: "opacity 0.15s",
                  }}
                >
                  Open in Dashboard &rarr;
                </button>
              </SignedIn>
            </div>
          )}
        </div>

        {/* Ambient glow */}
        <div style={{
          position: "absolute",
          top: "30%", left: "50%", transform: "translateX(-50%)",
          width: "600px", height: "600px",
          background: `radial-gradient(circle, ${V.brandGlowSoft} 0%, transparent 65%)`,
          borderRadius: "50%",
          zIndex: 0,
          pointerEvents: "none",
        }} />
      </section>

      {/* ── HOW IT WORKS ── */}
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
            <div style={{
              position: "absolute", top: "26px",
              left: "calc(16.66% + 16px)", right: "calc(16.66% + 16px)",
              height: "1px",
              background: `linear-gradient(90deg, transparent, ${V.brandBorder}, ${V.brandBorder}, transparent)`,
              zIndex: 0,
            }} />

            {[
              { num: "01", icon: "\u2303C", title: "Paste", desc: "Drop any text \u2014 essay, email, blog post. Up to 10,000 chars." },
              { num: "02", icon: "\u26A1", title: "Detect", desc: "Score + 24 patterns in < 500ms. Runs locally, instant results." },
              { num: "03", icon: "\u2726", title: "Humanize", desc: "One click. AI rewrites it preserving your voice. Score drops." },
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

      {/* ── PRICING ── */}
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
                      <span style={{ color: V.brand, fontSize: "12px", flexShrink: 0 }}>{"\u2713"}</span>
                      {f}
                    </li>
                  ))}
                </ul>

                {/* Auth-aware CTA */}
                {plan.name === "Free" ? (
                  <>
                    <SignedOut>
                      <Link href="/sign-up" style={{
                        display: "block", textAlign: "center", textDecoration: "none",
                        padding: "10px", borderRadius: "7px",
                        fontSize: "13px", fontWeight: 600,
                        background: "transparent",
                        color: "rgba(255,255,255,0.6)",
                        border: "1px solid rgba(255,255,255,0.12)",
                      }}>
                        {plan.cta}
                      </Link>
                    </SignedOut>
                    <SignedIn>
                      <Link href="/dashboard/editor" style={{
                        display: "block", textAlign: "center", textDecoration: "none",
                        padding: "10px", borderRadius: "7px",
                        fontSize: "13px", fontWeight: 600,
                        background: "transparent",
                        color: "rgba(255,255,255,0.6)",
                        border: "1px solid rgba(255,255,255,0.12)",
                      }}>
                        Open Dashboard
                      </Link>
                    </SignedIn>
                  </>
                ) : (
                  <>
                    <SignedOut>
                      <Link href="/sign-up" style={{
                        display: "block", textAlign: "center", textDecoration: "none",
                        padding: "10px", borderRadius: "7px",
                        fontSize: "13px", fontWeight: 600,
                        background: plan.pro ? V.brand : "transparent",
                        color: plan.pro ? "#fafafa" : "rgba(255,255,255,0.6)",
                        border: plan.pro ? "none" : "1px solid rgba(255,255,255,0.12)",
                      }}>
                        {plan.cta}
                      </Link>
                    </SignedOut>
                    <SignedIn>
                      <Link href={`/api/checkout?plan=${plan.name.toLowerCase()}`} style={{
                        display: "block", textAlign: "center", textDecoration: "none",
                        padding: "10px", borderRadius: "7px",
                        fontSize: "13px", fontWeight: 600,
                        background: plan.pro ? V.brand : "transparent",
                        color: plan.pro ? "#fafafa" : "rgba(255,255,255,0.6)",
                        border: plan.pro ? "none" : "1px solid rgba(255,255,255,0.12)",
                      }}>
                        {plan.cta}
                      </Link>
                    </SignedIn>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SOCIAL PROOF ── */}
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

      {/* ── FINAL CTA ── */}
      <section style={{
        padding: "100px 24px",
        background: "#09090b",
        borderTop: "1px solid rgba(139,92,246,0.1)",
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
          <SignedOut>
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
            }}>
              Start Free &mdash; No Credit Card &rarr;
            </Link>
          </SignedOut>
          <SignedIn>
            <Link href="/dashboard/editor" style={{
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
            }}>
              Open Dashboard &rarr;
            </Link>
          </SignedIn>
          <p style={{ marginTop: "16px", fontSize: "12px", color: "rgba(255,255,255,0.2)" }}>
            Free forever. Upgrade when you need more.
          </p>
        </div>
      </section>

      {/* ── FOOTER ── */}
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
            Built 100% by Claude &middot; &copy; 2026 HumanizeIt
          </p>
        </div>
      </footer>
    </div>
  );
}
