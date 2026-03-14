"use client";

import { useState } from "react";
import { analyzeText } from "@/lib/algorithms/analyzeText";
import type { AnalysisResult, PatternHit } from "@/lib/algorithms/analyzeText";

function scoreColor(s: number): string {
  if (s >= 75) return "#dc2626";
  if (s >= 50) return "#f97316";
  if (s >= 25) return "#eab308";
  return "#16a34a";
}

function scoreLabel(s: number): string {
  if (s >= 75) return "Likely AI";
  if (s >= 50) return "Possibly AI";
  if (s >= 25) return "Borderline";
  return "Looks Human";
}

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
        border: "1px solid rgba(126,34,206,0.25)",
        borderRadius: "12px",
        background: "#faf5ff",
        padding: "24px",
        margin: "32px 0",
      }}
    >
      <div style={{ fontSize: "15px", fontWeight: 600, color: "#111827", marginBottom: "12px" }}>
        Try It — Paste Any Text
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste your text here (minimum 30 words)..."
        style={{
          width: "100%",
          minHeight: "120px",
          background: "#ffffff",
          border: "1px solid #e5e7eb",
          borderRadius: "8px",
          padding: "12px 14px",
          color: "#111827",
          fontSize: "14px",
          lineHeight: 1.6,
          resize: "vertical",
          fontFamily: "inherit",
        }}
      />
      <button
        onClick={handleAnalyze}
        disabled={loading || text.trim().split(/\s+/).length < 30}
        style={{
          marginTop: "12px",
          background: loading ? "#6d28d9" : "#7e22ce",
          color: "#fff",
          border: "none",
          borderRadius: "8px",
          padding: "10px 24px",
          fontSize: "14px",
          fontWeight: 600,
          cursor: loading ? "wait" : "pointer",
          opacity: text.trim().split(/\s+/).length < 30 ? 0.5 : 1,
        }}
      >
        {loading ? "Analyzing..." : "Analyze"}
      </button>

      {result && (
        <div style={{ marginTop: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
            <div
              style={{
                fontSize: "32px",
                fontWeight: 700,
                color: scoreColor(result.score),
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {result.score}
            </div>
            <div>
              <div style={{ fontSize: "14px", fontWeight: 600, color: scoreColor(result.score) }}>
                {scoreLabel(result.score)}
              </div>
              <div style={{ fontSize: "12px", color: "#6b7280" }}>
                AI Detection Score
              </div>
            </div>
          </div>

          {topPatterns.length > 0 && (
            <div>
              <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
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
                    borderBottom: "1px solid #e5e7eb",
                    fontSize: "13px",
                  }}
                >
                  <span style={{ color: "#374151" }}>{p.label}</span>
                  <span
                    style={{
                      fontSize: "11px",
                      padding: "2px 8px",
                      borderRadius: "4px",
                      background:
                        p.severity === "critical"
                          ? "rgba(220,38,38,0.1)"
                          : p.severity === "high"
                            ? "rgba(249,115,22,0.1)"
                            : "rgba(234,179,8,0.1)",
                      color:
                        p.severity === "critical"
                          ? "#dc2626"
                          : p.severity === "high"
                            ? "#f97316"
                            : "#eab308",
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
          borderTop: "1px solid #e5e7eb",
          fontSize: "13px",
          color: "#9ca3af",
        }}
      >
        Get full analysis + humanization at{" "}
        <a href="/" style={{ color: "#7e22ce", textDecoration: "none" }}>
          humanizeit.app &rarr;
        </a>
      </div>
    </div>
  );
}
