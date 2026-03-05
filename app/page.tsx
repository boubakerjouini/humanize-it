"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SignedIn, SignedOut, UserButton, SignUpButton, SignInButton } from "@clerk/nextjs";
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
  brandBorder: "rgba(139,92,246,0.25)",
  brandGlow: "rgba(139,92,246,0.15)",
  brandGlowSoft: "rgba(139,92,246,0.06)",
};

const LS_BASE = "https://humanizeit.lemonsqueezy.com/checkout/buy/";
const VARIANT_IDS = {
  proMonthly: "1368282",
  proAnnual: "1368275",
  teamMonthly: "1368288",
  teamAnnual: "1368289",
};

const EXTENSION_URL = "https://github.com/boubakerjouini/humanize-it-extension";

const PLANS_MONTHLY = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    desc: "For curious minds",
    features: ["500 words / day", "1 rewrite / day", "Standard tone", "Basic history"],
    cta: "Get Started Free",
    pro: false,
    href: null as string | null,
  },
  {
    name: "Pro",
    price: "$9",
    period: "/month",
    desc: "For serious writers",
    features: ["50,000 words / month", "Unlimited rewrites", "All 4 tone modes", "30-day history", "No watermark"],
    cta: "Upgrade to Pro \u2192",
    pro: true,
    href: LS_BASE + VARIANT_IDS.proMonthly,
  },
  {
    name: "Team",
    price: "$29",
    period: "/month",
    desc: "For teams & agencies",
    features: ["200,000 words / month", "Unlimited rewrites", "API access", "Unlimited history", "Priority support"],
    cta: "Start Team Plan \u2192",
    pro: false,
    href: LS_BASE + VARIANT_IDS.teamMonthly,
  },
];

const PLANS_ANNUAL = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    desc: "For curious minds",
    features: ["500 words / day", "1 rewrite / day", "Standard tone", "Basic history"],
    cta: "Get Started Free",
    pro: false,
    href: null as string | null,
  },
  {
    name: "Pro",
    price: "$7",
    period: "/month",
    desc: "For serious writers",
    features: ["50,000 words / month", "Unlimited rewrites", "All 4 tone modes", "30-day history", "No watermark"],
    cta: "Upgrade to Pro \u2192",
    pro: true,
    href: LS_BASE + VARIANT_IDS.proAnnual,
  },
  {
    name: "Team",
    price: "$24",
    period: "/month",
    desc: "For teams & agencies",
    features: ["200,000 words / month", "Unlimited rewrites", "API access", "Unlimited history", "Priority support"],
    cta: "Start Team Plan \u2192",
    pro: false,
    href: LS_BASE + VARIANT_IDS.teamAnnual,
  },
];

const TESTIMONIALS = [
  {
    quote: "Finally an AI humanizer that actually works. My essays pass Turnitin now.",
    name: "Sarah K.",
    role: "Graduate Student",
    initial: "S",
  },
  {
    quote: "I use it every day for LinkedIn posts. My engagement went up 40%.",
    name: "Marcus T.",
    role: "Content Creator",
    initial: "M",
  },
  {
    quote: "My team uses it for all client deliverables. Worth every penny.",
    name: "Priya R.",
    role: "Marketing Agency",
    initial: "P",
  },
];

const COMPARISON = [
  { label: "GPTZero", us: "\u2705", quill: "\u26A0\uFE0F", undet: "\u2705" },
  { label: "Turnitin", us: "\u2705", quill: "\u274C", undet: "\u26A0\uFE0F" },
  { label: "Originality.ai", us: "\u2705", quill: "\u274C", undet: "\u26A0\uFE0F" },
  { label: "Chrome Extension", us: "\u2705", quill: "\u274C", undet: "\u274C" },
  { label: "Free Tier", us: "\u2705", quill: "\u2705", undet: "\u274C" },
  { label: "Price", us: "From $0", quill: "From $9.95", undet: "From $9.99" },
];

export default function LandingPage() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [mounted, setMounted] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [billingAnnual, setBillingAnnual] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
    setTimeout(() => {
      setShowResult(true);
      setAnalyzing(false);
    }, 300);
  }, [canAnalyze]);

  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    if (showResult) setShowResult(false);
  }, [showResult]);

  const smoothScroll = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  const plans = billingAnnual ? PLANS_ANNUAL : PLANS_MONTHLY;

  return (
    <div style={{
      background: "#09090b",
      minHeight: "100vh",
      color: "#fafafa",
      fontFamily: "var(--font-geist-sans), Inter, -apple-system, sans-serif",
    }}>
      {/* Keyframe animations */}
      <style>{`
        @keyframes drift1 {
          0%, 100% { transform: translate(-50%, -50%) scale(1); }
          50% { transform: translate(-40%, -60%) scale(1.1); }
        }
        @keyframes drift2 {
          0%, 100% { transform: translate(50%, -30%) scale(1); }
          50% { transform: translate(40%, -40%) scale(1.15); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fade-in { animation: fadeInUp 0.6s ease-out forwards; }
        .fade-in-delay { animation: fadeInUp 0.6s ease-out 0.15s forwards; opacity: 0; }
        .fade-in-delay2 { animation: fadeInUp 0.6s ease-out 0.3s forwards; opacity: 0; }
        @media (max-width: 768px) {
          .desktop-only { display: none !important; }
          .mobile-nav-links { display: flex !important; }
          .hero-h1-custom { font-size: 36px !important; }
          .three-col { grid-template-columns: 1fr !important; }
          .two-cta-row { flex-direction: column !important; }
          .comparison-table { font-size: 12px !important; }
          .comparison-table td, .comparison-table th { padding: 10px 8px !important; }
          .footer-inner { flex-direction: column !important; text-align: center !important; }
          .footer-links { justify-content: center !important; }
          .extension-card-inner { flex-direction: column !important; text-align: center !important; }
          .pricing-toggle-row { flex-direction: column !important; align-items: center !important; gap: 16px !important; }
        }
        @media (min-width: 769px) {
          .mobile-nav-links { display: none !important; }
          .mobile-menu-btn { display: none !important; }
        }
      `}</style>

      {/* ── NAVBAR ── */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 50,
        height: "56px",
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

          <div className="desktop-only" style={{ display: "flex", alignItems: "center", gap: "28px" }}>
            <a onClick={() => smoothScroll("demo")} style={{ color: "rgba(255,255,255,0.45)", fontSize: "13px", textDecoration: "none", cursor: "pointer" }}>Demo</a>
            <a onClick={() => smoothScroll("how-it-works")} style={{ color: "rgba(255,255,255,0.45)", fontSize: "13px", textDecoration: "none", cursor: "pointer" }}>How it works</a>
            <a onClick={() => smoothScroll("pricing")} style={{ color: "rgba(255,255,255,0.45)", fontSize: "13px", textDecoration: "none", cursor: "pointer" }}>Pricing</a>
            <a href={EXTENSION_URL} target="_blank" rel="noopener noreferrer" style={{ color: "rgba(255,255,255,0.45)", fontSize: "13px", textDecoration: "none" }}>Extension</a>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <SignedOut>
              <SignInButton mode="modal">
                <button className="desktop-only" style={{
                  color: "rgba(255,255,255,0.55)", fontSize: "13px",
                  padding: "6px 14px", borderRadius: "6px",
                  border: "1px solid rgba(255,255,255,0.10)",
                  background: "transparent", cursor: "pointer",
                }}>
                  Sign in
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button style={{
                  background: V.brand, color: "#fafafa", fontSize: "13px", fontWeight: 600,
                  padding: "6px 16px", borderRadius: "6px",
                  border: "none", cursor: "pointer",
                }}>
                  Get Started Free
                </button>
              </SignUpButton>
            </SignedOut>
            <SignedIn>
              <Link href="/dashboard/editor" style={{
                background: V.brand, color: "#fafafa", fontSize: "13px", fontWeight: 600,
                padding: "6px 16px", borderRadius: "6px", textDecoration: "none",
              }}>
                Dashboard &rarr;
              </Link>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>
            {/* Mobile menu button */}
            <button
              className="mobile-menu-btn"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              style={{
                background: "transparent", border: "none", color: "#fafafa",
                fontSize: "20px", cursor: "pointer", padding: "4px 8px",
              }}
            >
              {mobileMenuOpen ? "\u2715" : "\u2630"}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile menu dropdown */}
      {mobileMenuOpen && (
        <div className="mobile-nav-links" style={{
          position: "fixed", top: "56px", left: 0, right: 0, zIndex: 49,
          background: "rgba(9,9,11,0.96)", backdropFilter: "blur(16px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          flexDirection: "column", padding: "16px 24px", gap: "16px",
        }}>
          {[
            { label: "Demo", id: "demo" },
            { label: "How it works", id: "how-it-works" },
            { label: "Pricing", id: "pricing" },
          ].map(({ label, id }) => (
            <a key={id} onClick={() => { smoothScroll(id); setMobileMenuOpen(false); }} style={{
              color: "rgba(255,255,255,0.6)", fontSize: "14px", textDecoration: "none", cursor: "pointer",
            }}>{label}</a>
          ))}
          <a href={EXTENSION_URL} target="_blank" rel="noopener noreferrer" style={{
            color: "rgba(255,255,255,0.6)", fontSize: "14px", textDecoration: "none",
          }}>Chrome Extension</a>
        </div>
      )}

      {/* ── SECTION 1: HERO ── */}
      <section style={{
        minHeight: "100vh",
        paddingTop: "56px",
        display: "flex",
        alignItems: "center",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Animated background orbs */}
        <div style={{
          position: "absolute", top: "20%", left: "30%",
          width: "500px", height: "500px",
          background: "radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)",
          borderRadius: "50%", filter: "blur(80px)",
          animation: "drift1 12s ease-in-out infinite",
          pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", top: "40%", right: "20%",
          width: "400px", height: "400px",
          background: "radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 70%)",
          borderRadius: "50%", filter: "blur(60px)",
          animation: "drift2 15s ease-in-out infinite",
          pointerEvents: "none",
        }} />

        <div style={{ maxWidth: "760px", margin: "0 auto", padding: "60px 24px", width: "100%", textAlign: "center", position: "relative", zIndex: 1 }}>

          {/* Badge */}
          <div className="fade-in" style={{
            display: "inline-flex", alignItems: "center", gap: "6px",
            border: `1px solid ${V.brandBorder}`,
            background: V.brandDim,
            borderRadius: "100px", padding: "5px 14px", marginBottom: "28px",
            fontSize: "12px", color: "#c4b5fd", fontWeight: 500, cursor: "pointer",
          }} onClick={() => smoothScroll("extension")}>
            <span>\u2728</span>
            <span>New: Chrome Extension available</span>
          </div>

          {/* H1 */}
          <h1 className="fade-in hero-h1-custom" style={{
            fontSize: "clamp(38px, 5.5vw, 62px)",
            fontWeight: 800,
            lineHeight: 1.08,
            letterSpacing: "-2.5px",
            margin: "0 0 20px",
            color: "#fafafa",
          }}>
            Your AI text,{" "}
            <span style={{
              background: "linear-gradient(135deg, #8b5cf6 0%, #a78bfa 50%, #c4b5fd 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}>sounds human.</span>
          </h1>

          {/* Subtitle */}
          <p className="fade-in-delay" style={{
            fontSize: "17px",
            color: "#a0a0b0",
            lineHeight: 1.7,
            margin: "0 auto 36px",
            maxWidth: "520px",
          }}>
            Paste any AI-generated text. Get a human score instantly. Rewrite with one click. Beats GPTZero, Turnitin &amp; Originality.ai.
          </p>

          {/* Two CTAs */}
          <div className="fade-in-delay2 two-cta-row" style={{ display: "flex", justifyContent: "center", gap: "12px", marginBottom: "24px", flexWrap: "wrap" }}>
            <SignedOut>
              <SignUpButton mode="modal">
                <button style={{
                  background: V.brand, color: "#fafafa", fontWeight: 700,
                  padding: "14px 28px", borderRadius: "8px", border: "none",
                  fontSize: "15px", cursor: "pointer",
                  boxShadow: `0 0 40px ${V.brandGlow}`,
                }}>
                  Start Free &mdash; No credit card
                </button>
              </SignUpButton>
            </SignedOut>
            <SignedIn>
              <Link href="/dashboard/editor" style={{
                background: V.brand, color: "#fafafa", fontWeight: 700,
                padding: "14px 28px", borderRadius: "8px", textDecoration: "none",
                fontSize: "15px",
                boxShadow: `0 0 40px ${V.brandGlow}`,
                display: "inline-flex", alignItems: "center",
              }}>
                Open Dashboard &rarr;
              </Link>
            </SignedIn>
            <button onClick={() => smoothScroll("demo")} style={{
              background: "transparent", color: "rgba(255,255,255,0.6)", fontWeight: 600,
              padding: "14px 28px", borderRadius: "8px",
              border: "1px solid rgba(255,255,255,0.12)",
              fontSize: "15px", cursor: "pointer",
            }}>
              See how it works &darr;
            </button>
          </div>

          {/* Trust signals */}
          <div style={{
            display: "flex", justifyContent: "center", gap: "24px", flexWrap: "wrap",
          }}>
            {["\u2713 500 words free/day", "\u2713 No signup needed to try", "\u2713 Works in Gmail & Docs"].map((sig) => (
              <span key={sig} style={{ fontSize: "12px", color: "#6b6b80" }}>{sig}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 2: LIVE DEMO ── */}
      <section id="demo" style={{
        padding: "80px 24px",
        background: "rgba(255,255,255,0.01)",
        borderTop: "1px solid rgba(255,255,255,0.05)",
      }}>
        <div style={{ maxWidth: "720px", margin: "0 auto" }}>
          <p style={{
            textAlign: "center", fontSize: "11px", fontWeight: 700,
            letterSpacing: "2px", color: V.brand, textTransform: "uppercase",
            marginBottom: "14px",
          }}>
            Live Demo
          </p>
          <h2 style={{
            textAlign: "center",
            fontSize: "clamp(24px, 3.5vw, 36px)",
            fontWeight: 700, letterSpacing: "-1px",
            marginBottom: "12px", color: "#fafafa",
          }}>
            Try it &mdash; no signup required
          </h2>
          <p style={{ textAlign: "center", fontSize: "15px", color: "#6b6b80", marginBottom: "36px" }}>
            Paste any AI text and see the detection score instantly.
          </p>

          {/* Textarea card */}
          <div style={{
            background: "#0e0e12",
            border: `1px solid ${result ? scoreColor(score) + "40" : "rgba(139,92,246,0.15)"}`,
            borderRadius: "12px",
            overflow: "hidden",
            boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
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
                height: "200px",
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
              display: "flex", alignItems: "center", justifyContent: "space-between",
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

          {/* ── INLINE RESULTS ── */}
          {mounted && result && scoreConf && (
            <div style={{
              marginTop: "20px",
              background: "#0e0e12",
              border: `1px solid ${scoreColor(score)}30`,
              borderRadius: "12px",
              padding: "24px",
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
                    Top patterns detected
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

              {/* CTA after result */}
              <SignedOut>
                <SignUpButton mode="modal">
                  <button style={{
                    display: "block", width: "100%", textAlign: "center",
                    padding: "12px",
                    background: "linear-gradient(135deg, #8b5cf6, #7c3aed)",
                    color: "#fafafa", borderRadius: "8px", border: "none",
                    fontSize: "14px", fontWeight: 700, cursor: "pointer",
                  }}>
                    Humanize this text &rarr; Sign up free to unlock
                  </button>
                </SignUpButton>
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
                  }}
                >
                  Open in Dashboard &rarr;
                </button>
              </SignedIn>
            </div>
          )}
        </div>
      </section>

      {/* ── SECTION 3: HOW IT WORKS ── */}
      <section id="how-it-works" style={{
        padding: "80px 24px",
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

          <div className="three-col" style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "20px",
          }}>
            {[
              { icon: "\uD83D\uDCCB", title: "Paste", desc: "Any AI-generated text from ChatGPT, Claude, etc." },
              { icon: "\uD83D\uDD0D", title: "Analyze", desc: "See your AI score and exactly which patterns were detected." },
              { icon: "\u2705", title: "Humanize", desc: "One click rewrites it to sound natural and pass detectors." },
            ].map(({ icon, title, desc }) => (
              <div key={title} style={{
                background: "#0e0e12",
                border: "1px solid rgba(139,92,246,0.15)",
                borderRadius: "12px",
                padding: "28px 24px",
                textAlign: "center",
              }}>
                <div style={{ fontSize: "32px", marginBottom: "16px" }}>{icon}</div>
                <h3 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "10px", color: "#fafafa" }}>{title}</h3>
                <p style={{ fontSize: "14px", color: "#a0a0b0", lineHeight: 1.6 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 4: CHROME EXTENSION CTA ── */}
      <section id="extension" style={{ padding: "80px 24px" }}>
        <div style={{
          maxWidth: "900px", margin: "0 auto",
          background: "linear-gradient(135deg, rgba(139,92,246,0.1) 0%, rgba(139,92,246,0.04) 100%)",
          border: `1px solid ${V.brandBorder}`,
          borderRadius: "16px",
          padding: "48px 40px",
        }}>
          <div className="extension-card-inner" style={{ display: "flex", alignItems: "center", gap: "40px" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "32px", marginBottom: "16px" }}>{"\uD83E\uDDE9"}</div>
              <h2 style={{
                fontSize: "clamp(22px, 3vw, 30px)",
                fontWeight: 700, letterSpacing: "-0.5px",
                marginBottom: "12px", color: "#fafafa",
              }}>
                HumanizeIt is now a Chrome Extension
              </h2>
              <p style={{ fontSize: "15px", color: "#a0a0b0", lineHeight: 1.7, marginBottom: "24px" }}>
                Analyze and humanize text directly in Gmail, Google Docs, LinkedIn, and Notion &mdash; without leaving the page.
              </p>
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "20px" }}>
                <a href={EXTENSION_URL} target="_blank" rel="noopener noreferrer" style={{
                  display: "inline-flex", alignItems: "center", gap: "6px",
                  background: V.brand, color: "#fafafa", fontWeight: 700,
                  padding: "12px 24px", borderRadius: "8px",
                  fontSize: "14px", textDecoration: "none",
                }}>
                  Install Chrome Extension &rarr;
                </a>
                <a href={EXTENSION_URL} target="_blank" rel="noopener noreferrer" style={{
                  display: "inline-flex", alignItems: "center",
                  background: "transparent", color: "rgba(255,255,255,0.6)",
                  padding: "12px 24px", borderRadius: "8px",
                  border: "1px solid rgba(255,255,255,0.12)",
                  fontSize: "14px", textDecoration: "none", fontWeight: 600,
                }}>
                  Learn more
                </a>
              </div>
              <p style={{ fontSize: "12px", color: "#6b6b80" }}>
                Works on: Gmail &middot; Google Docs &middot; LinkedIn &middot; Notion &middot; Substack &middot; WordPress
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 5: SOCIAL PROOF ── */}
      <section style={{
        padding: "80px 24px",
        borderTop: "1px solid rgba(255,255,255,0.05)",
      }}>
        <div style={{ maxWidth: "900px", margin: "0 auto" }}>
          <p style={{
            textAlign: "center", fontSize: "11px", fontWeight: 700,
            letterSpacing: "2px", color: V.brand, textTransform: "uppercase",
            marginBottom: "14px",
          }}>
            Testimonials
          </p>
          <h2 style={{
            textAlign: "center",
            fontSize: "clamp(24px, 3.5vw, 36px)",
            fontWeight: 700, letterSpacing: "-1px",
            marginBottom: "48px", color: "#fafafa",
          }}>
            Loved by writers everywhere
          </h2>

          <div className="three-col" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "20px" }}>
            {TESTIMONIALS.map((t) => (
              <div key={t.name} style={{
                background: "#0e0e12",
                border: "1px solid rgba(139,92,246,0.15)",
                borderRadius: "12px",
                padding: "24px",
              }}>
                <p style={{
                  fontSize: "14px", color: "rgba(255,255,255,0.65)",
                  lineHeight: 1.7, fontStyle: "italic", marginBottom: "20px",
                }}>
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{
                    width: "36px", height: "36px", borderRadius: "50%",
                    background: `linear-gradient(135deg, ${V.brand}, #a78bfa)`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "14px", fontWeight: 700, color: "#fafafa",
                  }}>
                    {t.initial}
                  </div>
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: "#fafafa" }}>{t.name}</div>
                    <div style={{ fontSize: "11px", color: "#6b6b80" }}>{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 6: COMPARISON TABLE ── */}
      <section style={{
        padding: "80px 24px",
        borderTop: "1px solid rgba(255,255,255,0.05)",
      }}>
        <div style={{ maxWidth: "700px", margin: "0 auto" }}>
          <p style={{
            textAlign: "center", fontSize: "11px", fontWeight: 700,
            letterSpacing: "2px", color: V.brand, textTransform: "uppercase",
            marginBottom: "14px",
          }}>
            Comparison
          </p>
          <h2 style={{
            textAlign: "center",
            fontSize: "clamp(24px, 3.5vw, 36px)",
            fontWeight: 700, letterSpacing: "-1px",
            marginBottom: "48px", color: "#fafafa",
          }}>
            Beats every AI detector
          </h2>

          <div style={{
            background: "#0e0e12",
            border: "1px solid rgba(139,92,246,0.15)",
            borderRadius: "12px",
            overflow: "hidden",
          }}>
            <table className="comparison-table" style={{
              width: "100%", borderCollapse: "collapse",
              fontSize: "14px",
            }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <th style={{ padding: "14px 16px", textAlign: "left", color: "#6b6b80", fontWeight: 600, fontSize: "12px" }}></th>
                  <th style={{ padding: "14px 16px", textAlign: "center", color: V.brand, fontWeight: 700, fontSize: "13px" }}>HumanizeIt</th>
                  <th style={{ padding: "14px 16px", textAlign: "center", color: "#6b6b80", fontWeight: 600, fontSize: "13px" }}>QuillBot</th>
                  <th style={{ padding: "14px 16px", textAlign: "center", color: "#6b6b80", fontWeight: 600, fontSize: "13px" }}>Undetectable.ai</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row, i) => (
                  <tr key={row.label} style={{ borderBottom: i < COMPARISON.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                    <td style={{ padding: "12px 16px", color: "#a0a0b0", fontWeight: 500 }}>{row.label}</td>
                    <td style={{ padding: "12px 16px", textAlign: "center" }}>{row.us}</td>
                    <td style={{ padding: "12px 16px", textAlign: "center" }}>{row.quill}</td>
                    <td style={{ padding: "12px 16px", textAlign: "center" }}>{row.undet}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── SECTION 7: PRICING ── */}
      <section id="pricing" style={{
        padding: "80px 24px",
        borderTop: "1px solid rgba(255,255,255,0.05)",
      }}>
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
            marginBottom: "12px", color: "#fafafa",
          }}>
            Start free. Upgrade when ready.
          </h2>

          {/* Billing toggle */}
          <div className="pricing-toggle-row" style={{
            display: "flex", justifyContent: "center", alignItems: "center",
            gap: "12px", marginBottom: "48px",
          }}>
            <span style={{ fontSize: "13px", color: !billingAnnual ? "#fafafa" : "#6b6b80", fontWeight: 600 }}>Monthly</span>
            <button onClick={() => setBillingAnnual(!billingAnnual)} style={{
              width: "44px", height: "24px", borderRadius: "12px",
              background: billingAnnual ? V.brand : "rgba(255,255,255,0.12)",
              border: "none", cursor: "pointer", position: "relative",
              transition: "background 0.2s",
            }}>
              <div style={{
                width: "18px", height: "18px", borderRadius: "50%",
                background: "#fafafa",
                position: "absolute", top: "3px",
                left: billingAnnual ? "23px" : "3px",
                transition: "left 0.2s",
              }} />
            </button>
            <span style={{ fontSize: "13px", color: billingAnnual ? "#fafafa" : "#6b6b80", fontWeight: 600 }}>
              Annual
            </span>
            {billingAnnual && (
              <span style={{
                fontSize: "11px", fontWeight: 700, color: "#22c55e",
                background: "rgba(34,197,94,0.1)",
                padding: "3px 8px", borderRadius: "100px",
              }}>
                Save 20%
              </span>
            )}
          </div>

          <div className="three-col" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
            {plans.map((plan) => (
              <div key={plan.name} style={{
                background: plan.pro ? "rgba(139,92,246,0.05)" : "#0e0e12",
                border: plan.pro ? `1px solid ${V.brand}` : "1px solid rgba(139,92,246,0.15)",
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

                <div style={{ fontSize: "12px", color: "#6b6b80", marginBottom: "4px" }}>{plan.desc}</div>
                <div style={{ fontSize: "16px", fontWeight: 700, color: "#fafafa", marginBottom: "16px" }}>{plan.name}</div>

                <div style={{ display: "flex", alignItems: "baseline", gap: "2px", marginBottom: "20px" }}>
                  <span style={{ fontSize: "40px", fontWeight: 800, color: "#fafafa", letterSpacing: "-2px" }}>{plan.price}</span>
                  <span style={{ fontSize: "13px", color: "#6b6b80" }}>{plan.period}</span>
                </div>

                <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px", display: "flex", flexDirection: "column", gap: "10px" }}>
                  {plan.features.map((f) => (
                    <li key={f} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "rgba(255,255,255,0.55)" }}>
                      <span style={{ color: V.brand, fontSize: "12px", flexShrink: 0 }}>{"\u2713"}</span>
                      {f}
                    </li>
                  ))}
                </ul>

                {plan.name === "Free" ? (
                  <>
                    <SignedOut>
                      <SignUpButton mode="modal">
                        <button style={{
                          display: "block", width: "100%", textAlign: "center",
                          padding: "10px", borderRadius: "7px",
                          fontSize: "13px", fontWeight: 600,
                          background: "transparent",
                          color: "rgba(255,255,255,0.6)",
                          border: "1px solid rgba(255,255,255,0.12)",
                          cursor: "pointer",
                        }}>
                          {plan.cta}
                        </button>
                      </SignUpButton>
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
                      <SignUpButton mode="modal">
                        <button style={{
                          display: "block", width: "100%", textAlign: "center",
                          padding: "10px", borderRadius: "7px",
                          fontSize: "13px", fontWeight: 600,
                          background: plan.pro ? V.brand : "transparent",
                          color: plan.pro ? "#fafafa" : "rgba(255,255,255,0.6)",
                          border: plan.pro ? "none" : "1px solid rgba(255,255,255,0.12)",
                          cursor: "pointer",
                        }}>
                          {plan.cta}
                        </button>
                      </SignUpButton>
                    </SignedOut>
                    <SignedIn>
                      <a href={plan.href ?? "#"} style={{
                        display: "block", textAlign: "center", textDecoration: "none",
                        padding: "10px", borderRadius: "7px",
                        fontSize: "13px", fontWeight: 600,
                        background: plan.pro ? V.brand : "transparent",
                        color: plan.pro ? "#fafafa" : "rgba(255,255,255,0.6)",
                        border: plan.pro ? "none" : "1px solid rgba(255,255,255,0.12)",
                      }}>
                        {plan.cta}
                      </a>
                    </SignedIn>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 8: EXTENSION MINI ── */}
      <section style={{
        padding: "60px 24px",
        borderTop: "1px solid rgba(255,255,255,0.05)",
        textAlign: "center",
      }}>
        <div style={{ maxWidth: "600px", margin: "0 auto" }}>
          <div style={{ fontSize: "32px", marginBottom: "16px" }}>{"\uD83D\uDCF1"}</div>
          <h2 style={{
            fontSize: "clamp(22px, 3vw, 30px)",
            fontWeight: 700, letterSpacing: "-0.5px",
            marginBottom: "12px", color: "#fafafa",
          }}>
            Use it anywhere you write
          </h2>
          <p style={{ fontSize: "15px", color: "#a0a0b0", lineHeight: 1.7, marginBottom: "24px" }}>
            The HumanizeIt extension works in any text field on any website.
          </p>
          <div style={{
            display: "inline-flex", gap: "16px", flexWrap: "wrap", justifyContent: "center",
          }}>
            {["Gmail", "Google Docs", "LinkedIn", "Notion", "Substack", "WordPress"].map((app) => (
              <span key={app} style={{
                fontSize: "13px", color: "#6b6b80",
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: "8px", padding: "8px 16px",
              }}>
                {app}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 9: FINAL CTA ── */}
      <section style={{
        padding: "80px 24px",
        borderTop: "1px solid rgba(139,92,246,0.1)",
      }}>
        <div style={{
          maxWidth: "700px", margin: "0 auto",
          background: "linear-gradient(135deg, rgba(139,92,246,0.12) 0%, rgba(139,92,246,0.04) 100%)",
          border: `1px solid ${V.brandBorder}`,
          borderRadius: "16px",
          padding: "56px 40px",
          textAlign: "center",
        }}>
          <h2 style={{
            fontSize: "clamp(26px, 4vw, 40px)",
            fontWeight: 800, letterSpacing: "-1.5px",
            lineHeight: 1.1, marginBottom: "14px", color: "#fafafa",
          }}>
            Ready to make your writing sound human?
          </h2>
          <p style={{ fontSize: "15px", color: "#a0a0b0", marginBottom: "32px" }}>
            Start free &mdash; 500 words/day, no credit card required.
          </p>
          <div className="two-cta-row" style={{ display: "flex", justifyContent: "center", gap: "12px", flexWrap: "wrap" }}>
            <SignedOut>
              <SignUpButton mode="modal">
                <button style={{
                  background: V.brand, color: "#fafafa", fontWeight: 700,
                  padding: "14px 28px", borderRadius: "8px", border: "none",
                  fontSize: "15px", cursor: "pointer",
                  boxShadow: `0 0 40px ${V.brandGlow}`,
                }}>
                  Start Writing Free &rarr;
                </button>
              </SignUpButton>
            </SignedOut>
            <SignedIn>
              <Link href="/dashboard/editor" style={{
                background: V.brand, color: "#fafafa", fontWeight: 700,
                padding: "14px 28px", borderRadius: "8px", textDecoration: "none",
                fontSize: "15px",
                boxShadow: `0 0 40px ${V.brandGlow}`,
                display: "inline-flex", alignItems: "center",
              }}>
                Open Dashboard &rarr;
              </Link>
            </SignedIn>
            <a href={EXTENSION_URL} target="_blank" rel="noopener noreferrer" style={{
              display: "inline-flex", alignItems: "center",
              background: "transparent", color: "rgba(255,255,255,0.6)", fontWeight: 600,
              padding: "14px 28px", borderRadius: "8px",
              border: "1px solid rgba(255,255,255,0.12)",
              fontSize: "15px", textDecoration: "none",
            }}>
              Install Chrome Extension
            </a>
          </div>
        </div>
      </section>

      {/* ── SECTION 10: FOOTER ── */}
      <footer style={{
        borderTop: "1px solid rgba(255,255,255,0.06)",
        padding: "24px",
      }}>
        <div className="footer-inner" style={{
          maxWidth: "1140px", margin: "0 auto",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", gap: "16px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
            <span style={{ fontSize: "16px", fontWeight: 800, color: V.brand }}>H.</span>
            <span style={{ fontSize: "13px", fontWeight: 600, color: "rgba(255,255,255,0.5)" }}>HumanizeIt</span>
          </div>
          <div className="footer-links" style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
            {[
              { label: "Dashboard", href: "/dashboard/editor" },
              { label: "Compare", href: "#" },
              { label: "Extension", href: EXTENSION_URL },
              { label: "Sign in", href: "/sign-in" },
              { label: "Sign up", href: "/sign-up" },
            ].map(({ label, href }) => (
              <a key={label} href={href} style={{ fontSize: "12px", color: "rgba(255,255,255,0.25)", textDecoration: "none" }}>
                {label}
              </a>
            ))}
          </div>
          <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.18)" }}>
            &copy; 2026 HumanizeIt &middot; Privacy &middot; Terms
          </p>
        </div>
      </footer>
    </div>
  );
}
