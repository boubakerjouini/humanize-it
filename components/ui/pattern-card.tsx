"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { THEME } from "@/lib/theme";

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

// Severity → semantic accent on white. critical/high = AI red, medium = warn amber, low = human green.
function severityStyles(severity: string): { borderColor: string; badgeBg: string; badgeColor: string } {
  switch (severity) {
    case "critical":
    case "high":     return { borderColor: THEME.ai, badgeBg: THEME.aiDim, badgeColor: THEME.ai };
    case "medium":   return { borderColor: THEME.warn, badgeBg: THEME.warnDim, badgeColor: THEME.warn };
    default:         return { borderColor: THEME.human, badgeBg: THEME.humanDim, badgeColor: THEME.human };
  }
}

export function PatternCard({ pattern }: PatternCardProps) {
  const [open, setOpen] = useState(false);
  const styles = severityStyles(pattern.severity);
  const explanation = PATTERN_EXPLANATIONS[pattern.id] ?? "AI-generated text pattern detected.";
  const panelId = useId();
  const buttonId = useId();

  return (
    <div style={{
      background: THEME.surface2,
      border: `1px solid ${THEME.border}`,
      borderLeft: `4px solid ${styles.borderColor}`,
      borderRadius: THEME.radius,
      overflow: "hidden",
      boxShadow: "0 1px 2px rgba(29,23,38,0.04)",
      transition: "box-shadow 0.15s",
    }}>
      <button
        id={buttonId}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={panelId}
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
          {/* Label */}
          <span style={{ fontSize: "13px", fontWeight: 500, color: THEME.text, minWidth: 0 }}>
            {pattern.label}
          </span>

          {/* Severity chip */}
          <span style={{
            display: "inline-flex", alignItems: "center", gap: "5px",
            fontSize: "11px", fontWeight: 600, padding: "3px 9px", borderRadius: "999px",
            background: styles.badgeBg, color: styles.badgeColor,
            flexShrink: 0, textTransform: "capitalize",
          }}>
            <span aria-hidden="true" style={{
              width: 6, height: 6, borderRadius: "50%", background: styles.badgeColor,
            }} />
            {pattern.severity}
          </span>

          {/* Hit count */}
          <span style={{ fontSize: "11px", color: THEME.textDim, flexShrink: 0 }}>
            <span style={{ fontFamily: THEME.fontMono, fontVariantNumeric: "tabular-nums" }}>
              {pattern.hits}
            </span>{" "}
            hit{pattern.hits !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Chevron */}
        <ChevronDown
          size={14}
          color={THEME.textDim}
          aria-hidden="true"
          style={{
            flexShrink: 0,
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s",
          }}
        />
      </button>

      {open && (
        <div
          id={panelId}
          role="region"
          aria-labelledby={buttonId}
          style={{
            padding: "0 14px 14px 18px",
            borderTop: `1px solid ${THEME.border}`,
            background: THEME.surface1,
          }}
        >
          <p style={{ fontSize: "12px", color: THEME.textDim, lineHeight: 1.7, marginBottom: "10px", paddingTop: "10px" }}>
            {explanation}
          </p>
          {pattern.examples.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {pattern.examples.map((ex, i) => (
                <code key={i} style={{
                  fontSize: "11px", padding: "3px 8px",
                  background: THEME.brandDim,
                  border: `1px solid ${THEME.brand}40`,
                  borderRadius: "6px", color: THEME.brandHi,
                  fontFamily: THEME.fontMono,
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
