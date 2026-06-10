"use client";

import { useState } from "react";
import Link from "next/link";
import { analyzeText, type AnalysisResult } from "@/lib/algorithms/analyzeText";
import { ScoreRing } from "@/components/ui/score-ring";
import { THEME, glow } from "@/lib/theme";

const SEVERITY_COLOR: Record<string, string> = {
  high: THEME.warn,
  medium: THEME.accent,
  low: THEME.brandHi,
};

interface DeepScan {
  aiLikelihood: number;
  confidence: "low" | "medium" | "high";
  verdict: string;
  signals: string[];
  reasoning: string;
  remainingToday?: number;
}

/** API word floor for a reliable deep scan — mirrors app/api/detect MIN_WORDS. */
const DEEP_MIN_WORDS = 25;

/**
 * Free, no-signup AI detector. Runs the same 40-pattern analyzeText() engine
 * the product uses — entirely client-side, so there is zero server/LLM cost and
 * pasted text never leaves the browser. Shows the full transparent breakdown
 * competitors hide, then converts to the humanizer / signup.
 */
export function DetectorTool({ ctaHref = "/free-ai-humanizer" }: { ctaHref?: string }) {
  const [text, setText] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [deep, setDeep] = useState<DeepScan | null>(null);
  const [deepLoading, setDeepLoading] = useState(false);
  const [deepError, setDeepError] = useState<string | null>(null);

  const words = text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;
  const canAnalyze = words >= 5;
  const triggered = result?.patterns.filter((p) => p.hits > 0) ?? [];

  function runInstant() {
    setDeep(null);
    setDeepError(null);
    setResult(canAnalyze ? analyzeText(text) : null);
  }

  async function runDeepScan() {
    if (words < DEEP_MIN_WORDS || deepLoading) return;
    setDeepLoading(true);
    setDeepError(null);
    try {
      const res = await fetch("/api/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDeepError(data?.error?.message ?? "Deep scan failed. Please try again.");
        return;
      }
      setDeep(data as DeepScan);
    } catch {
      setDeepError("Couldn't reach the deep scan. Check your connection and try again.");
    } finally {
      setDeepLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div style={{ background: THEME.surface2, border: `1px solid ${THEME.border}`, borderRadius: THEME.radiusLg, padding: "18px" }}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste any text to check it for AI-detection patterns…"
          aria-label="Text to analyze for AI patterns"
          style={{
            width: "100%", minHeight: "180px", background: "transparent", border: "none",
            outline: "none", resize: "vertical", fontSize: "15px", color: THEME.text, lineHeight: 1.7,
            fontFamily: THEME.fontSans,
          }}
        />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "12px", flexWrap: "wrap", gap: "10px" }}>
          <span style={{ fontSize: "13px", color: THEME.textMuted }}>{words} words</span>
          <button
            onClick={runInstant}
            disabled={!canAnalyze}
            style={{
              background: canAnalyze ? THEME.brand : THEME.border,
              color: "#fff", fontSize: "14px", fontWeight: 600, padding: "9px 22px",
              borderRadius: THEME.radius, border: "none", cursor: canAnalyze ? "pointer" : "not-allowed",
              fontFamily: THEME.fontSans,
            }}
          >
            Check for AI &rarr;
          </button>
        </div>
      </div>

      {result && (
        <div style={{ background: THEME.surface1, border: `1px solid ${THEME.border}`, borderRadius: THEME.radiusLg, padding: "24px" }}>
          <div style={{ display: "flex", gap: "28px", alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
            <ScoreRing score={result.score} size={130} />
            <div style={{ flex: "1 1 240px", minWidth: "240px" }}>
              <div style={{ fontSize: "13px", color: THEME.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>
                Instant AI-likelihood: {result.score}/100
              </div>
              <p style={{ fontSize: "15px", color: THEME.textDim, lineHeight: 1.6, margin: "0 0 14px" }}>
                {triggered.length === 0
                  ? "No strong AI patterns detected in the instant scan. For a precise verdict, run a deep scan."
                  : `Found ${triggered.length} AI-pattern ${triggered.length === 1 ? "signal" : "signals"}. Humanize to reduce them.`}
              </p>
              <Link
                href={ctaHref}
                style={{
                  display: "inline-block", background: THEME.gradient, color: "#fff", fontWeight: 700,
                  fontSize: "14px", padding: "10px 22px", borderRadius: THEME.radius, textDecoration: "none",
                  boxShadow: glow(THEME.brand, 0.3),
                }}
              >
                Humanize this text free &rarr;
              </Link>
            </div>
          </div>

          {/* Deep scan — the precise LLM verdict for the uncertain cases the
              instant heuristic can't separate (adversarial / creative AI). */}
          <div style={{ marginTop: "22px", borderTop: `1px solid ${THEME.border}`, paddingTop: "18px" }}>
            {!deep && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
                <div style={{ flex: "1 1 260px" }}>
                  <div style={{ fontSize: "14px", fontWeight: 600, color: THEME.text }}>Deep scan</div>
                  <div style={{ fontSize: "13px", color: THEME.textMuted, lineHeight: 1.5 }}>
                    The instant score is a heuristic preview. Run an AI-powered deep scan for a precise, calibrated verdict.
                  </div>
                </div>
                <button
                  onClick={runDeepScan}
                  disabled={deepLoading || words < DEEP_MIN_WORDS}
                  title={words < DEEP_MIN_WORDS ? `Paste at least ${DEEP_MIN_WORDS} words for a deep scan` : undefined}
                  style={{
                    background: deepLoading || words < DEEP_MIN_WORDS ? THEME.border : THEME.brand,
                    color: "#fff", fontSize: "14px", fontWeight: 600, padding: "9px 22px",
                    borderRadius: THEME.radius, border: "none",
                    cursor: deepLoading || words < DEEP_MIN_WORDS ? "not-allowed" : "pointer", fontFamily: THEME.fontSans,
                    whiteSpace: "nowrap",
                  }}
                >
                  {deepLoading ? "Scanning…" : "Run deep scan"}
                </button>
              </div>
            )}

            {deepError && (
              <p style={{ fontSize: "13px", color: THEME.warn, margin: "10px 0 0" }}>{deepError}</p>
            )}

            {deep && (
              <div>
                <div style={{ display: "flex", gap: "28px", alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
                  <ScoreRing score={deep.aiLikelihood} size={120} />
                  <div style={{ flex: "1 1 260px", minWidth: "240px" }}>
                    <div style={{ fontSize: "12px", color: THEME.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px" }}>
                      Deep scan · AI-likelihood {deep.aiLikelihood}/100 · {deep.confidence} confidence
                    </div>
                    <div style={{ fontSize: "17px", fontWeight: 700, color: deep.aiLikelihood >= 55 ? THEME.warn : deep.aiLikelihood <= 30 ? THEME.human : THEME.accent, marginBottom: "8px" }}>
                      {deep.verdict}
                    </div>
                    {deep.reasoning && (
                      <p style={{ fontSize: "14px", color: THEME.textDim, lineHeight: 1.6, margin: 0 }}>{deep.reasoning}</p>
                    )}
                  </div>
                </div>
                {deep.signals.length > 0 && (
                  <div style={{ marginTop: "16px" }}>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: THEME.text, marginBottom: "10px" }}>What the deep scan weighed</div>
                    <ul style={{ margin: 0, paddingLeft: "18px", display: "flex", flexDirection: "column", gap: "6px" }}>
                      {deep.signals.map((s, i) => (
                        <li key={i} style={{ fontSize: "13px", color: THEME.textDim, lineHeight: 1.5 }}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          {triggered.length > 0 && (
            <div style={{ marginTop: "22px", borderTop: `1px solid ${THEME.border}`, paddingTop: "18px" }}>
              <div style={{ fontSize: "13px", fontWeight: 600, color: THEME.text, marginBottom: "12px" }}>
                Detected patterns
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {triggered
                  .slice()
                  .sort((a, b) => b.weight - a.weight)
                  .map((p) => (
                    <span
                      key={p.id}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: "8px", fontSize: "13px",
                        color: THEME.textDim, background: THEME.surface2, border: `1px solid ${THEME.border}`,
                        padding: "6px 12px", borderRadius: "999px",
                      }}
                    >
                      <span aria-hidden="true" style={{ width: "7px", height: "7px", borderRadius: "50%", background: SEVERITY_COLOR[p.severity] ?? THEME.brandHi }} />
                      {p.label}
                      <span style={{ color: THEME.textMuted }}>×{p.hits}</span>
                    </span>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
