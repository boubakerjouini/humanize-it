"use client";

import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { Loader2, Copy } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { ScoreRing } from "@/components/ui/score-ring";
import { PatternCard } from "@/components/ui/pattern-card";
import { AuthModal } from "@/components/ui/auth-modal";
import { UpgradeModal } from "@/components/ui/upgrade-modal";
import type { AnalysisResult, PatternHit, ConfidenceBand } from "@/lib/algorithms/analyzeText";

// ── Types ──────────────────────────────────────────────────────────────────

interface AnalyzeResponse {
  score: number;
  patterns: PatternHit[];
  stats: AnalysisResult["stats"];
  wordCount: number;
  documentId: string;
  confidenceBand: ConfidenceBand;
}

type ToneOption = "standard" | "formal" | "casual" | "academic";

const TONE_OPTIONS: { value: ToneOption; label: string }[] = [
  { value: "standard",  label: "Standard"  },
  { value: "formal",    label: "Formal"    },
  { value: "casual",    label: "Casual"    },
  { value: "academic",  label: "Academic"  },
];

// ── Confidence Band config ────────────────────────────────────────────────

const BAND_CONFIG: Record<string, { label: string; subtitle: string; color: string; bg: string; border: string }> = {
  "likely-human":        { label: "\u2713 Looks Human",      subtitle: "Should pass most detectors",    color: "#22c55e", bg: "rgba(34,197,94,0.1)",   border: "rgba(34,197,94,0.2)"   },
  "possibly-ai":         { label: "\u26A0 Borderline",       subtitle: "Some detectors may flag this",  color: "#eab308", bg: "rgba(234,179,8,0.1)",   border: "rgba(234,179,8,0.2)"   },
  "likely-ai":           { label: "\u26A1 Likely AI",        subtitle: "Will be caught by detectors",   color: "#f97316", bg: "rgba(249,115,22,0.1)",  border: "rgba(249,115,22,0.2)"  },
  "almost-certainly-ai": { label: "\uD83D\uDEA8 Flagged as AI",  subtitle: "Will be caught by detectors",   color: "#ef4444", bg: "rgba(239,68,68,0.1)",   border: "rgba(239,68,68,0.2)"   },
};

// ── KPI Explanations ──────────────────────────────────────────────────────

const KPI_EXPLANATIONS: Record<string, string> = {
  "Burstiness":      "Sentence length variation. Humans write in bursts \u2014 short then long. AI writes uniformly. Below 0.20 = AI-like rhythm.",
  "Vocab Diversity":  "Ratio of unique words to total words. AI repeats patterns. Below 0.40 = repetitive vocabulary.",
  "Avg Sentence":     "Average words per sentence. AI clusters between 18-25. Humans vary widely.",
  "Flesch":           "Readability score. AI text tends to cluster in the 40-60 'safe' range. Humans go higher or lower.",
};

// ── Score helpers ──────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 80) return "#ef4444";
  if (score >= 61) return "#8b5cf6";
  if (score >= 31) return "#a78bfa";
  return "#22c55e";
}

function getConfidenceBand(score: number): ConfidenceBand {
  if (score < 30) return "likely-human";
  if (score <= 60) return "possibly-ai";
  if (score <= 80) return "likely-ai";
  return "almost-certainly-ai";
}

// ── Heatmap ────────────────────────────────────────────────────────────────

function buildHeatmap(text: string, patterns: PatternHit[]): React.ReactNode {
  const highlights: Array<{ phrase: string; cls: string }> = [];

  for (const p of patterns) {
    let bg: string;
    if (p.id === "ai-vocab-t1") bg = "rgba(239,68,68,0.22)";
    else if (p.id === "ai-vocab-t2") bg = "rgba(167,139,250,0.22)";
    else if (p.category === "phrase" || p.id.startsWith("formulaic")) bg = "rgba(139,92,246,0.22)";
    else continue;

    for (const ex of p.examples) {
      if (ex.length < 40) highlights.push({ phrase: ex.toLowerCase(), cls: bg });
    }
  }

  if (!highlights.length) {
    return <p style={{ color: "rgba(255,255,255,0.65)", lineHeight: 1.8, whiteSpace: "pre-wrap", fontSize: "14px" }}>{text}</p>;
  }

  const sorted = highlights.sort((a, b) => b.phrase.length - a.phrase.length);
  const parts: Array<{ text: string; bg?: string }> = [{ text }];

  for (const { phrase, cls: bg } of sorted) {
    const next: typeof parts = [];
    for (const part of parts) {
      if (part.bg) { next.push(part); continue; }
      const regex = new RegExp(`(${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
      const segs = part.text.split(regex);
      for (const seg of segs) {
        next.push({ text: seg, bg: seg.toLowerCase() === phrase ? bg : undefined });
      }
    }
    parts.splice(0, parts.length, ...next);
  }

  return (
    <p style={{ color: "rgba(255,255,255,0.65)", lineHeight: 1.8, whiteSpace: "pre-wrap", fontSize: "14px" }}>
      {parts.map((part, i) =>
        part.bg ? (
          <mark key={i} style={{ background: part.bg, borderRadius: "2px", padding: "0 1px", color: "#fafafa" }}>
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        )
      )}
    </p>
  );
}

// ── Stat pill with tooltip ────────────────────────────────────────────────

function StatPill({ label, value, warn }: { label: string; value: string | number; warn: boolean }) {
  const [showTip, setShowTip] = useState(false);
  const explanation = KPI_EXPLANATIONS[label];

  return (
    <div style={{
      background: "#0f0f12", border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: "6px", padding: "12px 14px", flex: 1, position: "relative",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", color: "rgba(255,255,255,0.35)", marginBottom: "6px", letterSpacing: "0.3px" }}>
        {label}
        {explanation && (
          <span
            onMouseEnter={() => setShowTip(true)}
            onMouseLeave={() => setShowTip(false)}
            onTouchStart={() => setShowTip(true)}
            onTouchEnd={() => setShowTip(false)}
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: "14px", height: "14px", borderRadius: "50%",
              background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.3)",
              fontSize: "9px", fontWeight: 700, cursor: "help", flexShrink: 0,
            }}
          >
            ?
          </span>
        )}
      </div>
      <div style={{ fontSize: "18px", fontWeight: 700, color: warn ? "#8b5cf6" : "#22c55e", fontFamily: "var(--font-geist-mono), monospace" }}>
        {value}
      </div>
      <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.25)", marginTop: "3px" }}>
        {warn ? "\u26A0 AI range" : "\u2713 Normal"}
      </div>
      {/* Tooltip */}
      {showTip && explanation && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0,
          marginTop: "4px", zIndex: 50,
          background: "#1a1a1f", border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "6px", padding: "10px 12px",
          fontSize: "11px", color: "rgba(255,255,255,0.6)", lineHeight: 1.5,
          boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
        }}>
          {explanation}
        </div>
      )}
    </div>
  );
}

// ── Activation CTA ────────────────────────────────────────────────────────

function ActivationCTA({ score, onClick }: { score: number; onClick: () => void }) {
  let config: { bg: string; border: string; icon: string; title: string; subtitle: string; buttonLabel: string; buttonBg: string };

  if (score >= 60) {
    config = {
      bg: "radial-gradient(circle at top left, rgba(239,68,68,0.08), transparent)",
      border: "1px solid rgba(239,68,68,0.25)",
      icon: "\uD83D\uDEA8",
      title: "HIGH DETECTION RISK",
      subtitle: `Your text scored ${Math.round(score)}% AI \u2014 it will be flagged by GPTZero, Turnitin, and Originality.ai.`,
      buttonLabel: "\u2728 Humanize with AI \u2014 Fix it now \u2192",
      buttonBg: "linear-gradient(135deg, #ef4444, #8b5cf6)",
    };
  } else if (score >= 30) {
    config = {
      bg: "rgba(234,179,8,0.05)",
      border: "1px solid rgba(234,179,8,0.2)",
      icon: "\u26A0\uFE0F",
      title: "BORDERLINE RISK",
      subtitle: "Some detectors may flag this text. Humanize to score below 30%.",
      buttonLabel: "\u2728 Reduce AI Risk \u2014 Humanize",
      buttonBg: "linear-gradient(135deg, #eab308, #8b5cf6)",
    };
  } else {
    config = {
      bg: "rgba(34,197,94,0.05)",
      border: "1px solid rgba(34,197,94,0.15)",
      icon: "\u2705",
      title: "LOOKS HUMAN",
      subtitle: "Your text should pass most detectors. Want to be 100% sure?",
      buttonLabel: "\u2728 Polish it further \u2014 Humanize anyway",
      buttonBg: "#8b5cf6",
    };
  }

  return (
    <div style={{
      background: config.bg, border: config.border,
      borderRadius: "10px", padding: "20px", marginTop: "16px",
    }}>
      <div style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: score >= 60 ? "#ef4444" : score >= 30 ? "#eab308" : "#22c55e", marginBottom: "6px" }}>
        {config.icon}  {config.title}
      </div>
      <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.6)", margin: "0 0 14px", lineHeight: 1.5 }}>
        {config.subtitle}
      </p>
      <button
        onClick={onClick}
        style={{
          width: "100%", padding: "12px",
          background: config.buttonBg,
          color: "#fafafa", border: "none", borderRadius: "8px",
          fontSize: "14px", fontWeight: 700, cursor: "pointer",
          transition: "opacity 0.15s",
        }}
      >
        {config.buttonLabel}
      </button>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function EditorPage() {
  const [text, setText] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [humanizing, setHumanizing] = useState(false);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [humanizedText, setHumanizedText] = useState<string | null>(null);
  const [humanizedScore, setHumanizedScore] = useState<number | null>(null);
  const [tone, setTone] = useState<ToneOption>("standard");
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [userPlan, setUserPlan] = useState("FREE");

  const { isSignedIn } = useAuth();
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;

  // Feature 6: Pre-fill from sessionStorage
  useEffect(() => {
    const prefill = sessionStorage.getItem("prefill-text");
    if (prefill) {
      setText(prefill);
      sessionStorage.removeItem("prefill-text");
    }
  }, []);

  // Fetch usage to determine plan/limits
  useEffect(() => {
    if (!isSignedIn) return;
    fetch("/api/usage")
      .then(r => r.json())
      .then((data: { plan?: string; wordsUsed?: number; wordsLimit?: number }) => {
        if (data.plan) setUserPlan(data.plan);
      })
      .catch(() => {});
  }, [isSignedIn]);

  const handleAnalyze = useCallback(async () => {
    if (!text.trim() || text.length < 11) {
      toast.error("Please enter at least 10 characters.");
      return;
    }
    if (text.length > 10000) {
      toast.error("Text must be under 10,000 characters.");
      return;
    }

    setAnalyzing(true);
    setResult(null);
    setHumanizedText(null);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json() as AnalyzeResponse & { error?: { message: string } };
      if (!res.ok) { toast.error(data.error?.message ?? "Analysis failed."); return; }
      setResult(data);
      setDocumentId(data.documentId);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setAnalyzing(false);
    }
  }, [text]);

  const handleHumanize = useCallback(async () => {
    if (!documentId || !result) return;
    setHumanizing(true);
    try {
      const res = await fetch("/api/humanize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId, tone }),
      });
      const data = await res.json() as { humanizedText?: string; error?: { message: string } };
      if (!res.ok) { toast.error(data.error?.message ?? "Humanization failed."); return; }
      setHumanizedText(data.humanizedText ?? null);
      // Re-analyze humanized text to get new score
      if (data.humanizedText) {
        try {
          const reRes = await fetch("/api/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: data.humanizedText }),
          });
          const reData = await reRes.json() as AnalyzeResponse & { error?: { message: string } };
          if (reRes.ok) setHumanizedScore(reData.score);
        } catch { /* non-blocking */ }
      }
      toast.success("Text humanized!");
    } catch {
      toast.error("Network error.");
    } finally {
      setHumanizing(false);
    }
  }, [documentId, result, tone]);

  const handleCTAClick = useCallback(async () => {
    if (!isSignedIn) {
      setShowAuthModal(true);
      return;
    }
    // Check if free user hit quota
    if (userPlan === "FREE") {
      try {
        const res = await fetch("/api/usage");
        const data = await res.json() as { wordsUsed?: number; wordsLimit?: number };
        if (data.wordsUsed !== undefined && data.wordsLimit !== undefined && data.wordsUsed >= data.wordsLimit) {
          setShowUpgradeModal(true);
          return;
        }
      } catch { /* proceed anyway */ }
    }
    // Scroll to humanize section
    document.getElementById("humanize-section")?.scrollIntoView({ behavior: "smooth" });
  }, [isSignedIn, userPlan]);

  const handleClear = () => {
    setText("");
    setResult(null);
    setHumanizedText(null);
    setHumanizedScore(null);
    setDocumentId(null);
  };

  const handleCopy = () => {
    if (!humanizedText) return;
    void navigator.clipboard.writeText(humanizedText);
    toast.success("Copied to clipboard!");
  };

  // Compute confidence band from result
  const band = result ? BAND_CONFIG[result.confidenceBand ?? getConfidenceBand(result.score)] : null;

  // Pattern summary: top 2 high-severity issues
  const patternSummary = result ? (() => {
    const sorted = [...result.patterns].sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2, low: 3 };
      return order[a.severity] - order[b.severity];
    });
    const highSev = sorted.filter(p => p.severity === "critical" || p.severity === "high");
    const topIssues = (highSev.length > 0 ? highSev : sorted).slice(0, 2);
    const names = topIssues.map(p => p.label).join(" \u00B7 ");
    return `${result.patterns.length} AI patterns detected \u00B7 ${highSev.length} high severity \u00B7 ${names}`;
  })() : null;

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", fontFamily: "var(--font-geist-sans), Inter, sans-serif" }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <h1 style={{ fontSize: "20px", fontWeight: 700, color: "#fafafa", letterSpacing: "-0.5px" }}>Editor</h1>
          {wordCount > 0 && (
            <span style={{
              fontSize: "11px", padding: "2px 8px", borderRadius: "4px",
              background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)",
              fontFamily: "var(--font-geist-mono), monospace",
            }}>
              {wordCount.toLocaleString()} words
            </span>
          )}
        </div>
        <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.35)", marginTop: "4px" }}>
          Paste your text and analyze it for AI patterns.
        </p>
      </div>

      {/* ── Two-column layout ── */}
      <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: "16px" }} className="editor-grid">

        {/* ── Left: Editor ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
          <div style={{
            background: "#0f0f12", border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: "8px", overflow: "hidden",
            display: "flex", flexDirection: "column",
          }}>
            {/* Editor header */}
            <div style={{
              padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)",
              display: "flex", alignItems: "center", gap: "8px",
            }}>
              <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#ef4444", opacity: 0.5 }} />
              <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#7c3aed", opacity: 0.5 }} />
              <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#22c55e", opacity: 0.5 }} />
              <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.2)", marginLeft: "8px" }}>input.txt</span>
            </div>

            {/* Textarea */}
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste your text here..."
              style={{
                width: "100%", minHeight: "340px",
                background: "transparent",
                border: "none", outline: "none", resize: "none",
                color: "#fafafa", fontSize: "15px", lineHeight: 1.8,
                fontFamily: "var(--font-geist-sans), Inter, sans-serif",
                padding: "20px",
                boxSizing: "border-box",
              }}
            />

            {/* Toolbar */}
            <div style={{
              padding: "12px 16px", borderTop: "1px solid rgba(255,255,255,0.05)",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              background: "rgba(255,255,255,0.01)",
              flexWrap: "wrap", gap: "8px",
            }}>
              <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.25)", fontFamily: "var(--font-geist-mono), monospace", minWidth: 0, flex: "1 1 auto" }}>
                {wordCount.toLocaleString()} words &middot; {text.length.toLocaleString()} / 10,000
              </span>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={handleClear}
                  disabled={!text}
                  style={{
                    background: "transparent", border: "1px solid rgba(255,255,255,0.1)",
                    color: "rgba(255,255,255,0.5)", fontSize: "12px", fontWeight: 500,
                    padding: "6px 12px", borderRadius: "5px", cursor: text ? "pointer" : "not-allowed",
                    opacity: text ? 1 : 0.4, transition: "border-color 0.15s",
                  }}
                >
                  Clear
                </button>
                <button
                  onClick={handleAnalyze}
                  disabled={analyzing || !text.trim()}
                  style={{
                    background: analyzing || !text.trim() ? "rgba(139,92,246,0.3)" : "#8b5cf6",
                    color: "#09090b", fontSize: "12px", fontWeight: 700,
                    padding: "6px 16px", borderRadius: "5px",
                    cursor: analyzing || !text.trim() ? "not-allowed" : "pointer",
                    border: "none", display: "flex", alignItems: "center", gap: "6px",
                    transition: "background 0.15s",
                  }}
                >
                  {analyzing ? (
                    <><Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> Analyzing&hellip;</>
                  ) : (
                    "Analyze \u2192"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right: Results ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {result ? (
            <>
              {/* Score */}
              <div style={{
                background: "#0f0f12", border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: "8px", padding: "24px",
                display: "flex", flexDirection: "column", alignItems: "center",
              }}>
                <ScoreRing score={Math.round(result.score)} size={140} animate />
                <div style={{ width: "100%", height: "1px", background: "rgba(255,255,255,0.06)", margin: "20px 0" }} />
                {/* Progress bar */}
                <div style={{ width: "100%", height: "2px", background: "rgba(255,255,255,0.06)", borderRadius: "2px" }}>
                  <div style={{
                    height: "2px", borderRadius: "2px",
                    background: scoreColor(result.score),
                    width: `${result.score}%`,
                    transition: "width 1s ease",
                    boxShadow: `0 0 8px ${scoreColor(result.score)}80`,
                  }} />
                </div>
              </div>

              {/* Feature 1a: Confidence Band Badge */}
              {band && (
                <div style={{
                  background: band.bg, border: `1px solid ${band.border}`,
                  borderRadius: "8px", padding: "12px 16px",
                }}>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: band.color }}>
                    {band.label}
                  </div>
                  <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)", marginTop: "2px" }}>
                    {band.subtitle}
                  </div>
                </div>
              )}

              {/* Stats row (Feature 1b: with tooltip) */}
              <div className="stat-pills-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <StatPill
                  label="Burstiness"
                  value={result.stats.burstiness}
                  warn={result.stats.burstiness < 0.2}
                />
                <StatPill
                  label="Vocab Diversity"
                  value={result.stats.typeTokenRatio}
                  warn={result.stats.typeTokenRatio < 0.4}
                />
                <StatPill
                  label="Avg Sentence"
                  value={`${result.stats.avgSentenceLength}w`}
                  warn={result.stats.avgSentenceLength >= 18 && result.stats.avgSentenceLength <= 25}
                />
                <StatPill
                  label="Flesch"
                  value={result.stats.fleschReadingEase}
                  warn={result.stats.fleschReadingEase >= 40 && result.stats.fleschReadingEase <= 60}
                />
              </div>

              {/* Feature 1c: Pattern summary sentence */}
              {patternSummary && (
                <div style={{
                  fontSize: "12px", color: "rgba(255,255,255,0.4)", lineHeight: 1.5,
                  padding: "0 2px",
                }}>
                  {patternSummary}
                </div>
              )}
            </>
          ) : (
            <div style={{
              background: "#0f0f12", border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: "8px", padding: "48px 24px",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              flex: 1,
            }}>
              <div style={{ fontSize: "36px", marginBottom: "12px", opacity: 0.2 }}>\u26A1</div>
              <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.25)", textAlign: "center" }}>
                Your score will appear<br />here after analysis.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Feature 2: Activation CTA ── */}
      {result && (
        <ActivationCTA score={result.score} onClick={handleCTAClick} />
      )}

      {/* ── Pattern cards ── */}
      {result && result.patterns.length > 0 && (
        <div style={{ marginTop: "16px" }}>
          <div style={{
            background: "#0f0f12", border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: "8px", padding: "20px",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px", flexWrap: "wrap", gap: "8px" }}>
              <h2 style={{ fontSize: "14px", fontWeight: 600, color: "#fafafa" }}>Patterns Detected</h2>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{
                  fontSize: "11px", padding: "2px 8px", borderRadius: "4px",
                  background: "rgba(139,92,246,0.12)", color: "#8b5cf6", fontWeight: 600,
                }}>
                  {result.patterns.length} found
                </span>
                <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.25)" }}>
                  {result.wordCount} words
                </span>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {result.patterns
                .sort((a, b) => {
                  const order = { critical: 0, high: 1, medium: 2, low: 3 };
                  return order[a.severity] - order[b.severity];
                })
                .map((pattern) => (
                  <PatternCard key={pattern.id} pattern={pattern} />
                ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Heatmap ── */}
      {result && text && (
        <div style={{ marginTop: "16px" }}>
          <div style={{
            background: "#0f0f12", border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: "8px", padding: "20px",
          }}>
            <h2 style={{ fontSize: "14px", fontWeight: 600, color: "#fafafa", marginBottom: "10px" }}>
              Text Heatmap
            </h2>
            <div style={{ display: "flex", gap: "16px", marginBottom: "14px", flexWrap: "wrap" }}>
              <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", display: "flex", alignItems: "center", gap: "5px" }}>
                <span style={{ width: "10px", height: "10px", borderRadius: "2px", background: "rgba(239,68,68,0.5)", display: "inline-block" }} />
                Tier 1 vocabulary
              </span>
              <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", display: "flex", alignItems: "center", gap: "5px" }}>
                <span style={{ width: "10px", height: "10px", borderRadius: "2px", background: "rgba(139,92,246,0.5)", display: "inline-block" }} />
                Pattern phrases
              </span>
              <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", display: "flex", alignItems: "center", gap: "5px" }}>
                <span style={{ width: "10px", height: "10px", borderRadius: "2px", background: "rgba(167,139,250,0.5)", display: "inline-block" }} />
                Tier 2 vocabulary
              </span>
            </div>
            <div style={{
              background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)",
              borderRadius: "6px", padding: "16px",
            }}>
              {buildHeatmap(text, result.patterns)}
            </div>
          </div>
        </div>
      )}

      {/* ── Humanize ── */}
      {result && (
        <div id="humanize-section" style={{ marginTop: "16px" }}>
          <div style={{
            background: "#0f0f12", border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: "8px", padding: "20px",
          }}>
            {/* Divider with label */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
              <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.06)" }} />
              <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.25)", fontWeight: 600, letterSpacing: "1px", textTransform: "uppercase" }}>
                Humanize
              </span>
              <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.06)" }} />
            </div>

            {/* Tone selector — tabs */}
            <div style={{ marginBottom: "16px" }}>
              <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", marginBottom: "10px", fontWeight: 600, letterSpacing: "0.5px", textTransform: "uppercase" }}>
                Tone
              </div>
              <div className="tone-row" style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {TONE_OPTIONS.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setTone(value)}
                    style={{
                      padding: "7px 10px", borderRadius: "5px", fontSize: "12px", fontWeight: 500,
                      cursor: "pointer", border: "1px solid",
                      borderColor: tone === value ? "#8b5cf6" : "rgba(255,255,255,0.08)",
                      background: tone === value ? "rgba(139,92,246,0.12)" : "transparent",
                      color: tone === value ? "#8b5cf6" : "rgba(255,255,255,0.4)",
                      transition: "all 0.15s",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Humanize button */}
            <button
              onClick={handleHumanize}
              disabled={humanizing || !documentId}
              style={{
                width: "100%", padding: "12px",
                background: humanizing || !documentId ? "rgba(139,92,246,0.25)" : "#8b5cf6",
                color: humanizing || !documentId ? "rgba(255,255,255,0.4)" : "#09090b",
                border: "none", borderRadius: "6px", fontSize: "14px", fontWeight: 700,
                cursor: humanizing || !documentId ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                transition: "background 0.15s",
              }}
            >
              {humanizing ? (
                <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> AI is rewriting your text&hellip;</>
              ) : (
                "Humanize with AI \u2192"
              )}
            </button>

            {/* Before / After */}
            {humanizedText && (
              <div style={{ marginTop: "20px" }}>
                <div className="before-after-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  {/* Before */}
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                      <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "1px" }}>Before</span>
                      <span style={{
                        fontSize: "11px", padding: "2px 6px", borderRadius: "4px",
                        background: `${scoreColor(result.score)}20`,
                        color: scoreColor(result.score), fontWeight: 600,
                      }}>
                        {Math.round(result.score)} / 100
                      </span>
                    </div>
                    <div style={{
                      background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
                      borderRadius: "6px", padding: "14px", fontSize: "13px",
                      color: "rgba(255,255,255,0.55)", lineHeight: 1.7,
                      maxHeight: "200px", overflow: "auto",
                    }}>
                      {text}
                    </div>
                    <div style={{ marginTop: "6px", height: "2px", background: "rgba(255,255,255,0.06)", borderRadius: "2px" }}>
                      <div style={{ height: "2px", borderRadius: "2px", width: `${result.score}%`, background: scoreColor(result.score) }} />
                    </div>
                  </div>

                  {/* After */}
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                      <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "1px" }}>After</span>
                      {humanizedScore !== null && (
                        <span style={{
                          fontSize: "11px", padding: "2px 6px", borderRadius: "4px",
                          background: `${scoreColor(humanizedScore)}20`,
                          color: scoreColor(humanizedScore), fontWeight: 600,
                        }}>
                          {Math.round(humanizedScore)} / 100
                        </span>
                      )}
                    </div>
                    <div style={{
                      background: "rgba(34,197,94,0.04)", border: "1px solid rgba(34,197,94,0.15)",
                      borderRadius: "6px", padding: "14px", fontSize: "13px",
                      color: "rgba(255,255,255,0.75)", lineHeight: 1.7,
                      maxHeight: "200px", overflow: "auto",
                    }}>
                      {humanizedText}
                    </div>
                    {humanizedScore !== null && (
                      <div style={{ marginTop: "6px", height: "2px", background: "rgba(255,255,255,0.06)", borderRadius: "2px" }}>
                        <div style={{ height: "2px", borderRadius: "2px", width: `${humanizedScore}%`, background: scoreColor(humanizedScore), transition: "width 1s ease" }} />
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: "8px", marginTop: "14px", flexWrap: "wrap" }}>
                  <button
                    onClick={handleCopy}
                    style={{
                      display: "flex", alignItems: "center", gap: "6px",
                      background: "transparent", border: "1px solid rgba(255,255,255,0.1)",
                      color: "rgba(255,255,255,0.5)", fontSize: "12px", fontWeight: 500,
                      padding: "7px 14px", borderRadius: "5px", cursor: "pointer",
                    }}
                  >
                    <Copy size={12} />
                    Copy humanized
                  </button>
                  <button
                    onClick={() => { setText(humanizedText); setResult(null); setHumanizedText(null); setDocumentId(null); }}
                    style={{
                      background: "transparent", border: "1px solid rgba(255,255,255,0.1)",
                      color: "rgba(255,255,255,0.5)", fontSize: "12px", fontWeight: 500,
                      padding: "7px 14px", borderRadius: "5px", cursor: "pointer",
                    }}
                  >
                    Re-analyze &rarr;
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
      <UpgradeModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} currentPlan={userPlan} />

      {/* Responsive grid */}
      <style>{`
        @media (max-width: 768px) {
          .editor-grid {
            grid-template-columns: 1fr !important;
          }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
