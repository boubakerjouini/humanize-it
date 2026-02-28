"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { Loader2, Copy } from "lucide-react";
import { ScoreRing } from "@/components/ui/score-ring";
import { PatternCard } from "@/components/ui/pattern-card";
import type { AnalysisResult, PatternHit } from "@/lib/algorithms/analyzeText";

// ── Types ──────────────────────────────────────────────────────────────────

interface AnalyzeResponse {
  score: number;
  patterns: PatternHit[];
  stats: AnalysisResult["stats"];
  wordCount: number;
  documentId: string;
}

type ToneOption = "standard" | "formal" | "casual" | "academic";

const TONE_OPTIONS: { value: ToneOption; label: string }[] = [
  { value: "standard",  label: "Standard"  },
  { value: "formal",    label: "Formal"    },
  { value: "casual",    label: "Casual"    },
  { value: "academic",  label: "Academic"  },
];

// ── Score helpers ──────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 80) return "#ef4444";
  if (score >= 61) return "#8b5cf6";
  if (score >= 31) return "#a78bfa";
  return "#22c55e";
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

// ── Stat pill ──────────────────────────────────────────────────────────────

function StatPill({ label, value, warn }: { label: string; value: string | number; warn: boolean }) {
  return (
    <div style={{
      background: "#0f0f12", border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: "6px", padding: "12px 14px", flex: 1,
    }}>
      <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", marginBottom: "6px", letterSpacing: "0.3px" }}>{label}</div>
      <div style={{ fontSize: "18px", fontWeight: 700, color: warn ? "#8b5cf6" : "#22c55e", fontFamily: "var(--font-geist-mono), monospace" }}>
        {value}
      </div>
      <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.25)", marginTop: "3px" }}>
        {warn ? "⚠ AI range" : "✓ Normal"}
      </div>
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

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;

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
            }}>
              <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.25)", fontFamily: "var(--font-geist-mono), monospace" }}>
                {wordCount.toLocaleString()} words · {text.length.toLocaleString()} / 10,000
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
                    <><Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> Analyzing…</>
                  ) : (
                    "Analyze →"
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

              {/* Stats row */}
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

            </>
          ) : (
            <div style={{
              background: "#0f0f12", border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: "8px", padding: "48px 24px",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              flex: 1,
            }}>
              <div style={{ fontSize: "36px", marginBottom: "12px", opacity: 0.2 }}>⚡</div>
              <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.25)", textAlign: "center" }}>
                Your score will appear<br />here after analysis.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Pattern cards ── */}
      {result && result.patterns.length > 0 && (
        <div style={{ marginTop: "16px" }}>
          <div style={{
            background: "#0f0f12", border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: "8px", padding: "20px",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
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
        <div style={{ marginTop: "16px" }}>
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
                      padding: "7px 14px", borderRadius: "5px", fontSize: "12px", fontWeight: 500,
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
                <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> AI is rewriting your text…</>
              ) : (
                "Humanize with AI →"
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
                <div style={{ display: "flex", gap: "8px", marginTop: "14px" }}>
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
                    Re-analyze →
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

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
