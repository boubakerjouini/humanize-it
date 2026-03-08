"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import { usePostHog } from "posthog-js/react";
import { PatternCard } from "@/components/ui/pattern-card";
import { AuthModal } from "@/components/ui/auth-modal";
import { UpgradeModal } from "@/components/ui/upgrade-modal";
import type { PatternHit } from "@/lib/algorithms/analyzeText";
import { Copy, RotateCcw, Zap, CheckCircle2, Sparkles, ArrowRight, ChevronDown, ChevronUp, Lock, Shield } from "lucide-react";
import { toast } from "sonner";
import { simulateEngineScores, type EngineScore } from "@/lib/engines";

type ToneOption = "standard" | "formal" | "casual" | "academic";

interface AnalyzeResponse {
  score: number;
  confidenceBand: string;
  patterns: PatternHit[];
  stats: { burstiness: number; typeTokenRatio: number; avgSentenceLength: number; fleschReadingEase: number };
  wordCount: number;
  documentId: string;
}

const TONES: { value: ToneOption; label: string }[] = [
  { value: "standard", label: "Standard" },
  { value: "formal", label: "Formal" },
  { value: "casual", label: "Casual" },
  { value: "academic", label: "Academic" },
];

function getScoreConfig(score: number) {
  if (score >= 75) return { label: "FLAGGED AS AI", desc: "Will be caught by GPTZero, Turnitin & Originality.ai", color: "#ef4444", dimColor: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.2)", ctaLabel: "Fix it — Humanize now" };
  if (score >= 50) return { label: "LIKELY AI", desc: "Most detectors will flag this text", color: "#f97316", dimColor: "rgba(249,115,22,0.08)", border: "rgba(249,115,22,0.2)", ctaLabel: "Humanize to reduce risk" };
  if (score >= 30) return { label: "BORDERLINE", desc: "Some detectors may flag this", color: "#eab308", dimColor: "rgba(234,179,8,0.06)", border: "rgba(234,179,8,0.18)", ctaLabel: "Polish to pass safely" };
  return { label: "LOOKS HUMAN", desc: "Should pass most AI detectors", color: "#22c55e", dimColor: "rgba(34,197,94,0.06)", border: "rgba(34,197,94,0.18)", ctaLabel: "Polish it further" };
}

// Animated score ring with count-up
function ScoreRing({ score, size = 140 }: { score: number; size?: number }) {
  const [displayed, setDisplayed] = useState(0);
  const [drawn, setDrawn] = useState(false);
  const cfg = getScoreConfig(score);
  const strokeWidth = 9;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  useEffect(() => {
    const t1 = setTimeout(() => setDrawn(true), 80);
    let start = 0;
    const target = Math.round(score);
    const duration = 900;
    const step = 16;
    const increment = (target / duration) * step;
    const t2 = setInterval(() => {
      start = Math.min(start + increment, target);
      setDisplayed(Math.round(start));
      if (start >= target) clearInterval(t2);
    }, step);
    return () => { clearTimeout(t1); clearInterval(t2); };
  }, [score]);

  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={cfg.color} strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={drawn ? offset : circumference}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1), stroke 0.4s ease" }}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: "36px", fontWeight: 900, color: cfg.color, lineHeight: 1, letterSpacing: "-2px", fontVariantNumeric: "tabular-nums" }}>
          {displayed}
        </div>
        <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", marginTop: "2px" }}>/100</div>
      </div>
    </div>
  );
}

// Skeleton shimmer block
function Skeleton({ width = "100%", height = 16, radius = 6, style = {} }: { width?: string | number; height?: number; radius?: number; style?: React.CSSProperties }) {
  return (
    <div style={{
      width, height, borderRadius: radius,
      background: "linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 100%)",
      backgroundSize: "200% 100%",
      animation: "shimmer 1.5s infinite",
      ...style,
    }} />
  );
}

// Humanizing orb animation
function HumanizingState() {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "40px 24px", gap: "20px",
      animation: "fadeInUp 0.3s ease",
    }}>
      <div style={{ position: "relative", width: "64px", height: "64px" }}>
        {[
          { size: 32, top: "16px", left: "16px", delay: "0s", color: "rgba(139,92,246,0.9)" },
          { size: 22, top: "4px", left: "6px", delay: "0.3s", color: "rgba(99,102,241,0.7)" },
          { size: 18, top: "auto", left: "auto", delay: "0.6s", color: "rgba(167,139,250,0.6)" },
        ].map((orb, i) => (
          <div key={i} style={{
            position: "absolute",
            width: orb.size, height: orb.size,
            top: orb.top, left: orb.left,
            ...(i === 2 ? { bottom: "4px", right: "4px" } : {}),
            borderRadius: "50%",
            background: `radial-gradient(circle, ${orb.color}, transparent)`,
            filter: "blur(3px)",
            animation: `orb${i + 1} ${1.8 + i * 0.4}s ease-in-out infinite`,
            animationDelay: orb.delay,
          }} />
        ))}
      </div>
      <div>
        <p style={{ fontSize: "14px", fontWeight: 600, color: "rgba(255,255,255,0.8)", textAlign: "center", marginBottom: "6px" }}>
          AI is rewriting your text
          <span className="dots"><span>.</span><span>.</span><span>.</span></span>
        </p>
        <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.3)", textAlign: "center" }}>
          Multi-pass engine · up to 3 attempts · picking the best
        </p>
      </div>
      <div style={{ display: "flex", gap: "6px" }}>
        {["Pass 1", "Pass 2", "Pass 3"].map((p, i) => (
          <div key={p} style={{
            fontSize: "10px", color: "rgba(255,255,255,0.3)",
            padding: "3px 8px", borderRadius: "4px",
            background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.15)",
            animation: `passGlow 1.8s ease-in-out infinite`,
            animationDelay: `${i * 0.6}s`,
          }}>{p}</div>
        ))}
      </div>
    </div>
  );
}

export default function EditorPage() {
  const { isSignedIn } = useAuth();
  const posthog = usePostHog();
  const [text, setText] = useState("");
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [humanizedText, setHumanizedText] = useState<string | null>(null);
  const [humanizedScore, setHumanizedScore] = useState<number | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [humanizing, setHumanizing] = useState(false);
  const [tone, setTone] = useState<ToneOption>("standard");
  const [showAllPatterns, setShowAllPatterns] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [visiblePatterns, setVisiblePatterns] = useState(0);
  const [userPlan, setUserPlan] = useState<string | null>(null);
  const [engineScores, setEngineScores] = useState<EngineScore[] | null>(null);
  const [humanizedEngineScores, setHumanizedEngineScores] = useState<EngineScore[] | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const prefill = sessionStorage.getItem("prefill-text");
    if (prefill) { setText(prefill); sessionStorage.removeItem("prefill-text"); }
  }, []);

  useEffect(() => {
    fetch("/api/user-plan").then(r => r.json()).then(d => setUserPlan(d.plan ?? "FREE")).catch(() => setUserPlan("FREE"));
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setShowAuthModal(false); setShowUpgradeModal(false); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Stagger patterns reveal
  useEffect(() => {
    if (!result) { setVisiblePatterns(0); return; }
    setVisiblePatterns(0);
    const patterns = result.patterns.slice(0, showAllPatterns ? undefined : 3);
    patterns.forEach((_, i) => {
      setTimeout(() => setVisiblePatterns(i + 1), 120 + i * 80);
    });
  }, [result, showAllPatterns]);

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const canAnalyze = text.trim().length >= 10 && !analyzing && !humanizing;
  const scoreConfig = result ? getScoreConfig(result.score) : null;
  const isDone = !humanizing && humanizedText !== null;

  const handleAnalyze = useCallback(async () => {
    if (!canAnalyze) return;
    posthog?.capture("analyze_clicked", { word_count: wordCount });
    setAnalyzing(true);
    setResult(null);
    setHumanizedText(null);
    setHumanizedScore(null);
    setShowAllPatterns(false);
    setEngineScores(null);
    setHumanizedEngineScores(null);

    try {
      const res = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
      const data = await res.json() as AnalyzeResponse & { error?: { message: string } };
      if (res.status === 402) { setShowUpgradeModal(true); return; }
      if (!res.ok) { toast.error(data.error?.message ?? "Analysis failed."); return; }
      setResult(data);
      if (userPlan === "PRO" || userPlan === "TEAM") {
        setEngineScores(simulateEngineScores(data.score));
      }
      posthog?.capture("analysis_completed", { score: data.score, pattern_count: data.patterns.length });
    } catch { toast.error("Network error. Please try again."); }
    finally { setAnalyzing(false); }
  }, [text, canAnalyze, wordCount, posthog, userPlan]);

  const handleHumanize = useCallback(async (overrideTone?: ToneOption) => {
    if (!result) return;
    if (!isSignedIn) { setShowAuthModal(true); return; }
    const useTone = overrideTone ?? tone;
    posthog?.capture("humanize_clicked", { tone: useTone, score: result.score });
    setHumanizing(true);
    setHumanizedText(null);
    setHumanizedScore(null);

    try {
      const res = await fetch("/api/humanize", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ documentId: result.documentId, tone: useTone }) });
      const data = await res.json() as { humanizedText?: string; error?: { message: string } };
      if (res.status === 402) { setShowUpgradeModal(true); return; }
      if (!res.ok) { toast.error(data.error?.message ?? "Humanization failed."); return; }

      setHumanizedText(data.humanizedText ?? null);
      if (data.humanizedText) {
        try {
          const reRes = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: data.humanizedText }) });
          if (reRes.ok) {
            const reData = await reRes.json() as AnalyzeResponse;
            setHumanizedScore(reData.score);
            if (userPlan === "PRO" || userPlan === "TEAM") {
              setHumanizedEngineScores(simulateEngineScores(reData.score));
            }
          }
        } catch { /* ignore */ }
      }
      posthog?.capture("humanize_completed", { tone: useTone, original_score: result.score });
    } catch { toast.error("Network error. Please try again."); }
    finally { setHumanizing(false); }
  }, [result, tone, isSignedIn, posthog, userPlan]);

  const handleCopy = useCallback(async () => {
    if (!humanizedText) return;
    await navigator.clipboard.writeText(humanizedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    posthog?.capture("text_copied");
  }, [humanizedText, posthog]);

  const handleReset = () => {
    setResult(null);
    setHumanizedText(null);
    setHumanizedScore(null);
    setShowAllPatterns(false);
    setTimeout(() => textareaRef.current?.focus(), 100);
  };

  // Word count color
  const wordCountColor = wordCount === 0 ? "rgba(255,255,255,0.2)"
    : wordCount > 1800 ? "#ef4444"
    : wordCount > 1500 ? "#eab308"
    : "#22c55e";

  const showRightPanel = result || analyzing;

  return (
    <div style={{ minHeight: "100%", background: "#09090b", display: "flex", flexDirection: "column" }}>

      {/* ── Header ── */}
      <div style={{
        padding: "12px 24px",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexShrink: 0, gap: "12px", flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Sparkles size={15} color="#8b5cf6" />
          <h1 style={{ fontSize: "14px", fontWeight: 700, color: "#fafafa", margin: 0 }}>Editor</h1>
          {/* Step breadcrumb */}
          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            {[
              { label: "Write", done: !!result || analyzing },
              { label: "Analyze", done: !!result, active: analyzing },
              { label: "Humanize", done: isDone, active: humanizing },
            ].map(({ label, done, active }, i) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                {i > 0 && <div style={{ width: "14px", height: "1px", background: done || active ? "rgba(139,92,246,0.4)" : "rgba(255,255,255,0.08)" }} />}
                <span style={{
                  fontSize: "11px", fontWeight: done || active ? 600 : 400,
                  color: done ? "#22c55e" : active ? "#a78bfa" : "rgba(255,255,255,0.25)",
                  display: "flex", alignItems: "center", gap: "3px",
                }}>
                  {done && <CheckCircle2 size={9} />}
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {/* Tone selector */}
          <div style={{ display: "flex", gap: "3px" }}>
            {TONES.map(({ value, label }) => (
              <button key={value} onClick={() => setTone(value)} style={{
                padding: "4px 9px", borderRadius: "5px", fontSize: "11px", fontWeight: 500, cursor: "pointer",
                border: `1px solid ${tone === value ? "rgba(139,92,246,0.4)" : "rgba(255,255,255,0.06)"}`,
                background: tone === value ? "rgba(139,92,246,0.12)" : "transparent",
                color: tone === value ? "#8b5cf6" : "rgba(255,255,255,0.3)",
                transition: "all 0.15s",
              }}>{label}</button>
            ))}
          </div>
          {(result || humanizedText) && (
            <button onClick={handleReset} style={{
              display: "flex", alignItems: "center", gap: "4px",
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: "6px", padding: "4px 10px", color: "rgba(255,255,255,0.35)",
              cursor: "pointer", fontSize: "11px",
            }}>
              <RotateCcw size={10} /> New
            </button>
          )}
        </div>
      </div>

      {/* ── Main Grid ── */}
      <div style={{ flex: 1, padding: "20px 24px", overflow: "auto" }}>
        <div className="editor-grid" style={{
          display: "grid",
          gridTemplateColumns: showRightPanel ? "1fr 400px" : "1fr",
          gap: "20px",
          maxWidth: showRightPanel ? "1120px" : "720px",
          margin: "0 auto",
          transition: "max-width 0.4s ease",
        }}>

          {/* ── LEFT: Textarea + Humanized ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", minWidth: 0 }}>

            {/* Textarea card */}
            <div style={{
              background: "#0f0f12", borderRadius: "12px",
              border: `1.5px solid ${analyzing ? "rgba(139,92,246,0.4)" : "rgba(255,255,255,0.07)"}`,
              overflow: "hidden", transition: "border-color 0.3s, box-shadow 0.3s",
              boxShadow: analyzing ? "0 0 30px rgba(139,92,246,0.08)" : "none",
            }}>
              {/* Mac-style toolbar */}
              <div style={{
                padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)",
                display: "flex", alignItems: "center", gap: "6px",
                background: analyzing ? "rgba(139,92,246,0.04)" : "transparent",
                transition: "background 0.3s",
              }}>
                {["#ef4444", "#eab308", "#22c55e"].map((c, i) => (
                  <div key={i} style={{ width: "8px", height: "8px", borderRadius: "50%", background: c, opacity: analyzing ? 0.8 : 0.4 }} />
                ))}
                <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.15)", marginLeft: "8px", fontFamily: "monospace" }}>
                  {analyzing ? "scanning…" : "your text"}
                </span>
                {analyzing && (
                  <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "6px" }}>
                    <div className="scan-pulse" />
                    <span style={{ fontSize: "10px", color: "#a78bfa" }}>Analyzing</span>
                  </div>
                )}
              </div>

              {/* Scan progress bar */}
              {analyzing && (
                <div style={{ height: "2px", background: "rgba(255,255,255,0.04)" }}>
                  <div className="scan-bar" style={{ height: "100%", background: "linear-gradient(90deg, #8b5cf6, #a78bfa, #8b5cf6)", backgroundSize: "200% 100%" }} />
                </div>
              )}

              <textarea
                ref={textareaRef}
                value={text}
                onChange={e => {
                  setText(e.target.value);
                  if (result) { setResult(null); setHumanizedText(null); setHumanizedScore(null); }
                }}
                placeholder={"Paste or type AI-generated text here…\n\nTip: try text that starts with \"In today's rapidly evolving landscape\" or uses words like \"furthermore\", \"pivotal\", \"paradigm\""}
                style={{
                  width: "100%", minHeight: "280px", padding: "16px",
                  background: "transparent", border: "none", outline: "none",
                  resize: "vertical", color: "#f0f0f8", fontSize: "14px",
                  lineHeight: 1.8, fontFamily: "inherit", boxSizing: "border-box",
                  display: "block", opacity: analyzing ? 0.5 : 1, transition: "opacity 0.3s",
                }}
              />

              {/* Toolbar */}
              <div style={{
                padding: "10px 14px", borderTop: "1px solid rgba(255,255,255,0.05)",
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px",
              }}>
                <span style={{ fontSize: "11px", color: wordCountColor, fontVariantNumeric: "tabular-nums", transition: "color 0.3s" }}>
                  {wordCount > 0 ? `${wordCount.toLocaleString()} words` : "Paste text to get started"}
                </span>
                <button
                  onClick={() => void handleAnalyze()}
                  disabled={!canAnalyze}
                  style={{
                    display: "flex", alignItems: "center", gap: "7px",
                    padding: "10px 22px", borderRadius: "8px", border: "none",
                    background: canAnalyze ? "linear-gradient(135deg, #8b5cf6, #7c3aed)" : "rgba(139,92,246,0.12)",
                    color: canAnalyze ? "#fff" : "rgba(255,255,255,0.2)",
                    fontSize: "13px", fontWeight: 700,
                    cursor: canAnalyze ? "pointer" : "not-allowed",
                    transition: "all 0.2s", flexShrink: 0,
                    boxShadow: canAnalyze ? "0 4px 16px rgba(139,92,246,0.3)" : "none",
                  }}
                >
                  {analyzing ? (
                    <><div className="spin-sm" /> Scanning…</>
                  ) : (
                    <><Zap size={13} /> {result ? "Re-analyze" : "Analyze"} <ArrowRight size={11} /></>
                  )}
                </button>
              </div>
            </div>

            {/* Humanized output */}
            {(humanizing || isDone) && (
              <div style={{
                background: "#0f0f12", borderRadius: "12px",
                border: `1.5px solid ${isDone ? "rgba(34,197,94,0.25)" : "rgba(139,92,246,0.2)"}`,
                overflow: "hidden", animation: "fadeInUp 0.35s ease",
              }}>
                {humanizing ? (
                  <HumanizingState />
                ) : humanizedText && (
                  <>
                    <div style={{
                      padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)",
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ fontSize: "12px", fontWeight: 700, color: "#22c55e", display: "flex", alignItems: "center", gap: "5px" }}>
                          <CheckCircle2 size={13} /> Humanized
                        </span>
                        {humanizedScore !== null && result && (
                          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                            <span style={{ fontSize: "11px", padding: "2px 7px", borderRadius: "4px", fontWeight: 700, background: "rgba(239,68,68,0.1)", color: "#ef4444", textDecoration: "line-through", opacity: 0.6 }}>
                              {Math.round(result.score)}%
                            </span>
                            <ArrowRight size={9} color="rgba(255,255,255,0.2)" />
                            <span style={{
                              fontSize: "11px", padding: "2px 7px", borderRadius: "4px", fontWeight: 700,
                              background: humanizedScore < 30 ? "rgba(34,197,94,0.12)" : "rgba(249,115,22,0.1)",
                              color: humanizedScore < 30 ? "#22c55e" : "#f97316",
                              animation: "popIn 0.4s ease",
                            }}>
                              {Math.round(humanizedScore)}%
                            </span>
                          </div>
                        )}
                      </div>
                      <button onClick={() => void handleCopy()} style={{
                        display: "flex", alignItems: "center", gap: "5px",
                        background: copied ? "rgba(34,197,94,0.1)" : "rgba(255,255,255,0.05)",
                        border: `1px solid ${copied ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.08)"}`,
                        borderRadius: "5px", padding: "5px 10px", cursor: "pointer",
                        color: copied ? "#22c55e" : "rgba(255,255,255,0.45)", fontSize: "11px",
                        transition: "all 0.2s",
                      }}>
                        <Copy size={10} /> {copied ? "Copied!" : "Copy"}
                      </button>
                    </div>
                    <div style={{
                      padding: "16px", fontSize: "14px", lineHeight: 1.8,
                      color: "rgba(255,255,255,0.82)", whiteSpace: "pre-wrap",
                      maxHeight: "380px", overflow: "auto",
                    }}>
                      {humanizedText}
                    </div>
                    <div style={{
                      padding: "10px 16px", borderTop: "1px solid rgba(255,255,255,0.05)",
                      display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap",
                    }}>
                      <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)", marginRight: "2px" }}>Try tone:</span>
                      {TONES.map(({ value, label }) => (
                        <button key={value} onClick={() => { setTone(value); void handleHumanize(value); }} style={{
                          padding: "4px 10px", borderRadius: "5px", fontSize: "11px",
                          background: tone === value ? "rgba(139,92,246,0.12)" : "rgba(255,255,255,0.04)",
                          border: `1px solid ${tone === value ? "rgba(139,92,246,0.3)" : "rgba(255,255,255,0.07)"}`,
                          color: tone === value ? "#a78bfa" : "rgba(255,255,255,0.35)", cursor: "pointer",
                          transition: "all 0.15s",
                        }}>{label}</button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* ── RIGHT: Score + Patterns ── */}
          {showRightPanel && (
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

              {/* Score card */}
              <div style={{
                background: analyzing ? "#0f0f12" : (scoreConfig?.dimColor ?? "#0f0f12"),
                border: `1px solid ${analyzing ? "rgba(255,255,255,0.07)" : (scoreConfig?.border ?? "rgba(255,255,255,0.07)")}`,
                borderRadius: "14px", padding: "22px",
                animation: analyzing ? "none" : "fadeInUp 0.35s ease",
                transition: "background 0.5s, border-color 0.5s",
              }}>
                {analyzing ? (
                  /* Skeleton */
                  <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
                      <div style={{ width: 140, height: 140, borderRadius: "50%", flexShrink: 0 }}>
                        <Skeleton width={140} height={140} radius={70} />
                      </div>
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px" }}>
                        <Skeleton width="70%" height={12} />
                        <Skeleton width="90%" height={10} />
                        <Skeleton width="55%" height={10} />
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                      {[0, 1, 2, 3].map(i => <Skeleton key={i} height={52} radius={8} />)}
                    </div>
                  </div>
                ) : result && scoreConfig && (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: "20px", marginBottom: "18px" }}>
                      <ScoreRing score={result.score} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "1.2px", color: scoreConfig.color, textTransform: "uppercase", marginBottom: "6px" }}>
                          {scoreConfig.label}
                        </div>
                        <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)", lineHeight: 1.6, marginBottom: "6px" }}>
                          {scoreConfig.desc}
                        </div>
                        <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.25)", background: "rgba(255,255,255,0.04)", padding: "2px 8px", borderRadius: "4px", display: "inline-block" }}>
                          {result.confidenceBand}
                        </div>
                      </div>
                    </div>
                    {/* Stats */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                      {[
                        { label: "Burstiness", val: result.stats.burstiness.toFixed(2), bad: result.stats.burstiness < 0.2, tip: "Sentence variation — low = AI uniform rhythm" },
                        { label: "Vocab Diversity", val: result.stats.typeTokenRatio.toFixed(2), bad: result.stats.typeTokenRatio < 0.4, tip: "Word variety — low = repetitive word reuse" },
                        { label: "Avg Sentence", val: `${result.stats.avgSentenceLength}w`, bad: result.stats.avgSentenceLength >= 18 && result.stats.avgSentenceLength <= 25, tip: "AI clusters around 18-25 words/sentence" },
                        { label: "Readability", val: result.stats.fleschReadingEase.toFixed(0), bad: result.stats.fleschReadingEase >= 40 && result.stats.fleschReadingEase <= 60, tip: "Flesch score — AI typically scores 40-60" },
                      ].map(({ label, val, bad, tip }) => (
                        <div key={label} title={tip} style={{ background: "rgba(0,0,0,0.25)", borderRadius: "8px", padding: "10px 12px", cursor: "help" }}>
                          <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.28)", marginBottom: "4px" }}>{label}</div>
                          <div style={{ fontSize: "18px", fontWeight: 800, color: bad ? "#f97316" : "#22c55e" }}>{val}</div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Patterns */}
              {analyzing ? (
                <div style={{ background: "#0f0f12", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "12px", padding: "14px", display: "flex", flexDirection: "column", gap: "8px" }}>
                  <Skeleton width="55%" height={11} />
                  {[0, 1, 2].map(i => <Skeleton key={i} height={36} radius={6} style={{ animationDelay: `${i * 0.15}s` }} />)}
                </div>
              ) : result && result.patterns.length > 0 && (
                <div style={{
                  background: "#0f0f12", borderRadius: "12px",
                  border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden",
                  animation: "fadeInUp 0.4s ease 0.1s both",
                }}>
                  <div style={{
                    padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                  }}>
                    <span style={{ fontSize: "12px", fontWeight: 600, color: "rgba(255,255,255,0.65)" }}>AI Patterns Detected</span>
                    <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "4px", background: "rgba(139,92,246,0.1)", color: "#8b5cf6", fontWeight: 700 }}>
                      {result.patterns.length}
                    </span>
                  </div>
                  <div style={{ padding: "6px" }}>
                    {[...result.patterns]
                      .sort((a, b) => ({ critical: 0, high: 1, medium: 2, low: 3 }[a.severity] ?? 4) - ({ critical: 0, high: 1, medium: 2, low: 3 }[b.severity] ?? 4))
                      .slice(0, showAllPatterns ? undefined : 3)
                      .map((p, i) => (
                        <div key={p.id} style={{ opacity: i < visiblePatterns ? 1 : 0, transform: i < visiblePatterns ? "none" : "translateY(6px)", transition: "opacity 0.25s ease, transform 0.25s ease" }}>
                          <PatternCard pattern={p} />
                        </div>
                      ))
                    }
                  </div>
                  {result.patterns.length > 3 && (
                    <button
                      onClick={() => setShowAllPatterns(p => !p)}
                      style={{
                        width: "100%", padding: "9px", background: "rgba(255,255,255,0.02)",
                        border: "none", borderTop: "1px solid rgba(255,255,255,0.05)",
                        color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: "11px",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: "4px",
                      }}
                    >
                      {showAllPatterns ? <><ChevronUp size={11} /> Show less</> : <><ChevronDown size={11} /> +{result.patterns.length - 3} more</>}
                    </button>
                  )}
                </div>
              )}

              {/* Multi-Engine Detection Panel */}
              {result && !analyzing && (
                <div style={{
                  background: "#0f0f12", borderRadius: "12px",
                  border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden",
                  animation: "fadeInUp 0.4s ease 0.15s both",
                }}>
                  <div style={{
                    padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                      <Shield size={13} color="#8b5cf6" />
                      <span style={{ fontSize: "12px", fontWeight: 600, color: "rgba(255,255,255,0.65)" }}>
                        {humanizedEngineScores ? "Updated scores" : "How you score across detectors"}
                      </span>
                    </div>
                  </div>

                  {(userPlan === "PRO" || userPlan === "TEAM") ? (
                    <div style={{ padding: "10px 16px 6px" }}>
                      {(humanizedEngineScores ?? engineScores ?? []).map((es, i) => {
                        const barColor = es.score < 30 ? "#22c55e" : es.score < 60 ? "#eab308" : "#ef4444";
                        const badgeBg = es.status === "PASS" ? "rgba(34,197,94,0.12)" : es.status === "RISKY" ? "rgba(234,179,8,0.1)" : "rgba(239,68,68,0.1)";
                        const badgeColor = es.status === "PASS" ? "#22c55e" : es.status === "RISKY" ? "#eab308" : "#ef4444";
                        return (
                          <div key={es.engine} style={{
                            display: "flex", alignItems: "center", gap: "10px",
                            padding: "8px 0",
                            borderBottom: i < (humanizedEngineScores ?? engineScores ?? []).length - 1 ? "1px solid rgba(255,255,255,0.03)" : "none",
                            animation: `fadeInUp 0.3s ease ${0.05 * i}s both`,
                          }}>
                            <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", width: "90px", flexShrink: 0, fontWeight: 500 }}>{es.engine}</span>
                            <div style={{ flex: 1, height: "6px", borderRadius: "3px", background: "rgba(255,255,255,0.05)", overflow: "hidden" }}>
                              <div style={{
                                width: `${es.score}%`, height: "100%", borderRadius: "3px",
                                background: barColor, transition: "width 0.6s ease",
                              }} />
                            </div>
                            <span style={{ fontSize: "11px", fontWeight: 700, color: barColor, width: "28px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{es.score}</span>
                            <span style={{
                              fontSize: "9px", fontWeight: 700, padding: "2px 6px", borderRadius: "3px",
                              background: badgeBg, color: badgeColor, letterSpacing: "0.5px", width: "38px", textAlign: "center",
                            }}>{es.status}</span>
                          </div>
                        );
                      })}
                      <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.18)", padding: "6px 0 4px", lineHeight: 1.4 }}>
                        Scores are simulated estimates based on our detection algorithm
                      </p>
                    </div>
                  ) : (
                    <div style={{ padding: "20px 16px", textAlign: "center" }}>
                      <Lock size={20} color="rgba(255,255,255,0.15)" style={{ margin: "0 auto 8px" }} />
                      <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", marginBottom: "4px", fontWeight: 500 }}>
                        See how your text scores across 5 AI detectors
                      </p>
                      <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)", marginBottom: "12px" }}>
                        GPTZero · Turnitin · Originality.ai · Copyleaks · Winston AI
                      </p>
                      <button onClick={() => setShowUpgradeModal(true)} style={{
                        padding: "8px 18px", borderRadius: "7px", border: "1px solid rgba(139,92,246,0.3)",
                        background: "rgba(139,92,246,0.1)", color: "#a78bfa",
                        fontSize: "12px", fontWeight: 600, cursor: "pointer",
                      }}>
                        Upgrade to Pro
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Humanize CTA */}
              {result && !humanizing && !isDone && (
                <div style={{
                  background: "#0f0f12", borderRadius: "12px",
                  border: "1px solid rgba(139,92,246,0.15)", padding: "18px",
                  animation: "fadeInUp 0.4s ease 0.2s both",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "6px" }}>
                    <Sparkles size={13} color="#8b5cf6" />
                    <span style={{ fontSize: "13px", fontWeight: 600, color: "#fafafa" }}>Humanize with AI</span>
                  </div>
                  <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", lineHeight: 1.6, marginBottom: "14px" }}>
                    Multi-pass rewrite · 3 attempts · picks the best result
                  </p>
                  <button
                    onClick={() => void handleHumanize()}
                    style={{
                      width: "100%", padding: "13px", borderRadius: "10px", border: "none",
                      background: "linear-gradient(135deg, #8b5cf6, #7c3aed)",
                      color: "#fff", fontSize: "14px", fontWeight: 700, cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                      boxShadow: "0 4px 20px rgba(139,92,246,0.3)", transition: "all 0.2s",
                    }}
                  >
                    <Sparkles size={14} /> {scoreConfig?.ctaLabel ?? "Humanize"} <ArrowRight size={12} />
                  </button>
                </div>
              )}

              {/* Re-humanize after done */}
              {isDone && result && (
                <button
                  onClick={() => void handleHumanize()}
                  style={{
                    width: "100%", padding: "11px", borderRadius: "10px", border: "1px solid rgba(139,92,246,0.2)",
                    background: "rgba(139,92,246,0.08)", color: "#a78bfa",
                    fontSize: "13px", fontWeight: 600, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                    animation: "fadeInUp 0.3s ease",
                  }}
                >
                  <RotateCcw size={12} /> Humanize again
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
      <UpgradeModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} currentPlan="FREE" />

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes shimmer { 0%,100% { background-position: 200% center; } 50% { background-position: 0% center; } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes popIn { from { opacity:0; transform: scale(0.8); } to { opacity:1; transform: scale(1); } }
        @keyframes scanAnim { 0% { background-position: 200% center; } 100% { background-position: -200% center; } }
        @keyframes pulse { 0%,100% { opacity:0.4; } 50% { opacity:1; } }
        @keyframes orb1 { 0%,100% { transform: translate(0,0); } 50% { transform: translate(8px,-10px); } }
        @keyframes orb2 { 0%,100% { transform: translate(0,0); } 50% { transform: translate(-10px,7px); } }
        @keyframes orb3 { 0%,100% { transform: translate(0,0); } 50% { transform: translate(7px,10px); } }
        @keyframes passGlow { 0%,100% { opacity:0.3; } 50% { opacity:1; border-color: rgba(139,92,246,0.5); } }
        @keyframes dotBlink { 0%,100% { opacity:0; } 50% { opacity:1; } }
        .dots span { animation: dotBlink 1.4s infinite; }
        .dots span:nth-child(2) { animation-delay: 0.2s; }
        .dots span:nth-child(3) { animation-delay: 0.4s; }
        .scan-bar { animation: scanAnim 1.8s linear infinite; }
        .scan-pulse { width: 6px; height: 6px; border-radius: 50%; background: #8b5cf6; animation: pulse 1s ease-in-out infinite; }
        .spin-sm { width: 12px; height: 12px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.2); border-top-color: #fff; animation: spin 0.7s linear infinite; display: inline-block; flex-shrink: 0; }
        @media (max-width: 900px) { .editor-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  );
}
