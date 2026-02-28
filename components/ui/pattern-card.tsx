"use client";

import { useState } from "react";

interface PatternHit {
  id: string;
  label: string;
  severity: "critical" | "high" | "medium" | "low";
  hits: number;
  examples: string[];
  category?: string;
}

interface PatternCardProps {
  pattern: PatternHit;
}

const PATTERN_EXPLANATIONS: Record<string, string> = {
  "ai-vocab-t1": "These words are almost exclusively used by AI models. Human writers rarely use them naturally.",
  "ai-vocab-t2": "Words significantly overused by AI but also found in human writing.",
  "ai-vocab-t3": "Words slightly over-represented in AI-generated text.",
  "sycophantic": "Phrases AI uses to appear friendly/agreeable — no human actually writes like this.",
  "filler": "Padding phrases that add length without adding value.",
  "generic-conclusion": "AI always wraps up with the same formulaic conclusions.",
  "hedging": "AI softens every claim with excessive hedging language.",
  "transition-overuse": "AI overuses formal transition words like 'Furthermore' and 'Moreover'.",
  "repetitive-starters": "3+ consecutive sentences starting with the same word — an AI habit.",
  "list-heavy": "More than 30% of content is in list format — AI defaults to lists.",
  "uniform-paragraphs": "All paragraphs are suspiciously similar in length.",
  "perfect-grammar": "Zero contractions or informal language — too perfect for a human.",
  "formulaic-intro": "Opening sentence matches a common AI introduction template.",
  "formulaic-conclusion": "Closing paragraph uses generic AI conclusion phrases.",
  "over-explanation": "Defining terms that don't need defining — AI assumes readers know nothing.",
  "balanced-viewpoint": "Every claim has a counterargument — AI always presents 'balance'.",
  "excessive-qualifiers": "Too many intensifiers like 'very', 'extremely', 'highly'.",
  "abstract-language": "High density of abstract nouns with no concrete examples or data.",
  "no-personality": "No questions, exclamations, em dashes, or first-person voice.",
  "low-burstiness": "Sentence lengths are too uniform — human writing has natural variation.",
  "low-ttr": "Vocabulary is repetitive — AI reuses the same words frequently.",
  "median-sentence-len": "Average sentence length in the AI-typical range (18–25 words).",
  "predictable-reading": "Flesch score in the AI-typical range (40–60).",
  "low-perplexity": "Most sentences start with common, predictable words.",
};

function severityStyles(severity: string): { borderColor: string; iconColor: string; badgeBg: string; badgeColor: string } {
  switch (severity) {
    case "critical": return { borderColor: "#ef4444", iconColor: "#ef4444", badgeBg: "rgba(239,68,68,0.12)", badgeColor: "#f87171" };
    case "high":     return { borderColor: "#f97316", iconColor: "#f97316", badgeBg: "rgba(249,115,22,0.12)", badgeColor: "#fb923c" };
    case "medium":   return { borderColor: "#fbbf24", iconColor: "#fbbf24", badgeBg: "rgba(251,191,36,0.12)", badgeColor: "#fcd34d" };
    default:         return { borderColor: "#22c55e", iconColor: "#22c55e", badgeBg: "rgba(34,197,94,0.12)", badgeColor: "#4ade80" };
  }
}

export function PatternCard({ pattern }: PatternCardProps) {
  const [open, setOpen] = useState(false);
  const styles = severityStyles(pattern.severity);
  const explanation = PATTERN_EXPLANATIONS[pattern.id] ?? "AI-generated text pattern detected.";

  return (
    <div style={{
      background: "#0f0f12",
      border: "1px solid rgba(255,255,255,0.06)",
      borderLeft: `3px solid ${styles.borderColor}`,
      borderRadius: "6px",
      overflow: "hidden",
      transition: "border-color 0.15s",
    }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 14px",
          background: "none",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, minWidth: 0 }}>
          {/* Dot */}
          <span style={{
            width: "7px", height: "7px", borderRadius: "50%",
            background: styles.iconColor, flexShrink: 0,
            boxShadow: `0 0 6px ${styles.iconColor}80`,
          }} />

          {/* Label */}
          <span style={{ fontSize: "13px", fontWeight: 500, color: "#fafafa", minWidth: 0 }}>
            {pattern.label}
          </span>

          {/* Severity badge */}
          <span style={{
            fontSize: "10px", fontWeight: 600, padding: "2px 6px", borderRadius: "4px",
            background: styles.badgeBg, color: styles.badgeColor,
            textTransform: "uppercase", letterSpacing: "0.5px", flexShrink: 0,
          }}>
            {pattern.severity}
          </span>

          {/* Hit count */}
          <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", flexShrink: 0 }}>
            {pattern.hits} hit{pattern.hits !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Chevron */}
        <span style={{
          color: "rgba(255,255,255,0.3)", fontSize: "12px", flexShrink: 0,
          transform: open ? "rotate(180deg)" : "rotate(0deg)",
          transition: "transform 0.2s",
          display: "inline-block",
        }}>
          ▾
        </span>
      </button>

      {open && (
        <div style={{
          padding: "0 14px 14px 30px",
          borderTop: "1px solid rgba(255,255,255,0.05)",
          background: "rgba(255,255,255,0.01)",
        }}>
          <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)", lineHeight: 1.7, marginBottom: "10px", paddingTop: "10px" }}>
            {explanation}
          </p>
          {pattern.examples.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {pattern.examples.map((ex, i) => (
                <code key={i} style={{
                  fontSize: "11px", padding: "3px 8px",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "4px", color: "rgba(255,255,255,0.55)",
                  fontFamily: "var(--font-geist-mono), monospace",
                }}>
                  {ex}
                </code>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
