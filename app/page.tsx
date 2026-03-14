"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { SignedIn, SignedOut, UserButton, SignUpButton, SignInButton } from "@clerk/nextjs";
import { analyzeText } from "@/lib/algorithms/analyzeText";
import { Loader2 } from "lucide-react";
import { track } from "@vercel/analytics";
import { PricingButton } from "@/components/pricing-button";

const ExitIntent = dynamic(() => import("@/components/ui/exit-intent").then(m => m.ExitIntent), { ssr: false });

function scoreColor(s: number): string {
  if (s >= 75) return "#ef4444";
  if (s >= 50) return "#f97316";
  if (s >= 25) return "#d97706";
  return "#22c55e";
}

function getScoreLabel(s: number): { label: string; sub: string } {
  if (s >= 75) return { label: "FLAGGED AS AI", sub: "Will be caught by GPTZero, Turnitin, and Originality.ai" };
  if (s >= 50) return { label: "LIKELY AI", sub: "Most detectors will flag this text" };
  if (s >= 25) return { label: "BORDERLINE", sub: "Some detectors may flag this" };
  return { label: "LOOKS HUMAN", sub: "Should pass most AI detectors" };
}

const V = {
  brand: "#7c3aed",
  brandHover: "#6d28d9",
  brandDim: "rgba(124,58,237,0.06)",
  brandBorder: "rgba(124,58,237,0.15)",
  brandGlow: "rgba(124,58,237,0.1)",
  brandGlowSoft: "rgba(124,58,237,0.04)",
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
    planId: null as "PRO" | "TEAM" | null,
  },
  {
    name: "Pro",
    price: "$9",
    period: "/month",
    desc: "For serious writers",
    features: ["50,000 words / month", "Unlimited rewrites", "All 4 tone modes", "30-day history", "No watermark"],
    cta: "Upgrade to Pro",
    pro: true,
    planId: "PRO" as "PRO" | "TEAM" | null,
  },
  {
    name: "Team",
    price: "$29",
    period: "/month",
    desc: "For teams & agencies",
    features: ["200,000 words / month", "Unlimited rewrites", "API access", "Unlimited history", "Priority support"],
    cta: "Upgrade to Team",
    pro: false,
    planId: "TEAM" as "PRO" | "TEAM" | null,
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
    planId: null as "PRO" | "TEAM" | null,
  },
  {
    name: "Pro",
    price: "$7",
    period: "/month",
    desc: "For serious writers",
    features: ["50,000 words / month", "Unlimited rewrites", "All 4 tone modes", "30-day history", "No watermark"],
    cta: "Upgrade to Pro",
    pro: true,
    planId: "PRO" as "PRO" | "TEAM" | null,
  },
  {
    name: "Team",
    price: "$24",
    period: "/month",
    desc: "For teams & agencies",
    features: ["200,000 words / month", "Unlimited rewrites", "API access", "Unlimited history", "Priority support"],
    cta: "Upgrade to Team",
    pro: false,
    planId: "TEAM" as "PRO" | "TEAM" | null,
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
  const [openFaq, setOpenFaq] = useState<number | null>(null);

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
      background: "#ffffff",
      minHeight: "100vh",
      color: "#111827",
      fontFamily: "Inter, -apple-system, sans-serif",
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
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 0 20px rgba(124,58,237,0.15); }
          50% { box-shadow: 0 0 40px rgba(124,58,237,0.25); }
        }
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        @keyframes slideInLeft {
          from { opacity: 0; transform: translateX(-20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .fade-in { animation: fadeInUp 0.6s ease-out forwards; }
        .fade-in-delay { animation: fadeInUp 0.6s ease-out 0.15s forwards; opacity: 0; }
        .fade-in-delay2 { animation: fadeInUp 0.6s ease-out 0.3s forwards; opacity: 0; }
        .faq-answer { overflow: hidden; transition: max-height 0.35s ease, opacity 0.3s ease; }
        .faq-answer[data-open="false"] { max-height: 0; opacity: 0; }
        .faq-answer[data-open="true"] { max-height: 400px; opacity: 1; }
        .faq-chevron { transition: transform 0.3s ease; }
        .faq-chevron[data-open="true"] { transform: rotate(180deg); }
        @media (max-width: 768px) {
          .desktop-only { display: none !important; }
          .mobile-nav-links { display: flex !important; }
          .hero-h1-custom { font-size: 36px !important; }
          .three-col { grid-template-columns: 1fr !important; }
          .two-cta-row { flex-direction: column !important; }
          .comparison-table { font-size: 12px !important; }
          .comparison-table td, .comparison-table th { padding: 10px 8px !important; }
          .footer-grid { grid-template-columns: 1fr 1fr !important; }
          .footer-bottom { flex-direction: column !important; text-align: center !important; gap: 8px !important; }
          .extension-card-inner { flex-direction: column !important; text-align: center !important; }
          .pricing-toggle-row { flex-direction: column !important; align-items: center !important; gap: 16px !important; }
          .before-after-row { flex-direction: column !important; }
          .hero-mockup { display: none !important; }
        }
        @media (min-width: 769px) {
          .mobile-nav-links { display: none !important; }
          .mobile-menu-btn { display: none !important; }
          .before-after-row { flex-direction: row !important; }
        }
      `}</style>

      {/* ── LAUNCH BANNER ── */}
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 51,
        padding: "6px 16px",
        background: "#7c3aed", color: "#ffffff",
        textAlign: "center", fontSize: "13px", fontWeight: 500,
        opacity: 0.95,
      }}>
        Launch offer: 50% off Pro forever — Use code <strong>LAUNCH50</strong> &middot;{" "}
        <a href="#pricing" onClick={(e) => { e.preventDefault(); smoothScroll("pricing"); }} style={{ color: "#ffffff", fontWeight: 700, textDecoration: "underline" }}>
          Claim offer
        </a>
      </div>

      {/* ── NAVBAR ── */}
      <nav style={{
        position: "fixed", top: "30px", left: 0, right: 0, zIndex: 50,
        height: "56px",
        display: "flex", alignItems: "center",
        borderBottom: "1px solid #f3f4f6",
        backdropFilter: "blur(8px) saturate(160%)",
        background: "rgba(255,255,255,0.90)",
        animation: "fadeIn 0.3s ease forwards",
      }}>
        <div style={{
          maxWidth: "1140px", margin: "0 auto", padding: "0 24px",
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: "2px", textDecoration: "none" }}>
            <span style={{
              fontSize: "18px", fontWeight: 700, color: "#0a0a0a",
              fontFamily: "var(--font-heading)", letterSpacing: "-0.5px",
            }}>
              Humanize<span style={{ color: "#7c3aed" }}>It</span>
            </span>
          </Link>

          <div className="desktop-only" style={{ display: "flex", alignItems: "center", gap: "28px" }}>
            <a onClick={() => smoothScroll("demo")} style={{ color: "#525252", fontSize: "14px", textDecoration: "none", cursor: "pointer" }} className="nav-link">Demo</a>
            <a onClick={() => smoothScroll("how-it-works")} style={{ color: "#525252", fontSize: "14px", textDecoration: "none", cursor: "pointer" }}>How it works</a>
            <a onClick={() => smoothScroll("pricing")} style={{ color: "#525252", fontSize: "14px", textDecoration: "none", cursor: "pointer" }}>Pricing</a>
            <a href={EXTENSION_URL} target="_blank" rel="noopener noreferrer" style={{ color: "#525252", fontSize: "14px", textDecoration: "none" }}>Extension</a>
            <Link href="/blog" style={{ color: "#525252", fontSize: "14px", textDecoration: "none" }}>Blog</Link>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <SignedOut>
              <SignInButton mode="modal">
                <button className="desktop-only" style={{
                  color: "#4b5563", fontSize: "13px",
                  padding: "6px 14px", borderRadius: "8px",
                  border: "1px solid #e5e7eb",
                  background: "transparent", cursor: "pointer",
                }}>
                  Sign in
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button style={{
                  background: V.brand, color: "#ffffff", fontSize: "13px", fontWeight: 600,
                  padding: "6px 16px", borderRadius: "8px",
                  border: "none", cursor: "pointer",
                }}>
                  Get Started Free
                </button>
              </SignUpButton>
            </SignedOut>
            <SignedIn>
              <Link href="/dashboard/editor" style={{
                background: V.brand, color: "#ffffff", fontSize: "13px", fontWeight: 600,
                padding: "6px 16px", borderRadius: "8px", textDecoration: "none",
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
                background: "transparent", border: "none", color: "#111827",
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
          position: "fixed", top: "86px", left: 0, right: 0, zIndex: 49,
          background: "rgba(255,255,255,0.97)", backdropFilter: "blur(16px)",
          borderBottom: "1px solid #f3f4f6",
          flexDirection: "column", padding: "16px 24px", gap: "16px",
        }}>
          {[
            { label: "Demo", id: "demo" },
            { label: "How it works", id: "how-it-works" },
            { label: "Pricing", id: "pricing" },
          ].map(({ label, id }) => (
            <a key={id} onClick={() => { smoothScroll(id); setMobileMenuOpen(false); }} style={{
              color: "#374151", fontSize: "14px", textDecoration: "none", cursor: "pointer",
            }}>{label}</a>
          ))}
          <a href={EXTENSION_URL} target="_blank" rel="noopener noreferrer" style={{
            color: "#374151", fontSize: "14px", textDecoration: "none",
          }}>Chrome Extension</a>
          <Link href="/blog" onClick={() => setMobileMenuOpen(false)} style={{
            color: "#374151", fontSize: "14px", textDecoration: "none",
          }}>Blog</Link>
        </div>
      )}

      {/* ── SECTION 1: HERO ── */}
      <section style={{
        minHeight: "auto",
        padding: "140px 24px 80px",
        display: "flex",
        alignItems: "center",
        position: "relative",
        overflow: "hidden",
        background: "#ffffff",
      }}>
        {/* Soft background orbs */}
        <div style={{
          position: "absolute", top: "20%", left: "25%",
          width: "600px", height: "600px",
          background: "radial-gradient(circle, rgba(124,58,237,0.04) 0%, transparent 70%)",
          borderRadius: "50%", filter: "blur(80px)",
          animation: "drift1 12s ease-in-out infinite",
          pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", top: "40%", right: "15%",
          width: "400px", height: "400px",
          background: "radial-gradient(circle, rgba(124,58,237,0.03) 0%, transparent 70%)",
          borderRadius: "50%", filter: "blur(60px)",
          animation: "drift2 15s ease-in-out infinite",
          pointerEvents: "none",
        }} />

        <div style={{ maxWidth: "800px", margin: "0 auto", width: "100%", textAlign: "center", position: "relative", zIndex: 1 }}>

          {/* Badge pill */}
          <div className="fade-in" style={{
            display: "inline-flex", alignItems: "center", gap: "6px",
            border: "1px solid rgba(124,58,237,0.18)",
            background: "#f5f3ff",
            borderRadius: "100px", padding: "5px 16px", marginBottom: "32px",
            fontSize: "13px", color: V.brand, fontWeight: 500,
          }}>
            <span>&#10022;</span>
            <span>AI Humanization &middot; Now in Beta</span>
          </div>

          {/* H1 */}
          <h1 className="fade-in hero-h1-custom" style={{
            fontSize: "clamp(48px, 6vw, 72px)",
            fontWeight: 900,
            lineHeight: 1.1,
            letterSpacing: "-0.03em",
            margin: "0 0 24px",
            color: "#0a0a0a",
            fontFamily: "var(--font-heading)",
            whiteSpace: "pre-line",
          }}>
            {"Your AI text,\nfinally sounds "}
            <span style={{ color: "#7c3aed" }}>human.</span>
          </h1>

          {/* Subtitle */}
          <p className="fade-in-delay" style={{
            fontSize: "18px",
            color: "#737373",
            lineHeight: 1.65,
            margin: "0 auto 40px",
            maxWidth: "520px",
          }}>
            Paste your ChatGPT text and get an undetectable, natural-sounding version in seconds.
          </p>

          {/* Two CTAs */}
          <div className="fade-in-delay2 two-cta-row" style={{ display: "flex", justifyContent: "center", gap: "12px", marginBottom: "20px", flexWrap: "wrap" }}>
            <SignedOut>
              <Link href="/sign-up?redirect_url=/dashboard/editor" style={{
                background: "#7c3aed", color: "#ffffff", fontWeight: 700,
                padding: "14px 28px", borderRadius: "12px", textDecoration: "none",
                fontSize: "15px", display: "inline-flex", alignItems: "center",
                boxShadow: "0 4px 16px rgba(124,58,237,0.25)",
              }}>
                Start for free
              </Link>
            </SignedOut>
            <SignedIn>
              <Link href="/dashboard/editor" style={{
                background: "#7c3aed", color: "#ffffff", fontWeight: 700,
                padding: "14px 28px", borderRadius: "12px", textDecoration: "none",
                fontSize: "15px",
                boxShadow: "0 4px 16px rgba(124,58,237,0.25)",
                display: "inline-flex", alignItems: "center",
              }}>
                Open Dashboard &rarr;
              </Link>
            </SignedIn>
            <button onClick={() => smoothScroll("demo")} style={{
              background: "transparent", color: "#374151", fontWeight: 600,
              padding: "14px 28px", borderRadius: "12px",
              border: "1px solid #e5e7eb",
              fontSize: "15px", cursor: "pointer",
            }}>
              See how it works
            </button>
          </div>

          {/* Single trust line */}
          <div style={{ display: "flex", justifyContent: "center" }}>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: "5px",
              fontSize: "13px", color: "#737373",
            }}>
              <span style={{ color: "#22c55e", fontSize: "14px", fontWeight: 700 }}>{"\u2713"}</span>
              No credit card required
            </span>
          </div>

          {/* Product Mockup */}
          <div className="hero-mockup fade-in-delay2" style={{
            marginTop: "56px",
            borderRadius: "16px",
            border: "1px solid #e5e7eb",
            boxShadow: "0 24px 60px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.04)",
            overflow: "hidden",
            background: "#ffffff",
            maxWidth: "680px",
            margin: "56px auto 0",
          }}>
            {/* Browser chrome */}
            <div style={{
              background: "#f9fafb",
              borderBottom: "1px solid #e5e7eb",
              padding: "10px 16px",
              display: "flex", alignItems: "center", gap: "8px",
            }}>
              <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#fca5a5" }} />
              <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#fcd34d" }} />
              <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#86efac" }} />
              <div style={{
                flex: 1, marginLeft: "12px",
                background: "#f3f4f6", borderRadius: "6px",
                padding: "4px 12px", fontSize: "11px", color: "#9ca3af",
                textAlign: "center",
              }}>
                app.humanizeit.io/dashboard/editor
              </div>
            </div>
            {/* Mock editor content */}
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr",
              gap: "0",
            }}>
              {/* Before panel */}
              <div style={{
                padding: "20px 24px",
                borderRight: "1px solid #f3f4f6",
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                  <span style={{ fontSize: "11px", fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.5px" }}>Input</span>
                  <span style={{
                    fontSize: "10px", fontWeight: 700, padding: "2px 8px", borderRadius: "4px",
                    background: "rgba(239,68,68,0.1)", color: "#dc2626",
                  }}>87% AI</span>
                </div>
                <p style={{ fontSize: "12px", color: "#6b7280", lineHeight: 1.7, margin: 0 }}>
                  In today&apos;s rapidly evolving digital landscape, it is important to note that businesses must leverage cutting-edge technologies to maintain competitive advantage and maximize stakeholder value...
                </p>
              </div>
              {/* After panel */}
              <div style={{ padding: "20px 24px", background: "#fafafa" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                  <span style={{ fontSize: "11px", fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.5px" }}>Humanized</span>
                  <span style={{
                    fontSize: "10px", fontWeight: 700, padding: "2px 8px", borderRadius: "4px",
                    background: "rgba(22,163,74,0.1)", color: "#16a34a",
                  }}>4% AI</span>
                </div>
                <p style={{ fontSize: "12px", color: "#374151", lineHeight: 1.7, margin: 0 }}>
                  Most businesses know they need better tech — the ones that actually grow aren&apos;t just buying tools, they&apos;re rethinking how teams work. Less buzzwords, more results...
                </p>
              </div>
            </div>
            {/* Mock toolbar */}
            <div style={{
              borderTop: "1px solid #f3f4f6",
              padding: "10px 24px",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              background: "#fafafa",
            }}>
              <span style={{ fontSize: "11px", color: "#9ca3af" }}>247 words</span>
              <div style={{
                background: "#7c3aed", color: "#ffffff",
                fontSize: "11px", fontWeight: 600,
                padding: "6px 14px", borderRadius: "6px",
              }}>
                Humanize &rarr;
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 2: LIVE DEMO ── */}
      <section id="demo" aria-label="Live AI detection demo" style={{
        padding: "80px 24px",
        background: "#fafafa",
        borderTop: "1px solid #f3f4f6",
      }}>
        <div style={{ maxWidth: "720px", margin: "0 auto", opacity: 0, animation: "fadeInUp 0.5s ease forwards" }}>
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
            fontWeight: 700, letterSpacing: "-0.03em",
            marginBottom: "12px", color: "#0a0a0a",
            fontFamily: "var(--font-heading)",
          }}>
            Try it now &mdash; no signup needed
          </h2>
          <p style={{ textAlign: "center", fontSize: "15px", color: "#737373", marginBottom: "36px" }}>
            Paste any AI text and see the detection score instantly.
          </p>

          {/* Textarea card */}
          <div style={{
            background: "#ffffff",
            border: `1px solid ${result ? scoreColor(score) + "40" : "rgba(124,58,237,0.15)"}`,
            borderRadius: "16px",
            overflow: "hidden",
            boxShadow: "0 4px 16px rgba(124,58,237,0.07)",
            transition: "border-color 0.3s",
          }}>
            {/* Editor toolbar */}
            <div style={{
              padding: "10px 16px",
              borderBottom: "1px solid #f3f4f6",
              display: "flex", alignItems: "center", gap: "8px",
              background: "#fafafa",
            }}>
              <div style={{ width: "9px", height: "9px", borderRadius: "50%", background: "#fca5a5" }} />
              <div style={{ width: "9px", height: "9px", borderRadius: "50%", background: "#fcd34d" }} />
              <div style={{ width: "9px", height: "9px", borderRadius: "50%", background: "#86efac" }} />
              <span style={{ fontSize: "11px", color: "#9ca3af", marginLeft: "8px", fontFamily: "var(--font-geist-mono), monospace" }}>
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
                color: "#111827",
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
              borderTop: "1px solid #f3f4f6",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              background: "#fafafa",
            }}>
              <span style={{ fontSize: "11px", color: "#9ca3af" }}>
                {wordCount} word{wordCount !== 1 ? "s" : ""}
              </span>
              <button
                onClick={handleAnalyze}
                disabled={!canAnalyze}
                style={{
                  background: canAnalyze ? V.brand : "rgba(124,58,237,0.2)",
                  color: canAnalyze ? "#ffffff" : "#9ca3af",
                  fontSize: "13px", fontWeight: 700,
                  padding: "8px 20px", borderRadius: "8px",
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
              background: "#ffffff",
              border: `1px solid ${scoreColor(score)}30`,
              borderRadius: "16px",
              padding: "24px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
            }}>
              {/* Score row */}
              <div style={{ display: "flex", alignItems: "flex-end", gap: "8px", marginBottom: "8px" }}>
                <div style={{
                  fontSize: "56px", fontWeight: 900, color: scoreColor(score),
                  lineHeight: 1, fontVariantNumeric: "tabular-nums", letterSpacing: "-3px",
                  borderRadius: "8px",
                  ...(score >= 75 ? { animation: "pulseGlow 2s ease infinite" } : {}),
                }}>
                  {Math.round(score)}
                </div>
                <div style={{ fontSize: "14px", color: "#9ca3af", marginBottom: "10px" }}>/100</div>
              </div>
              <div style={{ fontSize: "12px", fontWeight: 800, color: scoreColor(score), letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: "4px" }}>
                {scoreConf.label}
              </div>
              <div style={{ fontSize: "13px", color: "#6b7280", lineHeight: 1.5, marginBottom: "16px" }}>
                {scoreConf.sub}
              </div>

              {/* Progress bar */}
              <div style={{ height: "4px", background: "#e5e7eb", borderRadius: "2px", overflow: "hidden", marginBottom: "16px" }}>
                <div style={{
                  height: "100%", borderRadius: "2px",
                  background: `linear-gradient(90deg, ${scoreColor(score)}80, ${scoreColor(score)})`,
                  width: `${score}%`, transition: "width 1s ease",
                }} />
              </div>

              {/* Top 3 patterns */}
              {topPatterns.length > 0 && (
                <div style={{ marginBottom: "16px" }}>
                  <div style={{ fontSize: "11px", fontWeight: 600, color: "#9ca3af", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Top patterns detected
                  </div>
                  {topPatterns.map(p => (
                    <div key={p.id} style={{
                      display: "flex", alignItems: "center", gap: "8px",
                      padding: "8px 0",
                      borderBottom: "1px solid #f3f4f6",
                      fontSize: "13px", color: "#4b5563",
                    }}>
                      <span style={{
                        fontSize: "10px", fontWeight: 600, padding: "2px 6px", borderRadius: "3px",
                        background: p.severity === "critical" || p.severity === "high" ? "rgba(239,68,68,0.12)" : "#f3f4f6",
                        color: p.severity === "critical" || p.severity === "high" ? "#ef4444" : "#6b7280",
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
                    background: "#7c3aed",
                    color: "#ffffff", borderRadius: "12px", border: "none",
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
                    background: "#7c3aed",
                    color: "#ffffff", borderRadius: "12px", border: "none",
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

      {/* ── BEFORE / AFTER SECTION ── */}
      <section style={{
        padding: "80px 24px",
        borderTop: "1px solid #f3f4f6",
        background: "#ffffff",
      }}>
        <div style={{ maxWidth: "900px", margin: "0 auto" }}>
          <h2 style={{
            textAlign: "center",
            fontSize: "clamp(24px, 3.5vw, 36px)",
            fontWeight: 700, letterSpacing: "-0.03em",
            marginBottom: "48px", color: "#0a0a0a",
            fontFamily: "var(--font-heading)",
          }}>
            See the difference
          </h2>
          <div className="before-after-row" style={{
            display: "flex", gap: "0", flexWrap: "wrap",
            border: "1px solid #e5e7eb", borderRadius: "16px", overflow: "hidden",
            boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          }}>
            {/* Before — AI detected */}
            <div style={{
              flex: "1 1 340px",
              background: "#fff9f9",
              padding: "32px",
              borderRight: "1px solid #fecaca",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "20px" }}>
                <span style={{
                  display: "inline-block", fontSize: "11px", fontWeight: 700,
                  padding: "3px 10px", borderRadius: "6px",
                  background: "rgba(239,68,68,0.1)", color: "#dc2626",
                  textTransform: "uppercase", letterSpacing: "0.5px",
                }}>
                  87% AI detected
                </span>
              </div>
              <p style={{ fontSize: "14px", color: "#4b5563", lineHeight: 1.8, margin: 0 }}>
                In today&apos;s rapidly evolving digital landscape, businesses must leverage cutting-edge technologies to maintain a competitive advantage. Furthermore, the implementation of robust strategies is paramount to achieving sustainable growth and maximizing stakeholder value in an increasingly interconnected global marketplace.
              </p>
            </div>

            {/* Center arrow */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: "0 20px",
              background: "#ffffff",
              borderRight: "1px solid #e5e7eb",
            }}>
              <div style={{
                width: "36px", height: "36px", borderRadius: "50%",
                background: "#f5f3ff",
                border: "1px solid rgba(124,58,237,0.2)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#7c3aed", fontSize: "16px", flexShrink: 0,
              }}>
                &rarr;
              </div>
            </div>

            {/* After — Human */}
            <div style={{
              flex: "1 1 340px",
              background: "#f0fdf4",
              padding: "32px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "20px" }}>
                <span style={{
                  display: "inline-block", fontSize: "11px", fontWeight: 700,
                  padding: "3px 10px", borderRadius: "6px",
                  background: "rgba(22,163,74,0.1)", color: "#16a34a",
                  textTransform: "uppercase", letterSpacing: "0.5px",
                }}>
                  4% AI &mdash; Looks human
                </span>
              </div>
              <p style={{ fontSize: "14px", color: "#4b5563", lineHeight: 1.8, margin: 0 }}>
                Most businesses know they need better tech — but few actually use it well. The ones that grow aren&apos;t just buying tools, they&apos;re rethinking how teams work together. It&apos;s less about &quot;digital transformation&quot; buzzwords and more about fixing the basics: clear communication, faster feedback loops, and actually listening to customers.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 3: HOW IT WORKS ── */}
      <section id="how-it-works" aria-label="How it works" style={{
        padding: "80px 24px",
        borderTop: "1px solid #f3f4f6",
        background: "#fafafa",
      }}>
        <div style={{ maxWidth: "900px", margin: "0 auto" }}>
          <h2 style={{
            textAlign: "center",
            fontSize: "40px",
            fontWeight: 700, letterSpacing: "-0.03em",
            marginBottom: "56px", color: "#0a0a0a",
            fontFamily: "var(--font-heading)",
          }}>
            Everything you need to sound human
          </h2>

          <div className="three-col" style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "20px",
          }}>
            {[
              {
                icon: (
                  <svg width="24" height="24" fill="none" stroke="#7c3aed" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                    <rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
                    <line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/>
                  </svg>
                ),
                title: "Paste",
                desc: "Any AI-generated text from ChatGPT, Claude, Gemini, or any other model.",
              },
              {
                icon: (
                  <svg width="24" height="24" fill="none" stroke="#7c3aed" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                    <line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
                  </svg>
                ),
                title: "Analyze",
                desc: "See your AI score and exactly which patterns were detected across 24 signals.",
              },
              {
                icon: (
                  <svg width="24" height="24" fill="none" stroke="#7c3aed" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                    <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
                  </svg>
                ),
                title: "Humanize",
                desc: "One click rewrites your text to sound natural and pass every major detector.",
              },
            ].map(({ icon, title, desc }) => (
              <div key={title} style={{
                background: "#ffffff",
                border: "1px solid #f3f4f6",
                borderRadius: "20px",
                padding: "32px 28px",
                textAlign: "left",
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                transition: "border-color 0.2s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(124,58,237,0.2)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "#f3f4f6"; }}
              >
                <div style={{
                  width: "48px", height: "48px", borderRadius: "12px",
                  background: "#f5f3ff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  marginBottom: "20px",
                }}>
                  {icon}
                </div>
                <h3 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "10px", color: "#0a0a0a", fontFamily: "var(--font-heading)" }}>{title}</h3>
                <p style={{ fontSize: "14px", color: "#737373", lineHeight: 1.65, margin: 0 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 4: CHROME EXTENSION CTA ── */}
      <section id="extension" style={{ padding: "80px 24px", background: "#ffffff", borderTop: "1px solid #f3f4f6" }}>
        <div style={{
          maxWidth: "900px", margin: "0 auto",
          background: "linear-gradient(135deg, rgba(124,58,237,0.05) 0%, rgba(124,58,237,0.02) 100%)",
          border: `1px solid rgba(124,58,237,0.12)`,
          borderRadius: "20px",
          padding: "48px 40px",
        }}>
          <div className="extension-card-inner" style={{ display: "flex", alignItems: "center", gap: "40px" }}>
            <div style={{ flex: 1 }}>
              <div style={{
                width: "52px", height: "52px", borderRadius: "14px",
                background: "#f5f3ff", border: "1px solid rgba(124,58,237,0.15)",
                display: "flex", alignItems: "center", justifyContent: "center",
                marginBottom: "20px", fontSize: "26px",
              }}>
                {"\uD83E\uDDE9"}
              </div>
              <h2 style={{
                fontSize: "clamp(22px, 3vw, 30px)",
                fontWeight: 700, letterSpacing: "-0.03em",
                marginBottom: "12px", color: "#0a0a0a",
                fontFamily: "var(--font-heading)",
              }}>
                HumanizeIt is now a Chrome Extension
              </h2>
              <p style={{ fontSize: "15px", color: "#737373", lineHeight: 1.7, marginBottom: "24px" }}>
                Analyze and humanize text directly in Gmail, Google Docs, LinkedIn, and Notion &mdash; without leaving the page.
              </p>
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "20px" }}>
                <a href={EXTENSION_URL} target="_blank" rel="noopener noreferrer" style={{
                  display: "inline-flex", alignItems: "center", gap: "6px",
                  background: V.brand, color: "#ffffff", fontWeight: 700,
                  padding: "12px 24px", borderRadius: "10px",
                  fontSize: "14px", textDecoration: "none",
                }}>
                  Install Chrome Extension &rarr;
                </a>
                <a href={EXTENSION_URL} target="_blank" rel="noopener noreferrer" style={{
                  display: "inline-flex", alignItems: "center",
                  background: "transparent", color: "#374151",
                  padding: "12px 24px", borderRadius: "10px",
                  border: "1px solid #e5e7eb",
                  fontSize: "14px", textDecoration: "none", fontWeight: 600,
                }}>
                  Learn more
                </a>
              </div>
              <p style={{ fontSize: "12px", color: "#9ca3af" }}>
                Works on: Gmail &middot; Google Docs &middot; LinkedIn &middot; Notion &middot; Substack &middot; WordPress
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 6: COMPARISON TABLE ── */}
      <section style={{
        padding: "80px 24px",
        borderTop: "1px solid #f3f4f6",
        background: "#fafafa",
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
            fontWeight: 700, letterSpacing: "-0.03em",
            marginBottom: "48px", color: "#0a0a0a",
            fontFamily: "var(--font-heading)",
          }}>
            Beats every AI detector
          </h2>

          <div style={{
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: "16px",
            overflow: "hidden",
            boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          }}>
            <table className="comparison-table" style={{
              width: "100%", borderCollapse: "collapse",
              fontSize: "14px",
            }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #f3f4f6", background: "#fafafa" }}>
                  <th style={{ padding: "14px 16px", textAlign: "left", color: "#9ca3af", fontWeight: 600, fontSize: "12px" }}></th>
                  <th style={{ padding: "14px 16px", textAlign: "center", color: V.brand, fontWeight: 700, fontSize: "13px" }}>HumanizeIt</th>
                  <th style={{ padding: "14px 16px", textAlign: "center", color: "#6b7280", fontWeight: 600, fontSize: "13px" }}>QuillBot</th>
                  <th style={{ padding: "14px 16px", textAlign: "center", color: "#6b7280", fontWeight: 600, fontSize: "13px" }}>Undetectable.ai</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row, i) => (
                  <tr key={row.label} style={{ borderBottom: i < COMPARISON.length - 1 ? "1px solid #f9fafb" : "none" }}>
                    <td style={{ padding: "12px 16px", color: "#4b5563", fontWeight: 500 }}>{row.label}</td>
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
      <section id="pricing" aria-label="Pricing plans" style={{
        padding: "80px 24px",
        borderTop: "1px solid #f3f4f6",
        background: "#ffffff",
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
            fontWeight: 700, letterSpacing: "-0.03em",
            marginBottom: "12px", color: "#0a0a0a",
            fontFamily: "var(--font-heading)",
          }}>
            Start free. Upgrade when ready.
          </h2>

          {/* Billing toggle */}
          <div className="pricing-toggle-row" style={{
            display: "flex", justifyContent: "center", alignItems: "center",
            gap: "12px", marginBottom: "48px",
          }}>
            <span style={{ fontSize: "13px", color: !billingAnnual ? "#111827" : "#9ca3af", fontWeight: 600 }}>Monthly</span>
            <button onClick={() => setBillingAnnual(!billingAnnual)} style={{
              width: "44px", height: "24px", borderRadius: "12px",
              background: billingAnnual ? V.brand : "#e5e7eb",
              border: "none", cursor: "pointer", position: "relative",
              transition: "background 0.2s",
            }}>
              <div style={{
                width: "18px", height: "18px", borderRadius: "50%",
                background: "#ffffff",
                position: "absolute", top: "3px",
                left: billingAnnual ? "23px" : "3px",
                transition: "left 0.2s",
                boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
              }} />
            </button>
            <span style={{ fontSize: "13px", color: billingAnnual ? "#111827" : "#9ca3af", fontWeight: 600 }}>
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

          {/* Beta badge */}
          <div style={{ textAlign: "center", marginBottom: "28px" }}>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: "6px",
              fontSize: "12px", fontWeight: 500,
              color: "#6b7280",
              background: "#f5f3ff",
              border: "1px solid rgba(124,58,237,0.15)",
              padding: "5px 14px", borderRadius: "100px",
            }}>
              {"\uD83D\uDE80"} Currently in Beta — Paid plans coming soon
            </span>
          </div>

          <div className="three-col" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", alignItems: "center" }}>
            {plans.map((plan, i) => (
              <div key={plan.name} style={{
                background: plan.pro ? "#7c3aed" : "#ffffff",
                border: plan.pro ? "1px solid #7c3aed" : "1px solid #e5e7eb",
                borderRadius: "20px",
                padding: "32px 24px",
                position: "relative",
                boxShadow: plan.pro ? "0 20px 40px rgba(124,58,237,0.25), 0 4px 12px rgba(124,58,237,0.15)" : "0 1px 3px rgba(0,0,0,0.06)",
                transform: plan.pro ? "scale(1.03)" : "scale(1)",
                opacity: 0,
                animation: `fadeInUp 0.5s ease ${i * 0.1}s forwards`,
                transition: "transform 0.2s",
              }}>
                {plan.pro && (
                  <div style={{
                    position: "absolute", top: "-12px", left: "50%", transform: "translateX(-50%)",
                    background: "#ffffff", color: V.brand,
                    fontSize: "11px", fontWeight: 700,
                    padding: "3px 14px", borderRadius: "100px",
                    whiteSpace: "nowrap",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
                  }}>
                    Most Popular
                  </div>
                )}

                <div style={{ fontSize: "12px", color: plan.pro ? "rgba(255,255,255,0.65)" : "#9ca3af", marginBottom: "4px" }}>{plan.desc}</div>
                <div style={{ fontSize: "16px", fontWeight: 700, color: plan.pro ? "#ffffff" : "#111827", marginBottom: "16px" }}>{plan.name}</div>

                <div style={{ display: "flex", alignItems: "baseline", gap: "2px", marginBottom: "20px" }}>
                  <span style={{ fontSize: "40px", fontWeight: 800, color: plan.pro ? "#ffffff" : "#111827", letterSpacing: "-2px" }}>{plan.price}</span>
                  <span style={{ fontSize: "13px", color: plan.pro ? "rgba(255,255,255,0.65)" : "#9ca3af" }}>{plan.period}</span>
                </div>

                <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px", display: "flex", flexDirection: "column", gap: "10px" }}>
                  {plan.features.map((f) => (
                    <li key={f} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: plan.pro ? "rgba(255,255,255,0.85)" : "#4b5563" }}>
                      <span style={{ color: plan.pro ? "#ffffff" : V.brand, fontSize: "12px", flexShrink: 0 }}>{"\u2713"}</span>
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
                          padding: "10px", borderRadius: "10px",
                          fontSize: "13px", fontWeight: 600,
                          background: "transparent",
                          color: "#4b5563",
                          border: "1px solid #e5e7eb",
                          cursor: "pointer",
                        }}>
                          {plan.cta}
                        </button>
                      </SignUpButton>
                    </SignedOut>
                    <SignedIn>
                      <Link href="/dashboard/editor" style={{
                        display: "block", textAlign: "center", textDecoration: "none",
                        padding: "10px", borderRadius: "10px",
                        fontSize: "13px", fontWeight: 600,
                        background: "transparent",
                        color: "#4b5563",
                        border: "1px solid #e5e7eb",
                      }}>
                        Open Dashboard
                      </Link>
                    </SignedIn>
                  </>
                ) : (
                  <PricingButton
                    plan={plan.planId!}
                    annual={billingAnnual}
                    isPro={plan.pro}
                    label={plan.cta}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 8: EXTENSION MINI ── */}
      <section style={{
        padding: "60px 24px",
        borderTop: "1px solid #f3f4f6",
        textAlign: "center",
        background: "#fafafa",
      }}>
        <div style={{ maxWidth: "600px", margin: "0 auto" }}>
          <div style={{
            width: "52px", height: "52px", borderRadius: "14px",
            background: "#f5f3ff", border: "1px solid rgba(124,58,237,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 20px", fontSize: "26px",
          }}>
            {"\uD83D\uDCF1"}
          </div>
          <h2 style={{
            fontSize: "clamp(22px, 3vw, 30px)",
            fontWeight: 700, letterSpacing: "-0.03em",
            marginBottom: "12px", color: "#0a0a0a",
            fontFamily: "var(--font-heading)",
          }}>
            Use it anywhere you write
          </h2>
          <p style={{ fontSize: "15px", color: "#737373", lineHeight: 1.7, marginBottom: "24px" }}>
            The HumanizeIt extension works in any text field on any website.
          </p>
          <div style={{
            display: "inline-flex", gap: "10px", flexWrap: "wrap", justifyContent: "center",
          }}>
            {["Gmail", "Google Docs", "LinkedIn", "Notion", "Substack", "WordPress"].map((app) => (
              <span key={app} style={{
                fontSize: "13px", color: "#4b5563",
                background: "#ffffff",
                border: "1px solid #e5e7eb",
                borderRadius: "8px", padding: "7px 16px",
              }}>
                {app}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ SECTION ── */}
      <section id="faq" aria-label="Frequently asked questions" style={{
        padding: "80px 24px",
        borderTop: "1px solid #f3f4f6",
        background: "#ffffff",
      }}>
        <div style={{ maxWidth: "720px", margin: "0 auto" }}>
          <p style={{
            textAlign: "center", fontSize: "11px", fontWeight: 700,
            letterSpacing: "2px", color: V.brand, textTransform: "uppercase",
            marginBottom: "14px",
          }}>
            FAQ
          </p>
          <h2 style={{
            textAlign: "center",
            fontSize: "clamp(24px, 3.5vw, 36px)",
            fontWeight: 700, letterSpacing: "-0.03em",
            marginBottom: "48px", color: "#0a0a0a",
            fontFamily: "var(--font-heading)",
          }}>
            Everything You Need to Know
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {([
              {
                q: "Is HumanizeIt actually free?",
                a: "Yes — the free tier gives you 500 words per day with 1 humanization. No credit card required. Pro plan ($9/mo) gives 50,000 words/month.",
              },
              {
                q: "How does the AI detection work?",
                a: "We analyze your text against 24 detection patterns used by tools like GPTZero, Turnitin, and Originality.ai — including sentence entropy, vocabulary diversity, burstiness score, and more. You get a 0–100 score with a breakdown of which patterns triggered.",
              },
              {
                q: "Will my humanized text pass GPTZero?",
                a: "Our V3 multi-pass humanizer is specifically trained to reduce the patterns GPTZero flags. Most users see their score drop below 25 (green zone). Results vary by text length and complexity.",
              },
              {
                q: "What AI tools does it work with?",
                a: "Optimized for ChatGPT (GPT-3.5, GPT-4, GPT-4o), Claude, Gemini, Copilot, and Llama outputs. Any AI-generated text.",
              },
              {
                q: "Does it work for academic papers and essays?",
                a: "Yes — it's especially effective for academic content. The humanizer preserves meaning while restructuring sentences to avoid the patterns Turnitin's AI detector and Copyleaks flag.",
              },
              {
                q: "Is my text stored or shared?",
                a: "No. Text is processed in memory and immediately discarded. We don't store, log, or train on your content.",
              },
              {
                q: "What's the difference between detecting and humanizing?",
                a: "Detection scores your text and shows you exactly which AI patterns are present. Humanizing rewrites the text to reduce those patterns — using a 3-pass process that preserves your original meaning.",
              },
              {
                q: "How is HumanizeIt different from Undetectable.ai or Quillbot?",
                a: "We show you the exact detection breakdown (24 patterns) before and after — transparency competitors don't offer. We're also significantly cheaper, with a real free tier.",
              },
              {
                q: "Is HumanizeIt detectable by Turnitin?",
                a: "No. Our multi-pass humanizer specifically targets the patterns flagged by Turnitin, GPTZero, and Originality.ai. The rewritten text consistently scores below detection thresholds across all major platforms.",
              },
              {
                q: "Does it work with ChatGPT text?",
                a: "Yes — HumanizeIt works with text from GPT-4, GPT-4o, Claude, Gemini, Copilot, and any other AI model. Just paste the output and we handle the rest.",
              },
              {
                q: "What is your refund policy?",
                a: "We offer a 7-day money-back guarantee on all paid plans. If you're not satisfied, contact us within 7 days for a full refund — no questions asked.",
              },
              {
                q: "Is there a free plan?",
                a: "Yes — the free plan gives you 500 words per day, forever. No credit card required, no trial period. Upgrade to Pro anytime for higher limits.",
              },
              {
                q: "Do you offer lifetime deals?",
                a: "Yes! We offer a one-time payment option for lifetime access. Visit our lifetime deals page at /lifetime for current pricing and availability.",
              },
            ] as { q: string; a: string }[]).map((item, i) => (
              <div key={i} style={{
                background: "#ffffff",
                border: `1px solid ${openFaq === i ? "rgba(124,58,237,0.2)" : "#f3f4f6"}`,
                borderRadius: "14px",
                overflow: "hidden",
                transition: "border-color 0.3s",
                boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
              }}>
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  aria-expanded={openFaq === i}
                  style={{
                    width: "100%",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "18px 22px",
                    background: "transparent", border: "none",
                    cursor: "pointer", textAlign: "left",
                  }}
                >
                  <span style={{
                    fontSize: "15px", fontWeight: 600, color: "#111827",
                    lineHeight: 1.4, paddingRight: "16px",
                  }}>
                    {item.q}
                  </span>
                  <span
                    className="faq-chevron"
                    data-open={openFaq === i ? "true" : "false"}
                    style={{
                      fontSize: "18px", color: V.brand, flexShrink: 0,
                      lineHeight: 1,
                    }}
                  >
                    &#x25BE;
                  </span>
                </button>
                <div
                  className="faq-answer"
                  data-open={openFaq === i ? "true" : "false"}
                >
                  <p style={{
                    padding: "0 22px 18px",
                    margin: 0,
                    fontSize: "14px",
                    color: "#737373",
                    lineHeight: 1.7,
                  }}>
                    {item.a}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 9: FINAL CTA ── */}
      <section style={{
        padding: "80px 24px",
        borderTop: "1px solid #f3f4f6",
        background: "#fafafa",
      }}>
        <div style={{
          maxWidth: "680px", margin: "0 auto",
          background: "linear-gradient(135deg, rgba(124,58,237,0.05) 0%, rgba(124,58,237,0.02) 100%)",
          border: "1px solid rgba(124,58,237,0.12)",
          borderRadius: "20px",
          padding: "56px 40px",
          textAlign: "center",
        }}>
          <h2 style={{
            fontSize: "clamp(26px, 4vw, 40px)",
            fontWeight: 800, letterSpacing: "-0.03em",
            lineHeight: 1.1, marginBottom: "14px", color: "#0a0a0a",
            fontFamily: "var(--font-heading)",
          }}>
            Ready to make your writing sound human?
          </h2>
          <p style={{ fontSize: "15px", color: "#737373", marginBottom: "32px" }}>
            Start free &mdash; 500 words/day, no credit card required.
          </p>
          <div className="two-cta-row" style={{ display: "flex", justifyContent: "center", gap: "12px", flexWrap: "wrap" }}>
            <SignedOut>
              <SignUpButton mode="modal">
                <button style={{
                  background: "#7c3aed", color: "#ffffff", fontWeight: 700,
                  padding: "14px 28px", borderRadius: "12px", border: "none",
                  fontSize: "15px", cursor: "pointer",
                  boxShadow: "0 4px 16px rgba(124,58,237,0.25)",
                }}>
                  Start Writing Free &rarr;
                </button>
              </SignUpButton>
            </SignedOut>
            <SignedIn>
              <Link href="/dashboard/editor" style={{
                background: "#7c3aed", color: "#ffffff", fontWeight: 700,
                padding: "14px 28px", borderRadius: "12px", textDecoration: "none",
                fontSize: "15px",
                boxShadow: "0 4px 16px rgba(124,58,237,0.25)",
                display: "inline-flex", alignItems: "center",
              }}>
                Open Dashboard &rarr;
              </Link>
            </SignedIn>
            <a href={EXTENSION_URL} target="_blank" rel="noopener noreferrer" style={{
              display: "inline-flex", alignItems: "center",
              background: "transparent", color: "#374151", fontWeight: 600,
              padding: "14px 28px", borderRadius: "12px",
              border: "1px solid #e5e7eb",
              fontSize: "15px", textDecoration: "none",
            }}>
              Install Chrome Extension
            </a>
          </div>
        </div>
      </section>

      {/* ── SECTION 10: FOOTER (DARK) ── */}
      <footer style={{
        background: "#0a0a0a",
        borderTop: "1px solid #1a1a1a",
        padding: "56px 24px 0",
      }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
          {/* 4-column grid */}
          <div className="footer-grid" style={{
            display: "grid",
            gridTemplateColumns: "2fr 1fr 1fr 1fr",
            gap: "40px",
            paddingBottom: "48px",
          }}>
            {/* Col 1: Logo + description */}
            <div>
              <div style={{ marginBottom: "16px" }}>
                <span style={{
                  fontSize: "18px", fontWeight: 700,
                  color: "#ffffff",
                  fontFamily: "var(--font-heading)", letterSpacing: "-0.5px",
                }}>
                  Humanize<span style={{ color: "#7c3aed" }}>It</span>
                </span>
              </div>
              <p style={{ fontSize: "14px", color: "#737373", lineHeight: 1.7, maxWidth: "240px", margin: 0 }}>
                The AI humanizer that actually works. Make your AI text undetectable in seconds.
              </p>
            </div>

            {/* Col 2: Product */}
            <div>
              <div style={{ fontSize: "12px", fontWeight: 600, color: "#525252", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "16px" }}>
                Product
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {[
                  { label: "Dashboard", href: "/dashboard/editor" },
                  { label: "Chrome Extension", href: EXTENSION_URL },
                  { label: "Pricing", href: "#pricing" },
                  { label: "Lifetime Deal", href: "/lifetime" },
                ].map(({ label, href }) => (
                  <a key={label} href={href} style={{ fontSize: "14px", color: "#737373", textDecoration: "none" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = "#ffffff"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = "#737373"; }}
                  >
                    {label}
                  </a>
                ))}
              </div>
            </div>

            {/* Col 3: Resources */}
            <div>
              <div style={{ fontSize: "12px", fontWeight: 600, color: "#525252", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "16px" }}>
                Resources
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {[
                  { label: "Blog", href: "/blog" },
                  { label: "How it works", href: "#how-it-works" },
                  { label: "Compare", href: "#" },
                  { label: "Sign up", href: "/sign-up" },
                ].map(({ label, href }) => (
                  <a key={label} href={href} style={{ fontSize: "14px", color: "#737373", textDecoration: "none" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = "#ffffff"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = "#737373"; }}
                  >
                    {label}
                  </a>
                ))}
              </div>
            </div>

            {/* Col 4: Legal */}
            <div>
              <div style={{ fontSize: "12px", fontWeight: 600, color: "#525252", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "16px" }}>
                Legal
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {[
                  { label: "Privacy Policy", href: "/privacy" },
                  { label: "Terms of Service", href: "/terms" },
                  { label: "Cookie Policy", href: "/cookies" },
                  { label: "Refund Policy", href: "/refunds" },
                ].map(({ label, href }) => (
                  <a key={label} href={href} style={{ fontSize: "14px", color: "#737373", textDecoration: "none" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = "#ffffff"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = "#737373"; }}
                  >
                    {label}
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="footer-bottom" style={{
            borderTop: "1px solid #1f1f1f",
            padding: "20px 0",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            gap: "16px",
          }}>
            <p style={{ fontSize: "13px", color: "#525252", margin: 0 }}>
              &copy; 2026 HumanizeIt. All rights reserved.
            </p>
            <p style={{ fontSize: "13px", color: "#525252", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
              Built by{" "}
              <a
                href="https://www.linkedin.com/in/boubakerjouini/"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "#a3a3a3", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "4px" }}
                onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = "#ffffff"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = "#a3a3a3"; }}
              >
                Boubaker Jouini
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
              </a>
            </p>
          </div>
        </div>
      </footer>

      {/* Exit intent popup */}
      <ExitIntent />
    </div>
  );
}
