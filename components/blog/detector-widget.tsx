"use client";

import { useState } from "react";
import { analyzeText } from "@/lib/algorithms/analyzeText";
import type { AnalysisResult, PatternHit } from "@/lib/algorithms/analyzeText";
import { ScoreRing } from "@/components/ui/score-ring";
import { THEME } from "@/lib/theme";

export function DetectorWidget() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);

  function handleAnalyze() {
    if (!text.trim() || text.trim().split(/\s+/).length < 30) return;
    setLoading(true);
    // Use setTimeout to avoid blocking the UI during analysis
    setTimeout(() => {
      const r = analyzeText(text);
      setResult(r);
      setLoading(false);
    }, 50);
  }

  const topPatterns: PatternHit[] = result
    ? result.patterns.sort((a, b) => b.weight - a.weight).slice(0, 5)
    : [];

  return (
    <div
      style={{
        border: `1px solid ${THEME.border}`,
        borderRadius: THEME.radiusLg,
        background: THEME.surface1,
        padding: "24px",
        margin: "32px 0",
      }}
    >
      <div className="kicker" style={{ marginBottom: "12px" }}>
        TRY IT — PASTE ANY TEXT
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste your text here (minimum 30 words)..."
        aria-label="Text to analyze for AI detection"
        style={{
          width: "100%",
          minHeight: "120px",
          background: THEME.bg,
          border: `1px solid ${THEME.border}`,
          borderRadius: THEME.radius,
          padding: "12px 14px",
          color: THEME.text,
          fontSize: "14px",
          lineHeight: 1.6,
          resize: "vertical",
          fontFamily: THEME.fontSans,
        }}
      />
      <button
        onClick={handleAnalyze}
        disabled={loading || text.trim().split(/\s+/).length < 30}
        style={{
          marginTop: "12px",
          background: THEME.brand,
          color: "#fff",
          border: "none",
          borderRadius: THEME.radius,
          padding: "10px 24px",
          fontSize: "14px",
          fontWeight: 600,
          cursor: loading ? "wait" : "pointer",
          opacity: loading || text.trim().split(/\s+/).length < 30 ? 0.5 : 1,
        }}
      >
        {loading ? "Analyzing..." : "Analyze →"}
      </button>

      {result && (
        <div style={{ marginTop: "24px" }} aria-live="polite">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "20px",
              marginBottom: "20px",
              flexWrap: "wrap",
            }}
          >
            <ScoreRing score={result.score} size={120} />
            <div style={{ minWidth: "180px" }}>
              <div
                style={{
                  fontSize: "12px",
                  color: THEME.textDim,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  fontFamily: THEME.fontMono,
                  marginBottom: "6px",
                }}
              >
                Human Score
              </div>
              <div style={{ fontSize: "13px", color: THEME.textDim, lineHeight: 1.6 }}>
                Higher is more human. We humanize text to push this score up and the
                AI-detection score down.
              </div>
            </div>
          </div>

          {topPatterns.length > 0 && (
            <div>
              <div
                style={{
                  fontSize: "12px",
                  color: THEME.textDim,
                  marginBottom: "8px",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  fontFamily: THEME.fontMono,
                }}
              >
                Top Triggered Patterns
              </div>
              {topPatterns.map((p) => (
                <div
                  key={p.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 0",
                    borderBottom: `1px solid ${THEME.border}`,
                    fontSize: "13px",
                  }}
                >
                  <span style={{ color: THEME.text }}>{p.label}</span>
                  <span
                    style={{
                      fontSize: "11px",
                      padding: "2px 8px",
                      borderRadius: "4px",
                      fontFamily: THEME.fontMono,
                      background:
                        p.severity === "critical"
                          ? THEME.aiDim
                          : p.severity === "high"
                            ? THEME.warnDim
                            : THEME.surface3,
                      color:
                        p.severity === "critical"
                          ? THEME.ai
                          : p.severity === "high"
                            ? THEME.warn
                            : THEME.textDim,
                    }}
                  >
                    {p.severity}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div
        style={{
          marginTop: "16px",
          paddingTop: "12px",
          borderTop: `1px solid ${THEME.border}`,
          fontSize: "13px",
          color: THEME.textMuted,
        }}
      >
        Get full analysis + humanization at{" "}
        <a href="/" style={{ color: THEME.brandHi, textDecoration: "none" }}>
          humanizeit.app &rarr;
        </a>
      </div>
    </div>
  );
}
