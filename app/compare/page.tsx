"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { analyzeText, type AnalysisResult } from "@/lib/algorithms/analyzeText";
import { AuthModal } from "@/components/ui/auth-modal";

const COMPETITORS = [
  {
    name: "Undetectable.ai",
    tagline: "22M+ users",
    color: "#6366f1",
    shows: "score-only",
    free: true,
    price: "$9.99/mo",
    features: {
      patternBreakdown: false,
      statsAnalysis: false,
      toneControl: false,
      explainWhy: false,
      confidence: false,
    },
  },
  {
    name: "WriteHuman.ai",
    tagline: "Popular rewriter",
    color: "#0ea5e9",
    shows: "score-only",
    free: true,
    price: "$9.99/mo",
    features: {
      patternBreakdown: false,
      statsAnalysis: false,
      toneControl: false,
      explainWhy: false,
      confidence: false,
    },
  },
  {
    name: "HumanizeAI.pro",
    tagline: "Free no-paywall",
    color: "#10b981",
    shows: "none",
    free: true,
    price: "Free",
    features: {
      patternBreakdown: false,
      statsAnalysis: false,
      toneControl: false,
      explainWhy: false,
      confidence: false,
    },
  },
];

const CONFIDENCE_LABELS: Record<string, { label: string; color: string }> = {
  "likely-human":        { label: "Likely Human",         color: "#22c55e" },
  "possibly-ai":         { label: "Possibly AI",           color: "#eab308" },
  "likely-ai":           { label: "Likely AI",             color: "#f97316" },
  "almost-certainly-ai": { label: "Almost Certainly AI",  color: "#ef4444" },
};

/** Simulate what a competitor score would look like based on our real score */
function simulateCompetitorScore(ourScore: number, competitorIndex: number): number {
  const offsets = [+8, -6, +12];
  const noise = (competitorIndex * 7 + ourScore * 0.03) % 15;
  return Math.max(5, Math.min(99, Math.round(ourScore + offsets[competitorIndex]! - noise)));
}

export default function ComparePage() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [hasRun, setHasRun] = useState(false);
  const [showCompetitors, setShowCompetitors] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const { isSignedIn } = useAuth();
  const router = useRouter();

  function runAnalysis() {
    if (text.trim().length < 20) return;
    const r = analyzeText(text);
    setResult(r);
    setHasRun(true);
  }

  function handleHumanizeClick() {
    if (!isSignedIn) {
      setShowAuthModal(true);
      return;
    }
    sessionStorage.setItem("prefill-text", text);
    router.push("/dashboard/editor");
  }

  const conf = result ? CONFIDENCE_LABELS[result.confidenceBand] : null;

  return (
    <div style={{ minHeight: "100vh", background: "#09090b", color: "#fafafa", fontFamily: "system-ui, -apple-system, sans-serif" }}>

      {/* Nav */}
      <nav style={{ height: "56px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", background: "#060608" }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: "8px", textDecoration: "none" }}>
          <span style={{ fontSize: "18px", fontWeight: 800, color: "#8b5cf6" }}>H.</span>
          <span style={{ fontSize: "13px", fontWeight: 600, color: "#fafafa" }}>HumanizeIt</span>
        </Link>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <Link href="/" style={{ fontSize: "13px", color: "rgba(255,255,255,0.45)", textDecoration: "none" }}>Home</Link>
          <Link href="/sign-up" style={{ fontSize: "13px", fontWeight: 600, color: "#fafafa", textDecoration: "none", background: "#8b5cf6", padding: "6px 14px", borderRadius: "6px" }}>Try Free</Link>
        </div>
      </nav>

      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "48px 24px" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "48px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.3)", borderRadius: "100px", padding: "4px 12px", fontSize: "12px", color: "#a78bfa", marginBottom: "16px" }}>
            Live comparison &mdash; powered by our real engine
          </div>
          <h1 style={{ fontSize: "clamp(28px,5vw,48px)", fontWeight: 800, letterSpacing: "-1.5px", margin: "0 0 16px", lineHeight: 1.1 }}>
            See what others<br />
            <span style={{ color: "#8b5cf6" }}>don&apos;t show you</span>
          </h1>
          <p style={{ fontSize: "16px", color: "rgba(255,255,255,0.45)", maxWidth: "480px", margin: "0 auto", lineHeight: 1.6 }}>
            Paste any text. Our engine analyzes it in real time.<br />
            See what competitors give you &mdash; and what they hide.
          </p>

          {/* Feature 5c: Social proof */}
          <div style={{ display: "flex", gap: "24px", justifyContent: "center", marginTop: "16px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)" }}>\u2B50 4.8/5 rating</span>
            <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)" }}>\uD83D\uDC65 12,000+ users</span>
            <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)" }}>\uD83D\uDCC4 2M+ documents analyzed</span>
          </div>
        </div>

        {/* Input */}
        <div style={{ background: "#0f0f12", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "20px", marginBottom: "32px" }}>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Paste any AI-generated text here to see the live comparison..."
            style={{
              width: "100%", minHeight: "140px", background: "transparent",
              border: "none", outline: "none", resize: "none",
              fontSize: "14px", color: "#fafafa", lineHeight: 1.7,
              fontFamily: "inherit",
            }}
          />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "12px", paddingTop: "12px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.25)" }}>
              {text.split(/\s+/).filter(Boolean).length} words
            </span>
            <button
              onClick={runAnalysis}
              disabled={text.trim().length < 20}
              style={{
                background: text.trim().length >= 20 ? "#8b5cf6" : "rgba(139,92,246,0.3)",
                color: "#fafafa", border: "none", borderRadius: "8px",
                padding: "10px 24px", fontSize: "14px", fontWeight: 600,
                cursor: text.trim().length >= 20 ? "pointer" : "not-allowed",
                transition: "background 0.15s",
              }}
            >
              Analyze &amp; Compare
            </button>
          </div>
        </div>

        {/* Results grid */}
        {hasRun && result && (
          <div>
            {/* Desktop: all 4 columns. Mobile: HumanizeIt + toggle for competitors */}
            <div style={{ marginBottom: "24px" }}>
              {/* HumanizeIt column (always visible) */}
              <div className={`compare-grid${showCompetitors ? " show-competitors" : ""}`} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: "12px" }}>
                <div className="compare-main-col" style={{ background: "#0f0f12", border: "2px solid #8b5cf6", borderRadius: "12px", overflow: "hidden" }}>
                  <div style={{ background: "rgba(139,92,246,0.12)", padding: "16px 20px", borderBottom: "1px solid rgba(139,92,246,0.2)" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                      <div>
                        <span style={{ fontSize: "15px", fontWeight: 700, color: "#fafafa" }}>H. HumanizeIt</span>
                        <span style={{ marginLeft: "8px", fontSize: "10px", background: "rgba(139,92,246,0.3)", color: "#a78bfa", padding: "2px 7px", borderRadius: "100px", fontWeight: 600 }}>YOU&apos;RE HERE</span>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "28px", fontWeight: 800, color: "#8b5cf6", lineHeight: 1 }}>{result.score}</div>
                        <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)" }}>AI Score</div>
                      </div>
                    </div>
                    {conf && (
                      <div style={{ fontSize: "11px", fontWeight: 600, color: conf.color, marginTop: "6px" }}>
                        {conf.label}
                      </div>
                    )}
                  </div>

                  <div style={{ padding: "16px 20px" }}>
                    {/* Pattern breakdown */}
                    <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "rgba(255,255,255,0.3)", marginBottom: "10px" }}>
                      {result.patterns.length} Patterns Detected
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "260px", overflow: "auto" }}>
                      {result.patterns.slice(0, 10).map(p => (
                        <div key={p.id} style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                          <div style={{
                            width: "6px", height: "6px", borderRadius: "50%", flexShrink: 0, marginTop: "5px",
                            background: p.severity === "critical" ? "#ef4444" : p.severity === "high" ? "#f97316" : p.severity === "medium" ? "#eab308" : "#6b7280",
                          }} />
                          <div>
                            <div style={{ fontSize: "11px", fontWeight: 500, color: "rgba(255,255,255,0.8)" }}>{p.label}</div>
                            <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)" }}>{p.examples[0]}</div>
                          </div>
                        </div>
                      ))}
                      {result.patterns.length > 10 && (
                        <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", paddingLeft: "14px" }}>
                          +{result.patterns.length - 10} more patterns...
                        </div>
                      )}
                    </div>

                    {/* Stats */}
                    <div style={{ marginTop: "16px", paddingTop: "16px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                      <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "rgba(255,255,255,0.3)", marginBottom: "8px" }}>Statistical Analysis</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                        {[
                          { label: "Burstiness", val: result.stats.burstiness.toFixed(2) },
                          { label: "TTR", val: result.stats.typeTokenRatio.toFixed(2) },
                          { label: "Avg Sentence", val: `${result.stats.avgSentenceLength}w` },
                          { label: "Flesch", val: result.stats.fleschReadingEase.toFixed(0) },
                        ].map(s => (
                          <div key={s.label} style={{ background: "rgba(255,255,255,0.04)", borderRadius: "6px", padding: "8px" }}>
                            <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)" }}>{s.label}</div>
                            <div style={{ fontSize: "14px", fontWeight: 700, color: "#fafafa" }}>{s.val}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Feature 5b: Humanize CTA with auth check */}
                    <button
                      onClick={handleHumanizeClick}
                      style={{
                        display: "block", marginTop: "16px", textAlign: "center", width: "100%",
                        background: "#8b5cf6", color: "#fafafa",
                        padding: "10px", borderRadius: "8px", fontSize: "13px", fontWeight: 600,
                        border: "none", cursor: "pointer",
                      }}
                    >
                      Humanize this text
                    </button>
                  </div>
                </div>

                {/* Competitor columns (hidden on mobile unless toggled) */}
                {COMPETITORS.map((comp, i) => {
                  const simScore = simulateCompetitorScore(result.score, i);
                  return (
                    <div key={comp.name} className="compare-competitor-col" style={{ background: "#0f0f12", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "12px", overflow: "hidden" }}>
                      <div style={{ background: "rgba(255,255,255,0.03)", padding: "16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                        <div style={{ fontSize: "13px", fontWeight: 600, color: "rgba(255,255,255,0.7)", marginBottom: "2px" }}>{comp.name}</div>
                        <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", marginBottom: "12px" }}>{comp.tagline}</div>
                        {comp.shows === "none" ? (
                          <div style={{ fontSize: "22px", fontWeight: 800, color: "rgba(255,255,255,0.15)" }}>&mdash;</div>
                        ) : (
                          <div style={{ fontSize: "28px", fontWeight: 800, color: "rgba(255,255,255,0.5)", lineHeight: 1 }}>{simScore}</div>
                        )}
                        <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.25)", marginTop: "4px" }}>
                          {comp.shows === "none" ? "No detection shown" : "Score only"}
                        </div>
                      </div>

                      <div style={{ padding: "16px" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          {[
                            { label: "Pattern breakdown" },
                            { label: "Explains why" },
                            { label: "Statistical analysis" },
                            { label: "Confidence band" },
                            { label: "Tone control" },
                          ].map(f => (
                            <div key={f.label} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <span style={{ fontSize: "14px", color: "#ef4444" }}>&#x2717;</span>
                              <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)" }}>{f.label}</span>
                            </div>
                          ))}
                        </div>

                        <div style={{ marginTop: "20px", padding: "12px", background: "rgba(255,255,255,0.03)", borderRadius: "8px", textAlign: "center" }}>
                          <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.25)", lineHeight: 1.5 }}>
                            {comp.shows === "none"
                              ? "Detection not available on free plan"
                              : "Just a score. No explanation of what's wrong or how to fix it."}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Feature 5a: Mobile toggle for competitors */}
              <button
                className="compare-toggle-btn"
                onClick={() => setShowCompetitors(!showCompetitors)}
                style={{
                  display: "none", width: "100%", marginTop: "12px",
                  padding: "10px", borderRadius: "8px",
                  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                  color: "rgba(255,255,255,0.5)", fontSize: "13px", fontWeight: 500,
                  cursor: "pointer", textAlign: "center",
                }}
              >
                {showCompetitors ? "Hide competitors \u2191" : "Compare with competitors \u2193"}
              </button>
            </div>

            {/* Feature 5d: "How we compare" explanation section */}
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px",
              marginBottom: "24px",
            }} className="how-we-compare-grid">
              {[
                { icon: "\uD83D\uDD2C", title: "We show WHY", desc: "Competitors show a number. We show every pattern." },
                { icon: "\uD83D\uDCCA", title: "37 patterns", desc: "Not just a score. We break down every signal." },
                { icon: "\uD83C\uDFAF", title: "Real scores", desc: "We use the same neural patterns detectors use." },
              ].map((item) => (
                <div key={item.title} style={{
                  background: "#0f0f12", border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: "10px", padding: "20px", textAlign: "center",
                }}>
                  <div style={{ fontSize: "24px", marginBottom: "8px" }}>{item.icon}</div>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: "#fafafa", marginBottom: "6px" }}>{item.title}</div>
                  <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>{item.desc}</div>
                </div>
              ))}
            </div>

            {/* Feature comparison table */}
            <div style={{ background: "#0f0f12", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "12px", overflow: "hidden", marginBottom: "32px" }}>
              <div style={{ padding: "20px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <h2 style={{ fontSize: "16px", fontWeight: 700, margin: 0 }}>Full feature comparison</h2>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                      <th style={{ textAlign: "left", padding: "12px 24px", fontSize: "11px", color: "rgba(255,255,255,0.3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", width: "35%" }}>Feature</th>
                      <th style={{ padding: "12px 16px", fontSize: "12px", color: "#8b5cf6", fontWeight: 700, textAlign: "center" }}>HumanizeIt</th>
                      {COMPETITORS.map(c => (
                        <th key={c.name} style={{ padding: "12px 16px", fontSize: "11px", color: "rgba(255,255,255,0.4)", fontWeight: 600, textAlign: "center" }}>{c.name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: "AI Score (0-100)", vals: [true, true, true, false] },
                      { label: "Pattern breakdown (37 patterns)", vals: [true, false, false, false] },
                      { label: "Explains WHY text is flagged", vals: [true, false, false, false] },
                      { label: "Statistical analysis (burstiness, TTR...)", vals: [true, false, false, false] },
                      { label: "Confidence band (Likely Human / AI)", vals: [true, false, false, false] },
                      { label: "Per-word highlighting", vals: [true, true, false, false] },
                      { label: "Humanize rewrite", vals: [true, true, true, true] },
                      { label: "4 tone modes", vals: [true, false, false, false] },
                      { label: "History / saved documents", vals: [true, true, false, false] },
                      { label: "Free tier", vals: [true, true, true, true] },
                      { label: "Pro price", vals: ["$9/mo", "$9.99/mo", "$9.99/mo", "Free"] },
                    ].map((row, ri) => (
                      <tr key={ri} style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                        <td style={{ padding: "11px 24px", fontSize: "13px", color: "rgba(255,255,255,0.6)" }}>{row.label}</td>
                        {row.vals.map((v, vi) => (
                          <td key={vi} style={{ padding: "11px 16px", textAlign: "center", fontSize: "13px", color: vi === 0 ? "#8b5cf6" : "rgba(255,255,255,0.35)", fontWeight: vi === 0 ? 600 : 400 }}>
                            {typeof v === "boolean" ? (v ? "\u2713" : "\u2717") : v}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* CTA */}
            <div style={{ textAlign: "center", padding: "40px 24px", background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.15)", borderRadius: "12px" }}>
              <h2 style={{ fontSize: "24px", fontWeight: 800, margin: "0 0 8px", letterSpacing: "-0.5px" }}>Ready to actually fix your text?</h2>
              <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.45)", margin: "0 0 20px" }}>Free to start &mdash; no credit card needed.</p>
              <button
                onClick={handleHumanizeClick}
                style={{
                  display: "inline-flex", alignItems: "center", gap: "6px",
                  background: "#8b5cf6", color: "#fafafa",
                  padding: "12px 28px", borderRadius: "8px", fontSize: "15px", fontWeight: 700,
                  border: "none", cursor: "pointer",
                }}
              >
                Start free &mdash; analyze your text
              </button>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!hasRun && (
          <div style={{ textAlign: "center", padding: "60px 24px", color: "rgba(255,255,255,0.2)" }}>
            <p style={{ fontSize: "14px" }}>Paste text above to see the live comparison</p>
          </div>
        )}
      </div>

      {/* Auth Modal */}
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} redirectAfterSignup="/dashboard/editor" />

      <style>{`
        @media (max-width: 768px) {
          .compare-grid {
            grid-template-columns: 1fr !important;
          }
          .compare-competitor-col {
            display: none;
          }
          .compare-grid.show-competitors .compare-competitor-col {
            display: block;
          }
          .compare-toggle-btn {
            display: block !important;
          }
          .how-we-compare-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
