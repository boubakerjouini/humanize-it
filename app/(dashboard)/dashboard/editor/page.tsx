"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import { usePostHog } from "posthog-js/react";
import { PatternCard } from "@/components/ui/pattern-card";
import { AuthModal } from "@/components/ui/auth-modal";
import { UpgradeModal } from "@/components/ui/upgrade-modal";
import type { PatternHit } from "@/lib/algorithms/analyzeText";
import { Loader2, Copy, RotateCcw, ChevronDown, ChevronUp, Zap, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

type ToneOption = "standard" | "formal" | "casual" | "academic";
type Step = "input" | "results" | "humanizing" | "done";

interface AnalyzeResponse {
  score: number;
  confidenceBand: string;
  patterns: PatternHit[];
  stats: {
    burstiness: number;
    typeTokenRatio: number;
    avgSentenceLength: number;
    fleschReadingEase: number;
  };
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
  if (score >= 75) return {
    label: "FLAGGED AS AI",
    desc: "Will be caught by GPTZero, Turnitin, and Originality.ai",
    action: "Fix this before submitting",
    color: "#ef4444",
    dimColor: "rgba(239,68,68,0.12)",
    border: "rgba(239,68,68,0.25)",
    ctaLabel: "✨ Fix it — Humanize now →",
  };
  if (score >= 50) return {
    label: "LIKELY AI",
    desc: "Most detectors will flag this text",
    action: "Humanize to pass safely",
    color: "#f97316",
    dimColor: "rgba(249,115,22,0.10)",
    border: "rgba(249,115,22,0.25)",
    ctaLabel: "✨ Humanize to reduce risk →",
  };
  if (score >= 30) return {
    label: "BORDERLINE",
    desc: "Some detectors may flag this",
    action: "Lower your score to be safe",
    color: "#eab308",
    dimColor: "rgba(234,179,8,0.08)",
    border: "rgba(234,179,8,0.2)",
    ctaLabel: "✨ Polish to pass safely →",
  };
  return {
    label: "LOOKS HUMAN ✓",
    desc: "Should pass most AI detectors",
    action: "Want to be 100% sure?",
    color: "#22c55e",
    dimColor: "rgba(34,197,94,0.08)",
    border: "rgba(34,197,94,0.2)",
    ctaLabel: "✨ Polish it further →",
  };
}

export default function EditorPage() {
  const { isSignedIn } = useAuth();
  const posthog = usePostHog();
  const [step, setStep] = useState<Step>("input");
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Pre-fill from sessionStorage
  useEffect(() => {
    const prefill = sessionStorage.getItem("prefill-text");
    if (prefill) {
      setText(prefill);
      sessionStorage.removeItem("prefill-text");
    }
  }, []);

  // ESC closes modals
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setShowAuthModal(false); setShowUpgradeModal(false); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const canAnalyze = text.trim().length >= 10 && !analyzing;
  const scoreConfig = result ? getScoreConfig(result.score) : null;

  const handleAnalyze = useCallback(async () => {
    if (!canAnalyze) return;
    posthog?.capture("analyze_clicked", { word_count: wordCount, char_count: text.length });
    setAnalyzing(true);
    setResult(null);
    setHumanizedText(null);
    setHumanizedScore(null);
    setShowAllPatterns(false);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json() as AnalyzeResponse & { error?: { message: string } };
      if (res.status === 402) { posthog?.capture("upgrade_modal_opened", { trigger: "analyze_quota" }); setShowUpgradeModal(true); return; }
      if (!res.ok) { toast.error(data.error?.message ?? "Analysis failed."); return; }
      setResult(data);
      setStep("results");
      posthog?.capture("analysis_completed", { score: data.score, confidence_band: data.confidenceBand, pattern_count: data.patterns.length, word_count: data.wordCount });
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setAnalyzing(false);
    }
  }, [text, canAnalyze]);

  const handleHumanize = useCallback(async () => {
    if (!result) return;
    if (!isSignedIn) { posthog?.capture("auth_modal_opened", { trigger: "humanize_cta" }); setShowAuthModal(true); return; }
    posthog?.capture("humanize_clicked", { tone, score: result.score, pattern_count: result.patterns.length });
    setHumanizing(true);
    setStep("humanizing");

    try {
      const res = await fetch("/api/humanize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: result.documentId, tone }),
      });
      const data = await res.json() as { humanizedText?: string; error?: { message: string } };
      if (res.status === 402) { posthog?.capture("upgrade_modal_opened", { trigger: "humanize_quota" }); setShowUpgradeModal(true); setStep("results"); return; }
      if (!res.ok) { toast.error(data.error?.message ?? "Humanization failed."); setStep("results"); return; }

      setHumanizedText(data.humanizedText ?? null);

      // Re-analyze humanized text
      if (data.humanizedText) {
        try {
          const reRes = await fetch("/api/analyze", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: data.humanizedText }),
          });
          if (reRes.ok) {
            const reData = await reRes.json() as AnalyzeResponse;
            setHumanizedScore(reData.score);
          }
        } catch { /* ignore */ }
      }
      setStep("done");
      toast.success("Humanized successfully!");
      posthog?.capture("humanize_completed", { tone, original_score: result.score });
    } catch {
      toast.error("Network error. Please try again.");
      setStep("results");
    } finally {
      setHumanizing(false);
    }
  }, [result, tone, isSignedIn]);

  const handleCopy = useCallback(async () => {
    if (!humanizedText) return;
    await navigator.clipboard.writeText(humanizedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Copied to clipboard!");
    posthog?.capture("text_copied", { humanized_score: humanizedScore, original_score: result?.score });
  }, [humanizedText, humanizedScore, result, posthog]);

  const handleReset = () => {
    posthog?.capture("new_analysis_started", { previous_score: result?.score });
    setStep("input");
    setResult(null);
    setHumanizedText(null);
    setHumanizedScore(null);
    setTimeout(() => textareaRef.current?.focus(), 100);
  };

  return (
    <div style={{ minHeight: "100%", background: "#09090b", display: "flex", flexDirection: "column" }}>

      {/* ── Step indicator ── */}
      <div style={{
        padding: "14px 24px",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexShrink: 0,
      }}>
        {/* Steps */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          {[
            { key: "input", label: "1. Paste", active: step === "input" },
            { key: "results", label: "2. Results", active: step === "results" },
            { key: "done", label: "3. Humanized", active: step === "humanizing" || step === "done" },
          ].map(({ key, label, active }, i) => {
            const past = (key === "input" && step !== "input") ||
              (key === "results" && (step === "humanizing" || step === "done"));
            return (
              <div key={key} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                {i > 0 && <div style={{ width: "20px", height: "1px", background: "rgba(255,255,255,0.1)" }} />}
                <div style={{
                  fontSize: "12px", fontWeight: active || past ? 600 : 400,
                  color: past ? "#22c55e" : active ? "#a78bfa" : "rgba(255,255,255,0.25)",
                  display: "flex", alignItems: "center", gap: "4px",
                }}>
                  {past && <CheckCircle2 size={11} />}
                  {label}
                </div>
              </div>
            );
          })}
        </div>

        {/* Reset */}
        {step !== "input" && (
          <button onClick={handleReset} style={{
            display: "flex", alignItems: "center", gap: "5px",
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "6px", padding: "5px 10px", color: "rgba(255,255,255,0.4)",
            cursor: "pointer", fontSize: "11px", fontWeight: 500,
          }}>
            <RotateCcw size={11} /> New analysis
          </button>
        )}
      </div>

      {/* ── Main grid ── */}
      <div style={{ flex: 1, padding: "20px 24px" }}>
        <div
          className="editor-main-grid"
          style={{
            display: "grid",
            gridTemplateColumns: result ? "1fr 1fr" : "1fr",
            gap: "20px",
            maxWidth: result ? "1100px" : "720px",
            margin: "0 auto",
          }}
        >
          {/* ── LEFT: Input + humanized output ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

            {/* Textarea card */}
            <div style={{
              background: "#0f0f12", borderRadius: "12px",
              border: "1px solid rgba(255,255,255,0.07)",
              overflow: "hidden",
            }}>
              {/* Toolbar dots */}
              <div style={{
                padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)",
                display: "flex", alignItems: "center", gap: "6px",
              }}>
                {["#ef4444", "#7c3aed", "#22c55e"].map(c => (
                  <div key={c} style={{ width: "8px", height: "8px", borderRadius: "50%", background: c, opacity: 0.5 }} />
                ))}
                <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.15)", marginLeft: "8px", fontFamily: "monospace" }}>
                  your text
                </span>
              </div>

              <textarea
                ref={textareaRef}
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder={"Paste your AI-generated text here…\n\nTip: try something that starts with \"In today's rapidly evolving landscape\" or uses words like \"furthermore\", \"pivotal\", \"paradigm\"…"}
                style={{
                  width: "100%", minHeight: "260px", padding: "16px",
                  background: "transparent", border: "none", outline: "none",
                  resize: "vertical", color: "#fafafa", fontSize: "14px",
                  lineHeight: 1.8, fontFamily: "inherit", boxSizing: "border-box",
                  display: "block",
                }}
              />

              {/* Bottom toolbar */}
              <div style={{
                padding: "10px 16px", borderTop: "1px solid rgba(255,255,255,0.05)",
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px",
              }}>
                <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.2)" }}>
                  {wordCount > 0 ? (
                    <>
                      {wordCount} words
                      {text.length > 8000 && (
                        <span style={{ marginLeft: "8px", color: text.length > 9500 ? "#ef4444" : "#eab308" }}>
                          · {text.length}/10,000 chars
                        </span>
                      )}
                    </>
                  ) : "Min. 10 characters to analyze"}
                </span>

                <button
                  onClick={handleAnalyze}
                  disabled={!canAnalyze}
                  style={{
                    display: "flex", alignItems: "center", gap: "6px",
                    padding: "8px 18px", borderRadius: "7px", border: "none",
                    background: canAnalyze ? "#8b5cf6" : "rgba(139,92,246,0.15)",
                    color: canAnalyze ? "#fafafa" : "rgba(255,255,255,0.25)",
                    fontSize: "13px", fontWeight: 700,
                    cursor: canAnalyze ? "pointer" : "not-allowed",
                    transition: "all 0.15s", flexShrink: 0,
                  }}
                >
                  {analyzing
                    ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Analyzing…</>
                    : <><Zap size={13} /> {result ? "Re-analyze" : "Analyze →"}</>
                  }
                </button>
              </div>
            </div>

            {/* Humanized output (step: done) */}
            {step === "done" && humanizedText && (
              <div style={{
                background: "#0f0f12", borderRadius: "12px",
                border: "1px solid rgba(34,197,94,0.2)", overflow: "hidden",
              }}>
                <div style={{
                  padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "12px", fontWeight: 600, color: "#22c55e" }}>
                      ✓ Humanized text
                    </span>
                    {humanizedScore !== null && (
                      <span style={{
                        fontSize: "11px", padding: "2px 8px", borderRadius: "4px", fontWeight: 700,
                        background: humanizedScore < 30 ? "rgba(34,197,94,0.12)" : "rgba(249,115,22,0.12)",
                        color: humanizedScore < 30 ? "#22c55e" : "#f97316",
                      }}>
                        {Math.round(humanizedScore)}% AI
                      </span>
                    )}
                  </div>
                  <button onClick={handleCopy} style={{
                    display: "flex", alignItems: "center", gap: "5px",
                    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "5px", padding: "5px 10px", cursor: "pointer",
                    color: copied ? "#22c55e" : "rgba(255,255,255,0.5)", fontSize: "11px",
                  }}>
                    <Copy size={11} /> {copied ? "Copied!" : "Copy text"}
                  </button>
                </div>
                <div style={{
                  padding: "16px", fontSize: "14px", lineHeight: 1.8,
                  color: "rgba(255,255,255,0.85)", whiteSpace: "pre-wrap",
                  maxHeight: "360px", overflow: "auto",
                }}>
                  {humanizedText}
                </div>
                <div style={{
                  padding: "10px 16px", borderTop: "1px solid rgba(255,255,255,0.05)",
                  display: "flex", gap: "8px",
                }}>
                  {TONES.map(({ value, label }) => (
                    <button key={value} onClick={() => { setTone(value); void handleHumanize(); }}
                      style={{
                        padding: "5px 10px", borderRadius: "5px", fontSize: "11px",
                        background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)",
                        color: "rgba(255,255,255,0.35)", cursor: "pointer",
                      }}>
                      {label}
                    </button>
                  ))}
                  <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.2)", alignSelf: "center", marginLeft: "4px" }}>← try another tone</span>
                </div>
              </div>
            )}
          </div>

          {/* ── RIGHT: Score + Patterns + CTA ── */}
          {result && scoreConfig && (
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

              {/* Score card */}
              <div style={{
                background: scoreConfig.dimColor,
                border: `1px solid ${scoreConfig.border}`,
                borderRadius: "12px", padding: "24px",
              }}>
                {/* Score number */}
                <div style={{ display: "flex", alignItems: "baseline", gap: "6px", marginBottom: "10px" }}>
                  <div style={{
                    fontSize: "80px", fontWeight: 900, lineHeight: 1,
                    color: scoreConfig.color, letterSpacing: "-4px",
                    fontVariantNumeric: "tabular-nums",
                  }}>
                    {Math.round(result.score)}
                  </div>
                  <div style={{ fontSize: "18px", color: "rgba(255,255,255,0.25)", paddingBottom: "10px" }}>/100</div>
                </div>

                {/* Label */}
                <div style={{
                  fontSize: "11px", fontWeight: 800, letterSpacing: "1.5px",
                  color: scoreConfig.color, textTransform: "uppercase", marginBottom: "6px",
                }}>
                  {scoreConfig.label}
                </div>
                <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.5)", lineHeight: 1.5, marginBottom: "2px" }}>
                  {scoreConfig.desc}
                </div>
                <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.25)", fontStyle: "italic" }}>
                  {scoreConfig.action}
                </div>

                {/* Bar */}
                <div style={{ marginTop: "16px", height: "3px", background: "rgba(255,255,255,0.06)", borderRadius: "2px" }}>
                  <div style={{
                    height: "3px", borderRadius: "2px",
                    background: `linear-gradient(90deg, ${scoreConfig.color}60, ${scoreConfig.color})`,
                    width: `${result.score}%`, transition: "width 1s ease",
                  }} />
                </div>

                {/* Stats row */}
                <div style={{
                  marginTop: "16px", display: "grid", gridTemplateColumns: "1fr 1fr",
                  gap: "8px",
                }}>
                  {[
                    { label: "Burstiness", val: result.stats.burstiness.toFixed(2), bad: result.stats.burstiness < 0.2, tip: "Sentence variation (low = AI)" },
                    { label: "Vocab Diversity", val: result.stats.typeTokenRatio.toFixed(2), bad: result.stats.typeTokenRatio < 0.4, tip: "Word variety (low = repetitive)" },
                    { label: "Avg Sentence", val: `${result.stats.avgSentenceLength}w`, bad: result.stats.avgSentenceLength >= 18 && result.stats.avgSentenceLength <= 25, tip: "AI clusters 18-25 words/sentence" },
                    { label: "Readability", val: result.stats.fleschReadingEase.toFixed(0), bad: result.stats.fleschReadingEase >= 40 && result.stats.fleschReadingEase <= 60, tip: "Flesch score (AI: 40-60 range)" },
                  ].map(({ label, val, bad, tip }) => (
                    <div key={label} title={tip} style={{
                      background: "rgba(0,0,0,0.2)", borderRadius: "6px", padding: "8px 10px",
                      cursor: "help",
                    }}>
                      <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", marginBottom: "2px" }}>{label}</div>
                      <div style={{
                        fontSize: "15px", fontWeight: 700,
                        color: bad ? "#f97316" : "#22c55e",
                      }}>{val}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Patterns */}
              {result.patterns.length > 0 && (
                <div style={{
                  background: "#0f0f12", borderRadius: "12px",
                  border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden",
                }}>
                  <div style={{
                    padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                  }}>
                    <span style={{ fontSize: "12px", fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>
                      AI Patterns Detected
                    </span>
                    <span style={{
                      fontSize: "11px", padding: "2px 8px", borderRadius: "4px",
                      background: "rgba(139,92,246,0.12)", color: "#8b5cf6", fontWeight: 700,
                    }}>
                      {result.patterns.length} found
                    </span>
                  </div>
                  <div style={{ padding: "8px" }}>
                    {[...result.patterns]
                      .sort((a, b) => {
                        const o: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
                        return (o[a.severity] ?? 4) - (o[b.severity] ?? 4);
                      })
                      .slice(0, showAllPatterns ? undefined : 3)
                      .map(p => <PatternCard key={p.id} pattern={p} />)
                    }
                  </div>
                  {result.patterns.length > 3 && (
                    <button
                      onClick={() => { const next = !showAllPatterns; setShowAllPatterns(next); if (next) posthog?.capture("patterns_expanded", { pattern_count: result?.patterns.length }); }}
                      style={{
                        width: "100%", padding: "10px",
                        background: "rgba(255,255,255,0.02)",
                        border: "none", borderTop: "1px solid rgba(255,255,255,0.05)",
                        color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: "12px",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: "5px",
                      }}
                    >
                      {showAllPatterns
                        ? <><ChevronUp size={12} /> Show less</>
                        : <><ChevronDown size={12} /> +{result.patterns.length - 3} more patterns</>
                      }
                    </button>
                  )}
                </div>
              )}

              {/* Humanize CTA */}
              {step !== "done" && (
                <div id="humanize-section" style={{
                  background: "#0f0f12", borderRadius: "12px",
                  border: "1px solid rgba(139,92,246,0.15)", padding: "20px",
                }}>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "#fafafa", marginBottom: "4px" }}>
                    ✨ Humanize with AI
                  </div>
                  <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.3)", lineHeight: 1.6, marginBottom: "14px" }}>
                    Multi-pass rewrite engine. 3 attempts, picks the best result.
                    Targets your exact patterns.
                  </div>

                  {/* Tone tabs */}
                  <div style={{ display: "flex", gap: "6px", marginBottom: "14px", flexWrap: "wrap" }}>
                    {TONES.map(({ value, label }) => (
                      <button key={value} onClick={() => setTone(value)} style={{
                        padding: "6px 12px", borderRadius: "6px", fontSize: "12px", fontWeight: 500,
                        cursor: "pointer", border: "1px solid",
                        borderColor: tone === value ? "#8b5cf6" : "rgba(255,255,255,0.08)",
                        background: tone === value ? "rgba(139,92,246,0.12)" : "transparent",
                        color: tone === value ? "#8b5cf6" : "rgba(255,255,255,0.35)",
                        transition: "all 0.15s",
                      }}>
                        {label}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => void handleHumanize()}
                    disabled={humanizing}
                    style={{
                      width: "100%", padding: "13px", borderRadius: "8px", border: "none",
                      background: humanizing ? "rgba(139,92,246,0.2)" : "linear-gradient(135deg, #8b5cf6, #7c3aed)",
                      color: humanizing ? "rgba(255,255,255,0.4)" : "#fafafa",
                      fontSize: "14px", fontWeight: 700,
                      cursor: humanizing ? "not-allowed" : "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                      transition: "all 0.15s", letterSpacing: "0.2px",
                    }}
                  >
                    {humanizing
                      ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> AI is rewriting…</>
                      : scoreConfig.ctaLabel
                    }
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
      <UpgradeModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} currentPlan="FREE" />

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @media (max-width: 768px) {
          .editor-main-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
