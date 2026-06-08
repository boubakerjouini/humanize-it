"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { SignedIn, SignedOut, UserButton, SignUpButton, SignInButton } from "@clerk/nextjs";
import { analyzeText } from "@/lib/algorithms/analyzeText";
import {
  Loader2,
  ArrowRight,
  ClipboardPaste,
  ScanSearch,
  Sparkles,
  Puzzle,
  Smartphone,
  ChevronDown,
  Check,
  Menu,
  X as XIcon,
  Linkedin,
} from "lucide-react";
import { PricingButton } from "@/components/pricing-button";
import { ScoreRing } from "@/components/ui/score-ring";
import { THEME, humanScore, humanScoreColor, humanScoreLabel } from "@/lib/theme";

const ExitIntent = dynamic(() => import("@/components/ui/exit-intent").then(m => m.ExitIntent), { ssr: false });

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
  { label: "GPTZero", us: "✅", quill: "⚠️", undet: "✅" },
  { label: "Turnitin", us: "✅", quill: "❌", undet: "⚠️" },
  { label: "Originality.ai", us: "✅", quill: "❌", undet: "⚠️" },
  { label: "Chrome Extension", us: "✅", quill: "❌", undet: "❌" },
  { label: "Free Tier", us: "✅", quill: "✅", undet: "❌" },
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
  const aiScore = result?.score ?? 0;
  const human = result ? humanScore(aiScore) : 0;
  const humanColor = humanScoreColor(human);
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const canAnalyze = text.trim().length >= 10 && !analyzing;

  const topPatterns = result
    ? [...result.patterns]
        .sort((a, b) => {
          const o: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
          return (o[a.severity] ?? 4) - (o[b.severity] ?? 4);
        })
        .slice(0, 4)
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

  const persistAndGo = useCallback((path: string) => {
    if (text.trim()) {
      try { sessionStorage.setItem("prefill-text", text); } catch {}
    }
    router.push(path);
  }, [router, text]);

  const smoothScroll = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  const plans = billingAnnual ? PLANS_ANNUAL : PLANS_MONTHLY;

  // ── Shared inline style helpers (token-driven) ───────────────────────────
  const sectionLabel: React.CSSProperties = {
    textAlign: "center",
    fontFamily: THEME.fontMono,
    fontSize: "12px",
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color: THEME.textDim,
    marginBottom: "14px",
  };
  const h2Style: React.CSSProperties = {
    textAlign: "center",
    fontSize: "clamp(26px, 3.5vw, 40px)",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    color: THEME.text,
    fontFamily: THEME.fontHeading,
  };

  return (
    <div style={{
      minHeight: "100vh",
      color: THEME.text,
      fontFamily: THEME.fontSans,
    }}>
      {/* Keyframe animations + responsive rules */}
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes signalIn {
          from { opacity: 0; transform: translateX(-8px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .fade-in { animation: fadeInUp 0.6s ease-out forwards; }
        .fade-in-delay { animation: fadeInUp 0.6s ease-out 0.15s forwards; opacity: 0; }
        .fade-in-delay2 { animation: fadeInUp 0.6s ease-out 0.3s forwards; opacity: 0; }
        .faq-answer { overflow: hidden; transition: max-height 0.35s ease, opacity 0.3s ease; }
        .faq-answer[data-open="false"] { max-height: 0; opacity: 0; }
        .faq-answer[data-open="true"] { max-height: 400px; opacity: 1; }
        .faq-chevron { transition: transform 0.3s ease; }
        .faq-chevron[data-open="true"] { transform: rotate(180deg); }
        .signal-row { animation: signalIn 0.4s ease both; }
        @media (max-width: 900px) {
          .hero-grid { grid-template-columns: 1fr !important; gap: 40px !important; }
        }
        @media (max-width: 768px) {
          .desktop-only { display: none !important; }
          .mobile-nav-links { display: flex !important; }
          .three-col { grid-template-columns: 1fr !important; }
          .two-cta-row { flex-direction: column !important; }
          .comparison-table { font-size: 12px !important; }
          .comparison-table td, .comparison-table th { padding: 10px 8px !important; }
          .footer-grid { grid-template-columns: 1fr 1fr !important; }
          .footer-bottom { flex-direction: column !important; text-align: center !important; gap: 8px !important; }
          .extension-card-inner { flex-direction: column !important; text-align: center !important; }
          .pricing-toggle-row { flex-direction: column !important; align-items: center !important; gap: 16px !important; }
          .before-after-row { flex-direction: column !important; }
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
        background: THEME.brand, color: "#ffffff",
        textAlign: "center", fontSize: "13px", fontWeight: 500,
        fontFamily: THEME.fontMono,
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
        borderBottom: `1px solid ${THEME.border}`,
        backdropFilter: "blur(10px) saturate(160%)",
        background: "rgba(16,18,24,0.82)",
        animation: "fadeIn 0.3s ease forwards",
      }}>
        <div style={{
          maxWidth: "1140px", margin: "0 auto", padding: "0 24px",
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: "2px", textDecoration: "none" }}>
            <span style={{
              fontSize: "18px", fontWeight: 700, color: THEME.text,
              fontFamily: THEME.fontHeading, letterSpacing: "-0.02em",
            }}>
              Humanize<span style={{ color: THEME.brand }}>It</span>
            </span>
          </Link>

          <div className="desktop-only" style={{ display: "flex", alignItems: "center", gap: "28px" }}>
            <a onClick={() => smoothScroll("demo")} style={{ color: THEME.textDim, fontSize: "14px", textDecoration: "none", cursor: "pointer" }}>Demo</a>
            <a onClick={() => smoothScroll("how-it-works")} style={{ color: THEME.textDim, fontSize: "14px", textDecoration: "none", cursor: "pointer" }}>How it works</a>
            <a onClick={() => smoothScroll("pricing")} style={{ color: THEME.textDim, fontSize: "14px", textDecoration: "none", cursor: "pointer" }}>Pricing</a>
            <a href={EXTENSION_URL} target="_blank" rel="noopener noreferrer" style={{ color: THEME.textDim, fontSize: "14px", textDecoration: "none" }}>Extension</a>
            <Link href="/blog" style={{ color: THEME.textDim, fontSize: "14px", textDecoration: "none" }}>Blog</Link>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <SignedOut>
              <SignInButton mode="modal">
                <button className="desktop-only" style={{
                  color: THEME.textDim, fontSize: "13px",
                  padding: "6px 14px", borderRadius: "8px",
                  border: `1px solid ${THEME.border}`,
                  background: "transparent", cursor: "pointer",
                  fontFamily: THEME.fontSans,
                }}>
                  Sign in
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button style={{
                  background: THEME.brand, color: "#ffffff", fontSize: "13px", fontWeight: 600,
                  padding: "6px 16px", borderRadius: "8px",
                  border: "none", cursor: "pointer",
                  fontFamily: THEME.fontSans,
                }}>
                  Get Started Free
                </button>
              </SignUpButton>
            </SignedOut>
            <SignedIn>
              <Link href="/dashboard/editor" style={{
                background: THEME.brand, color: "#ffffff", fontSize: "13px", fontWeight: 600,
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
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileMenuOpen}
              style={{
                background: "transparent", border: "none", color: THEME.text,
                cursor: "pointer", padding: "4px 8px",
                display: "inline-flex", alignItems: "center",
              }}
            >
              {mobileMenuOpen ? <XIcon size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile menu dropdown */}
      {mobileMenuOpen && (
        <div className="mobile-nav-links" style={{
          position: "fixed", top: "86px", left: 0, right: 0, zIndex: 49,
          background: "rgba(16,18,24,0.97)", backdropFilter: "blur(16px)",
          borderBottom: `1px solid ${THEME.border}`,
          flexDirection: "column", padding: "16px 24px", gap: "16px",
        }}>
          {[
            { label: "Demo", id: "demo" },
            { label: "How it works", id: "how-it-works" },
            { label: "Pricing", id: "pricing" },
          ].map(({ label, id }) => (
            <a key={id} onClick={() => { smoothScroll(id); setMobileMenuOpen(false); }} style={{
              color: THEME.textDim, fontSize: "14px", textDecoration: "none", cursor: "pointer",
            }}>{label}</a>
          ))}
          <a href={EXTENSION_URL} target="_blank" rel="noopener noreferrer" style={{
            color: THEME.textDim, fontSize: "14px", textDecoration: "none",
          }}>Chrome Extension</a>
          <Link href="/blog" onClick={() => setMobileMenuOpen(false)} style={{
            color: THEME.textDim, fontSize: "14px", textDecoration: "none",
          }}>Blog</Link>
        </div>
      )}

      {/* ── SECTION 1: HERO ── */}
      <section style={{
        padding: "150px 24px 72px",
        position: "relative",
        overflow: "hidden",
      }}>
        <div className="hero-grid" style={{
          maxWidth: "1140px", margin: "0 auto", width: "100%",
          display: "grid", gridTemplateColumns: "1.05fr 0.95fr",
          gap: "56px", alignItems: "center", position: "relative", zIndex: 1,
        }}>
          {/* Left column — message + single primary CTA */}
          <div>
            <div className="fade-in kicker" style={{ marginBottom: "22px" }}>
              AI Humanization · Now in Beta
            </div>

            <h1 className="fade-in hero-h1" style={{
              fontSize: "clamp(40px, 5.4vw, 66px)",
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
              margin: "0 0 22px",
              color: THEME.text,
              fontFamily: THEME.fontHeading,
            }}>
              Your AI text,<br />finally sounds{" "}
              <span style={{ color: THEME.human }} className="glow-human">human</span>
              <span className="caret" aria-hidden="true" />
            </h1>

            <p className="fade-in-delay" style={{
              fontSize: "18px",
              color: THEME.textDim,
              lineHeight: 1.65,
              margin: "0 0 32px",
              maxWidth: "480px",
            }}>
              Paste your ChatGPT text and get an undetectable, natural-sounding version in seconds.
            </p>

            {/* ONE dominant primary CTA */}
            <div className="fade-in-delay2" style={{ display: "flex", alignItems: "center", gap: "18px", flexWrap: "wrap", marginBottom: "22px" }}>
              <SignedOut>
                <SignUpButton mode="modal">
                  <button style={{
                    background: THEME.brand, color: "#ffffff", fontWeight: 600,
                    padding: "15px 30px", borderRadius: THEME.radius,
                    border: "none", cursor: "pointer",
                    fontSize: "16px", display: "inline-flex", alignItems: "center", gap: "8px",
                    fontFamily: THEME.fontSans,
                    boxShadow: `0 0 24px ${THEME.brand}55`,
                  }}>
                    Humanize my text <ArrowRight size={17} aria-hidden="true" />
                  </button>
                </SignUpButton>
              </SignedOut>
              <SignedIn>
                <Link href="/dashboard/editor" style={{
                  background: THEME.brand, color: "#ffffff", fontWeight: 600,
                  padding: "15px 30px", borderRadius: THEME.radius, textDecoration: "none",
                  fontSize: "16px", display: "inline-flex", alignItems: "center", gap: "8px",
                  boxShadow: `0 0 24px ${THEME.brand}55`,
                }}>
                  Humanize my text <ArrowRight size={17} aria-hidden="true" />
                </Link>
              </SignedIn>

              {/* Secondary = quiet ghost link */}
              <button onClick={() => smoothScroll("demo")} style={{
                background: "transparent", color: THEME.textDim, fontWeight: 500,
                padding: "15px 4px", border: "none",
                fontSize: "15px", cursor: "pointer",
                fontFamily: THEME.fontSans,
                display: "inline-flex", alignItems: "center", gap: "6px",
              }}>
                Try the live demo <ArrowRight size={15} aria-hidden="true" />
              </button>
            </div>

            <div style={{
              display: "inline-flex", alignItems: "center", gap: "7px",
              fontFamily: THEME.fontMono, fontSize: "12px", letterSpacing: "0.04em",
              color: THEME.textDim,
            }}>
              <Check size={14} color={THEME.human} aria-hidden="true" />
              No credit card required
            </div>
          </div>

          {/* Right column — live demo terminal panel (the no-signup demo, beside the CTA) */}
          <div id="demo" aria-label="Live AI detection demo" className="fade-in-delay2" style={{ scrollMarginTop: "120px" }}>
            <DemoPanel
              text={text}
              wordCount={wordCount}
              analyzing={analyzing}
              canAnalyze={canAnalyze}
              onTextChange={handleTextChange}
              onAnalyze={handleAnalyze}
              mounted={mounted}
              result={result}
              aiScore={aiScore}
              human={human}
              humanColor={humanColor}
              topPatterns={topPatterns}
              onContinueSignedIn={() => persistAndGo("/dashboard/editor")}
            />
          </div>
        </div>
      </section>

      {/* ── BEFORE / AFTER SECTION ── */}
      <section style={{ padding: "72px 24px", borderTop: `1px solid ${THEME.border}` }}>
        <div style={{ maxWidth: "960px", margin: "0 auto" }}>
          <p style={sectionLabel}>Before / After</p>
          <h2 style={{ ...h2Style, marginBottom: "44px" }}>See the difference</h2>

          <div className="before-after-row" style={{
            display: "flex", gap: "0", flexWrap: "wrap",
            border: `1px solid ${THEME.border}`, borderRadius: THEME.radiusLg, overflow: "hidden",
            background: THEME.surface2,
          }}>
            {/* Before — AI detected */}
            <div style={{
              flex: "1 1 340px",
              padding: "32px",
              borderRight: `1px solid ${THEME.border}`,
            }}>
              <div style={{ marginBottom: "20px" }}>
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: "7px",
                  fontFamily: THEME.fontMono, fontSize: "12px", fontWeight: 500,
                  padding: "4px 12px", borderRadius: "6px",
                  background: THEME.aiDim, color: THEME.ai,
                  letterSpacing: "0.04em",
                }}>
                  <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: THEME.ai, display: "inline-block" }} />
                  13 / 100 HUMAN
                </span>
              </div>
              <p style={{ fontSize: "14px", color: THEME.textDim, lineHeight: 1.8, margin: 0 }}>
                In today&apos;s rapidly evolving digital landscape, businesses must leverage cutting-edge technologies to maintain a competitive advantage. Furthermore, the implementation of robust strategies is paramount to achieving sustainable growth and maximizing stakeholder value in an increasingly interconnected global marketplace.
              </p>
            </div>

            {/* Center arrow */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: "0 20px",
              borderRight: `1px solid ${THEME.border}`,
            }}>
              <div style={{
                width: "38px", height: "38px", borderRadius: "50%",
                background: THEME.brandDim,
                border: `1px solid ${THEME.borderStrong}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: THEME.brandHi, flexShrink: 0,
              }}>
                <ArrowRight size={16} aria-hidden="true" />
              </div>
            </div>

            {/* After — Human */}
            <div style={{
              flex: "1 1 340px",
              padding: "32px",
            }}>
              <div style={{ marginBottom: "20px" }}>
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: "7px",
                  fontFamily: THEME.fontMono, fontSize: "12px", fontWeight: 500,
                  padding: "4px 12px", borderRadius: "6px",
                  background: THEME.humanDim, color: THEME.human,
                  letterSpacing: "0.04em",
                }}>
                  <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: THEME.human, display: "inline-block" }} />
                  96 / 100 HUMAN
                </span>
              </div>
              <p style={{ fontSize: "14px", color: THEME.text, lineHeight: 1.8, margin: 0 }}>
                Most businesses know they need better tech — but few actually use it well. The ones that grow aren&apos;t just buying tools, they&apos;re rethinking how teams work together. It&apos;s less about &quot;digital transformation&quot; buzzwords and more about fixing the basics: clear communication, faster feedback loops, and actually listening to customers.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 3: HOW IT WORKS ── */}
      <section id="how-it-works" aria-label="How it works" style={{
        padding: "72px 24px",
        borderTop: `1px solid ${THEME.border}`,
        scrollMarginTop: "110px",
      }}>
        <div style={{ maxWidth: "960px", margin: "0 auto" }}>
          <p style={sectionLabel}>How it works</p>
          <h2 style={{ ...h2Style, marginBottom: "52px" }}>Everything you need to sound human</h2>

          <div className="three-col" style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "20px",
          }}>
            {[
              {
                Icon: ClipboardPaste,
                step: "01",
                title: "Paste",
                desc: "Any AI-generated text from ChatGPT, Claude, Gemini, or any other model.",
              },
              {
                Icon: ScanSearch,
                step: "02",
                title: "Analyze",
                desc: "See your human score and exactly which patterns were detected across 24 signals.",
              },
              {
                Icon: Sparkles,
                step: "03",
                title: "Humanize",
                desc: "One click rewrites your text to sound natural and pass every major detector.",
              },
            ].map(({ Icon, step, title, desc }) => (
              <div key={title} style={{
                background: THEME.surface2,
                border: `1px solid ${THEME.border}`,
                borderRadius: THEME.radiusLg,
                padding: "30px 26px",
                textAlign: "left",
                transition: "border-color 0.2s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = THEME.brand; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = THEME.border; }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
                  <div style={{
                    width: "46px", height: "46px", borderRadius: "12px",
                    background: THEME.brandDim, border: `1px solid ${THEME.borderStrong}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Icon size={22} color={THEME.brandHi} aria-hidden="true" />
                  </div>
                  <span style={{
                    fontFamily: THEME.fontMono, fontSize: "13px", color: THEME.textMuted,
                    letterSpacing: "0.06em",
                  }}>{step}</span>
                </div>
                <h3 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "10px", color: THEME.text, fontFamily: THEME.fontHeading }}>{title}</h3>
                <p style={{ fontSize: "14px", color: THEME.textDim, lineHeight: 1.65, margin: 0 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 4: CHROME EXTENSION CTA ── */}
      <section id="extension" style={{ padding: "72px 24px", borderTop: `1px solid ${THEME.border}`, scrollMarginTop: "110px" }}>
        <div style={{
          maxWidth: "960px", margin: "0 auto",
          background: THEME.surface2,
          border: `1px solid ${THEME.border}`,
          borderRadius: THEME.radiusXl,
          padding: "44px 40px",
        }}>
          <div className="extension-card-inner" style={{ display: "flex", alignItems: "center", gap: "40px" }}>
            <div style={{ flex: 1 }}>
              <div style={{
                width: "52px", height: "52px", borderRadius: "14px",
                background: THEME.brandDim, border: `1px solid ${THEME.borderStrong}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                marginBottom: "20px",
              }}>
                <Puzzle size={26} color={THEME.brandHi} aria-hidden="true" />
              </div>
              <h2 style={{
                fontSize: "clamp(22px, 3vw, 30px)",
                fontWeight: 700, letterSpacing: "-0.02em",
                marginBottom: "12px", color: THEME.text,
                fontFamily: THEME.fontHeading,
              }}>
                HumanizeIt is now a Chrome Extension
              </h2>
              <p style={{ fontSize: "15px", color: THEME.textDim, lineHeight: 1.7, marginBottom: "24px" }}>
                Analyze and humanize text directly in Gmail, Google Docs, LinkedIn, and Notion &mdash; without leaving the page.
              </p>
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "20px" }}>
                <a href={EXTENSION_URL} target="_blank" rel="noopener noreferrer" style={{
                  display: "inline-flex", alignItems: "center", gap: "7px",
                  background: THEME.brand, color: "#ffffff", fontWeight: 600,
                  padding: "12px 24px", borderRadius: THEME.radius,
                  fontSize: "14px", textDecoration: "none",
                }}>
                  Install Chrome Extension <ArrowRight size={15} aria-hidden="true" />
                </a>
                <a href={EXTENSION_URL} target="_blank" rel="noopener noreferrer" style={{
                  display: "inline-flex", alignItems: "center",
                  background: "transparent", color: THEME.textDim,
                  padding: "12px 24px", borderRadius: THEME.radius,
                  border: `1px solid ${THEME.border}`,
                  fontSize: "14px", textDecoration: "none", fontWeight: 500,
                }}>
                  Learn more
                </a>
              </div>
              <p style={{ fontFamily: THEME.fontMono, fontSize: "12px", color: THEME.textMuted, letterSpacing: "0.04em" }}>
                Works on: Gmail &middot; Google Docs &middot; LinkedIn &middot; Notion &middot; Substack &middot; WordPress
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 6: COMPARISON TABLE ── */}
      <section style={{
        padding: "72px 24px",
        borderTop: `1px solid ${THEME.border}`,
      }}>
        <div style={{ maxWidth: "720px", margin: "0 auto" }}>
          <p style={sectionLabel}>Comparison</p>
          <h2 style={{ ...h2Style, marginBottom: "44px" }}>Beats every AI detector</h2>

          <div style={{
            background: THEME.surface2,
            border: `1px solid ${THEME.border}`,
            borderRadius: THEME.radiusLg,
            overflow: "hidden",
          }}>
            <table className="comparison-table" style={{
              width: "100%", borderCollapse: "collapse",
              fontSize: "14px",
            }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${THEME.border}`, background: THEME.surface1 }}>
                  <th style={{ padding: "14px 16px", textAlign: "left", color: THEME.textMuted, fontWeight: 600, fontSize: "12px" }}></th>
                  <th style={{ padding: "14px 16px", textAlign: "center", color: THEME.brandHi, fontWeight: 700, fontSize: "13px", fontFamily: THEME.fontMono }}>HumanizeIt</th>
                  <th style={{ padding: "14px 16px", textAlign: "center", color: THEME.textDim, fontWeight: 600, fontSize: "13px", fontFamily: THEME.fontMono }}>QuillBot</th>
                  <th style={{ padding: "14px 16px", textAlign: "center", color: THEME.textDim, fontWeight: 600, fontSize: "13px", fontFamily: THEME.fontMono }}>Undetectable.ai</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row, i) => (
                  <tr key={row.label} style={{ borderBottom: i < COMPARISON.length - 1 ? `1px solid ${THEME.border}` : "none" }}>
                    <td style={{ padding: "12px 16px", color: THEME.text, fontWeight: 500 }}>{row.label}</td>
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
        padding: "72px 24px",
        borderTop: `1px solid ${THEME.border}`,
        scrollMarginTop: "110px",
      }}>
        <div style={{ maxWidth: "960px", margin: "0 auto" }}>
          <p style={sectionLabel}>Pricing</p>
          <h2 style={{ ...h2Style, marginBottom: "12px" }}>Start free. Upgrade when ready.</h2>

          {/* Billing toggle */}
          <div className="pricing-toggle-row" style={{
            display: "flex", justifyContent: "center", alignItems: "center",
            gap: "12px", marginTop: "28px", marginBottom: "44px",
          }}>
            <span style={{ fontFamily: THEME.fontMono, fontSize: "13px", color: !billingAnnual ? THEME.text : THEME.textMuted, fontWeight: 500 }}>Monthly</span>
            <button onClick={() => setBillingAnnual(!billingAnnual)} aria-label="Toggle annual billing" aria-pressed={billingAnnual} style={{
              width: "44px", height: "24px", borderRadius: "12px",
              background: billingAnnual ? THEME.brand : THEME.surface3,
              border: `1px solid ${THEME.border}`, cursor: "pointer", position: "relative",
              transition: "background 0.2s",
            }}>
              <div style={{
                width: "18px", height: "18px", borderRadius: "50%",
                background: "#ffffff",
                position: "absolute", top: "2px",
                left: billingAnnual ? "23px" : "3px",
                transition: "left 0.2s",
                boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
              }} />
            </button>
            <span style={{ fontFamily: THEME.fontMono, fontSize: "13px", color: billingAnnual ? THEME.text : THEME.textMuted, fontWeight: 500 }}>
              Annual
            </span>
            {billingAnnual && (
              <span style={{
                fontFamily: THEME.fontMono, fontSize: "11px", fontWeight: 600, color: THEME.human,
                background: THEME.humanDim,
                padding: "3px 8px", borderRadius: "100px",
              }}>
                Save 20%
              </span>
            )}
          </div>

          {/* Beta badge */}
          <div style={{ textAlign: "center", marginBottom: "28px" }}>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: "7px",
              fontFamily: THEME.fontMono, fontSize: "12px", fontWeight: 500,
              color: THEME.textDim,
              background: THEME.surface2,
              border: `1px solid ${THEME.border}`,
              padding: "5px 14px", borderRadius: "100px",
              letterSpacing: "0.04em",
            }}>
              <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: THEME.warn, display: "inline-block" }} />
              Currently in Beta — Paid plans coming soon
            </span>
          </div>

          <div className="three-col" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", alignItems: "stretch" }}>
            {plans.map((plan, i) => (
              <div key={plan.name} style={{
                background: THEME.surface2,
                border: plan.pro ? `1px solid ${THEME.brand}` : `1px solid ${THEME.border}`,
                borderRadius: THEME.radiusXl,
                padding: "32px 24px",
                position: "relative",
                boxShadow: plan.pro ? `0 0 28px ${THEME.brand}33` : "none",
                opacity: 0,
                animation: `fadeInUp 0.5s ease ${i * 0.1}s forwards`,
              }}>
                {plan.pro && (
                  <div style={{
                    position: "absolute", top: "-12px", left: "50%", transform: "translateX(-50%)",
                    background: THEME.brand, color: "#ffffff",
                    fontFamily: THEME.fontMono, fontSize: "11px", fontWeight: 600,
                    padding: "3px 14px", borderRadius: "100px",
                    whiteSpace: "nowrap", letterSpacing: "0.06em", textTransform: "uppercase",
                  }}>
                    Most Popular
                  </div>
                )}

                <div style={{ fontFamily: THEME.fontMono, fontSize: "12px", color: THEME.textMuted, marginBottom: "4px", letterSpacing: "0.04em" }}>{plan.desc}</div>
                <div style={{ fontSize: "16px", fontWeight: 700, color: THEME.text, marginBottom: "16px", fontFamily: THEME.fontHeading }}>{plan.name}</div>

                <div style={{ display: "flex", alignItems: "baseline", gap: "3px", marginBottom: "20px" }}>
                  <span style={{ fontFamily: THEME.fontMono, fontSize: "40px", fontWeight: 600, color: THEME.text, letterSpacing: "-0.02em" }}>{plan.price}</span>
                  <span style={{ fontFamily: THEME.fontMono, fontSize: "13px", color: THEME.textMuted }}>{plan.period}</span>
                </div>

                <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px", display: "flex", flexDirection: "column", gap: "10px" }}>
                  {plan.features.map((f) => (
                    <li key={f} style={{ display: "flex", alignItems: "center", gap: "9px", fontSize: "13px", color: THEME.textDim }}>
                      <Check size={14} color={plan.pro ? THEME.human : THEME.brandHi} style={{ flexShrink: 0 }} aria-hidden="true" />
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
                          padding: "11px", borderRadius: THEME.radius,
                          fontSize: "13px", fontWeight: 600,
                          background: "transparent",
                          color: THEME.text,
                          border: `1px solid ${THEME.borderStrong}`,
                          cursor: "pointer",
                          fontFamily: THEME.fontSans,
                        }}>
                          {plan.cta}
                        </button>
                      </SignUpButton>
                    </SignedOut>
                    <SignedIn>
                      <Link href="/dashboard/editor" style={{
                        display: "block", textAlign: "center", textDecoration: "none",
                        padding: "11px", borderRadius: THEME.radius,
                        fontSize: "13px", fontWeight: 600,
                        background: "transparent",
                        color: THEME.text,
                        border: `1px solid ${THEME.borderStrong}`,
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
        borderTop: `1px solid ${THEME.border}`,
        textAlign: "center",
      }}>
        <div style={{ maxWidth: "600px", margin: "0 auto" }}>
          <div style={{
            width: "52px", height: "52px", borderRadius: "14px",
            background: THEME.brandDim, border: `1px solid ${THEME.borderStrong}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 20px",
          }}>
            <Smartphone size={26} color={THEME.brandHi} aria-hidden="true" />
          </div>
          <h2 style={{
            fontSize: "clamp(22px, 3vw, 30px)",
            fontWeight: 700, letterSpacing: "-0.02em",
            marginBottom: "12px", color: THEME.text,
            fontFamily: THEME.fontHeading,
          }}>
            Use it anywhere you write
          </h2>
          <p style={{ fontSize: "15px", color: THEME.textDim, lineHeight: 1.7, marginBottom: "24px" }}>
            The HumanizeIt extension works in any text field on any website.
          </p>
          <div style={{
            display: "inline-flex", gap: "10px", flexWrap: "wrap", justifyContent: "center",
          }}>
            {["Gmail", "Google Docs", "LinkedIn", "Notion", "Substack", "WordPress"].map((app) => (
              <span key={app} style={{
                fontFamily: THEME.fontMono, fontSize: "13px", color: THEME.textDim,
                background: THEME.surface2,
                border: `1px solid ${THEME.border}`,
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
        padding: "72px 24px",
        borderTop: `1px solid ${THEME.border}`,
        scrollMarginTop: "110px",
      }}>
        <div style={{ maxWidth: "720px", margin: "0 auto" }}>
          <p style={sectionLabel}>FAQ</p>
          <h2 style={{ ...h2Style, marginBottom: "44px" }}>Everything You Need to Know</h2>

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
                background: THEME.surface2,
                border: `1px solid ${openFaq === i ? THEME.brand : THEME.border}`,
                borderRadius: THEME.radiusLg,
                overflow: "hidden",
                transition: "border-color 0.3s",
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
                    fontSize: "15px", fontWeight: 600, color: THEME.text,
                    lineHeight: 1.4, paddingRight: "16px", fontFamily: THEME.fontHeading,
                  }}>
                    {item.q}
                  </span>
                  <span
                    className="faq-chevron"
                    data-open={openFaq === i ? "true" : "false"}
                    style={{ color: THEME.brandHi, flexShrink: 0, lineHeight: 0 }}
                    aria-hidden="true"
                  >
                    <ChevronDown size={18} />
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
                    color: THEME.textDim,
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
        padding: "72px 24px",
        borderTop: `1px solid ${THEME.border}`,
      }}>
        <div style={{
          maxWidth: "720px", margin: "0 auto",
          background: THEME.surface2,
          border: `1px solid ${THEME.border}`,
          borderRadius: THEME.radiusXl,
          padding: "52px 40px",
          textAlign: "center",
          boxShadow: `0 0 40px ${THEME.brand}22`,
        }}>
          <p className="kicker" style={{ display: "inline-block", marginBottom: "16px" }}>Ready when you are</p>
          <h2 style={{
            fontSize: "clamp(26px, 4vw, 40px)",
            fontWeight: 700, letterSpacing: "-0.02em",
            lineHeight: 1.1, marginBottom: "14px", color: THEME.text,
            fontFamily: THEME.fontHeading,
          }}>
            Ready to make your writing sound human?
          </h2>
          <p style={{ fontSize: "15px", color: THEME.textDim, marginBottom: "32px" }}>
            Start free &mdash; 500 words/day, no credit card required.
          </p>
          <div className="two-cta-row" style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "18px", flexWrap: "wrap" }}>
            <SignedOut>
              <SignUpButton mode="modal">
                <button style={{
                  background: THEME.brand, color: "#ffffff", fontWeight: 600,
                  padding: "15px 30px", borderRadius: THEME.radius, border: "none",
                  fontSize: "16px", cursor: "pointer",
                  fontFamily: THEME.fontSans,
                  display: "inline-flex", alignItems: "center", gap: "8px",
                  boxShadow: `0 0 24px ${THEME.brand}55`,
                }}>
                  Humanize my text <ArrowRight size={17} aria-hidden="true" />
                </button>
              </SignUpButton>
            </SignedOut>
            <SignedIn>
              <Link href="/dashboard/editor" style={{
                background: THEME.brand, color: "#ffffff", fontWeight: 600,
                padding: "15px 30px", borderRadius: THEME.radius, textDecoration: "none",
                fontSize: "16px",
                display: "inline-flex", alignItems: "center", gap: "8px",
                boxShadow: `0 0 24px ${THEME.brand}55`,
              }}>
                Open Dashboard <ArrowRight size={17} aria-hidden="true" />
              </Link>
            </SignedIn>
            <a href={EXTENSION_URL} target="_blank" rel="noopener noreferrer" style={{
              display: "inline-flex", alignItems: "center",
              background: "transparent", color: THEME.textDim, fontWeight: 500,
              padding: "15px 4px",
              fontSize: "15px", textDecoration: "none",
            }}>
              Install Chrome Extension
            </a>
          </div>
        </div>
      </section>

      {/* ── SECTION 10: FOOTER ── */}
      <footer style={{
        background: THEME.surface1,
        borderTop: `1px solid ${THEME.border}`,
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
                  color: THEME.text,
                  fontFamily: THEME.fontHeading, letterSpacing: "-0.02em",
                }}>
                  Humanize<span style={{ color: THEME.brand }}>It</span>
                </span>
              </div>
              <p style={{ fontSize: "14px", color: THEME.textDim, lineHeight: 1.7, maxWidth: "240px", margin: 0 }}>
                The AI humanizer that actually works. Make your AI text undetectable in seconds.
              </p>
            </div>

            {/* Col 2: Product */}
            <div>
              <div style={{ fontFamily: THEME.fontMono, fontSize: "12px", fontWeight: 600, color: THEME.textMuted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "16px" }}>
                Product
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {[
                  { label: "Dashboard", href: "/dashboard/editor" },
                  { label: "Chrome Extension", href: EXTENSION_URL },
                  { label: "Pricing", href: "#pricing" },
                  { label: "Lifetime Deal", href: "/lifetime" },
                ].map(({ label, href }) => (
                  <a key={label} href={href} style={{ fontSize: "14px", color: THEME.textDim, textDecoration: "none" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = THEME.text; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = THEME.textDim; }}
                  >
                    {label}
                  </a>
                ))}
              </div>
            </div>

            {/* Col 3: Resources */}
            <div>
              <div style={{ fontFamily: THEME.fontMono, fontSize: "12px", fontWeight: 600, color: THEME.textMuted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "16px" }}>
                Resources
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {[
                  { label: "Blog", href: "/blog" },
                  { label: "How it works", href: "#how-it-works" },
                  { label: "Compare", href: "#" },
                  { label: "Sign up", href: "/sign-up" },
                ].map(({ label, href }) => (
                  <a key={label} href={href} style={{ fontSize: "14px", color: THEME.textDim, textDecoration: "none" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = THEME.text; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = THEME.textDim; }}
                  >
                    {label}
                  </a>
                ))}
              </div>
            </div>

            {/* Col 4: Legal */}
            <div>
              <div style={{ fontFamily: THEME.fontMono, fontSize: "12px", fontWeight: 600, color: THEME.textMuted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "16px" }}>
                Legal
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {[
                  { label: "Privacy Policy", href: "/privacy" },
                  { label: "Terms of Service", href: "/terms" },
                  { label: "Cookie Policy", href: "/cookies" },
                  { label: "Refund Policy", href: "/refunds" },
                ].map(({ label, href }) => (
                  <a key={label} href={href} style={{ fontSize: "14px", color: THEME.textDim, textDecoration: "none" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = THEME.text; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = THEME.textDim; }}
                  >
                    {label}
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="footer-bottom" style={{
            borderTop: `1px solid ${THEME.border}`,
            padding: "20px 0",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            gap: "16px",
          }}>
            <p style={{ fontFamily: THEME.fontMono, fontSize: "13px", color: THEME.textMuted, margin: 0 }}>
              &copy; 2026 HumanizeIt. All rights reserved.
            </p>
            <p style={{ fontSize: "13px", color: THEME.textMuted, margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
              Built by{" "}
              <a
                href="https://www.linkedin.com/in/boubakerjouini/"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: THEME.textDim, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "5px" }}
                onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = THEME.text; }}
                onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = THEME.textDim; }}
              >
                Boubaker Jouini
                <Linkedin size={14} aria-hidden="true" />
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

// ============================================================
// Live demo terminal panel — paste → analyze → animated HUMAN
// score reveal with detector signals lighting up. Exactly ONE
// next step routes to signup / dashboard.
// ============================================================
interface DemoPanelProps {
  text: string;
  wordCount: number;
  analyzing: boolean;
  canAnalyze: boolean;
  onTextChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onAnalyze: () => void;
  mounted: boolean;
  result: ReturnType<typeof analyzeText> | null;
  aiScore: number;
  human: number;
  humanColor: string;
  topPatterns: ReturnType<typeof analyzeText>["patterns"];
  onContinueSignedIn: () => void;
}

function severityColor(severity: string): string {
  if (severity === "critical" || severity === "high") return THEME.ai;
  if (severity === "medium") return THEME.warn;
  return THEME.textDim;
}

function DemoPanel({
  text, wordCount, analyzing, canAnalyze, onTextChange, onAnalyze,
  mounted, result, aiScore, human, humanColor, topPatterns, onContinueSignedIn,
}: DemoPanelProps) {
  return (
    <div style={{
      background: THEME.surface1,
      border: `1px solid ${result ? humanColor + "55" : THEME.border}`,
      borderRadius: THEME.radiusLg,
      overflow: "hidden",
      transition: "border-color 0.3s",
      boxShadow: `0 0 40px ${THEME.brand}1f`,
    }}>
      {/* Terminal header */}
      <div style={{
        padding: "10px 16px",
        borderBottom: `1px solid ${THEME.border}`,
        display: "flex", alignItems: "center", gap: "8px",
        background: THEME.surface2,
      }}>
        <div style={{ width: "9px", height: "9px", borderRadius: "50%", background: THEME.ai }} aria-hidden="true" />
        <div style={{ width: "9px", height: "9px", borderRadius: "50%", background: THEME.warn }} aria-hidden="true" />
        <div style={{ width: "9px", height: "9px", borderRadius: "50%", background: THEME.human }} aria-hidden="true" />
        <span style={{ fontFamily: THEME.fontMono, fontSize: "12px", color: THEME.textDim, marginLeft: "8px", letterSpacing: "0.04em" }}>
          analyzeText()
        </span>
        <span className="kicker" style={{ marginLeft: "auto", fontSize: "11px" }}>NO SIGNUP</span>
      </div>

      <textarea
        value={text}
        onChange={onTextChange}
        aria-label="Paste AI-generated text to analyze its human score"
        placeholder={"Paste your AI-generated text here…\n\ne.g. \"In today's rapidly evolving landscape, it is important to note that the paradigm has shifted fundamentally, offering unprecedented opportunities for holistic transformation…\""}
        style={{
          width: "100%",
          height: "180px",
          background: "transparent",
          border: "none",
          outline: "none",
          resize: "none",
          color: THEME.text,
          fontSize: "14px",
          lineHeight: 1.8,
          fontFamily: THEME.fontMono,
          padding: "16px",
          boxSizing: "border-box",
        }}
      />

      {/* Bottom toolbar */}
      <div style={{
        padding: "10px 16px",
        borderTop: `1px solid ${THEME.border}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: THEME.surface2,
      }}>
        <span style={{ fontFamily: THEME.fontMono, fontSize: "12px", color: THEME.textMuted, fontVariantNumeric: "tabular-nums" }}>
          {wordCount} word{wordCount !== 1 ? "s" : ""}
        </span>
        <button
          onClick={onAnalyze}
          disabled={!canAnalyze}
          style={{
            background: canAnalyze ? THEME.brand : THEME.surface3,
            color: canAnalyze ? "#ffffff" : THEME.textMuted,
            fontSize: "13px", fontWeight: 600,
            padding: "8px 20px", borderRadius: "8px",
            border: "none", cursor: canAnalyze ? "pointer" : "not-allowed",
            display: "inline-flex", alignItems: "center", gap: "7px",
            transition: "all 0.15s",
            fontFamily: THEME.fontSans,
          }}
        >
          {analyzing
            ? <><Loader2 size={13} className="animate-spin" aria-hidden="true" /> Analyzing&hellip;</>
            : <>Analyze for free <ArrowRight size={14} aria-hidden="true" /></>
          }
        </button>
      </div>

      {/* ── RESULTS ── */}
      <div aria-live="polite">
        {mounted && result && (
          <div style={{
            borderTop: `1px solid ${THEME.border}`,
            padding: "22px 18px",
            background: THEME.surface2,
            animation: "fadeInUp 0.4s ease",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "20px", flexWrap: "wrap" }}>
              {/* Shared canonical score ring (animates the HUMAN reveal) */}
              <ScoreRing score={aiScore} size={120} hideLabel />

              {/* Detector signals lighting up */}
              <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                <div style={{
                  fontFamily: THEME.fontMono, fontSize: "11px", color: THEME.textMuted,
                  letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "10px",
                }}>
                  Detector signals
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                  {topPatterns.length > 0 ? topPatterns.map((p, idx) => (
                    <div key={p.id} className="signal-row" style={{
                      display: "flex", alignItems: "center", gap: "9px",
                      fontFamily: THEME.fontMono, fontSize: "12px", color: THEME.textDim,
                      animationDelay: `${0.1 + idx * 0.08}s`,
                    }}>
                      <span className="pulse-dot" style={{
                        width: "8px", height: "8px", borderRadius: "50%",
                        background: severityColor(p.severity), flexShrink: 0,
                        boxShadow: `0 0 8px ${severityColor(p.severity)}99`,
                      }} aria-hidden="true" />
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.label}</span>
                      <span style={{
                        marginLeft: "auto", flexShrink: 0,
                        color: severityColor(p.severity), letterSpacing: "0.06em",
                        textTransform: "uppercase", fontSize: "10px",
                      }}>{p.severity}</span>
                    </div>
                  )) : (
                    <div style={{
                      display: "flex", alignItems: "center", gap: "9px",
                      fontFamily: THEME.fontMono, fontSize: "12px", color: THEME.human,
                    }}>
                      <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: THEME.human, boxShadow: `0 0 8px ${THEME.human}99` }} aria-hidden="true" />
                      No strong AI patterns detected
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Verdict line — color paired with text label */}
            <div style={{
              marginTop: "16px",
              fontFamily: THEME.fontMono, fontSize: "12px",
              color: humanColor, letterSpacing: "0.04em",
            }}>
              {humanScoreLabel(human)} — {human} / 100 human
            </div>

            {/* Exactly ONE next step */}
            <div style={{ marginTop: "16px" }}>
              <SignedOut>
                <SignUpButton mode="modal">
                  <button style={{
                    display: "flex", width: "100%", textAlign: "center",
                    alignItems: "center", justifyContent: "center", gap: "8px",
                    padding: "13px",
                    background: THEME.brand,
                    color: "#ffffff", borderRadius: THEME.radius, border: "none",
                    fontSize: "14px", fontWeight: 600, cursor: "pointer",
                    fontFamily: THEME.fontSans,
                    boxShadow: `0 0 22px ${THEME.brand}55`,
                  }}>
                    Humanize it free <ArrowRight size={15} aria-hidden="true" />
                  </button>
                </SignUpButton>
              </SignedOut>
              <SignedIn>
                <button
                  onClick={onContinueSignedIn}
                  style={{
                    display: "flex", width: "100%", textAlign: "center",
                    alignItems: "center", justifyContent: "center", gap: "8px",
                    padding: "13px",
                    background: THEME.brand,
                    color: "#ffffff", borderRadius: THEME.radius, border: "none",
                    fontSize: "14px", fontWeight: 600, cursor: "pointer",
                    fontFamily: THEME.fontSans,
                    boxShadow: `0 0 22px ${THEME.brand}55`,
                  }}
                >
                  Humanize it free <ArrowRight size={15} aria-hidden="true" />
                </button>
              </SignedIn>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
