"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Wand2, Pencil, ScanSearch, Sparkles } from "lucide-react";
import type { AnalysisResult, PatternHit } from "@/lib/algorithms/analyzeText";
import type { Severity } from "@/lib/algorithms/patterns";
import { buildFlaggedSegments, isHighlightable } from "@/lib/algorithms/flagged-spans";
import { ScoreRing } from "@/components/ui/score-ring";
import { THEME, glow, humanScore, humanScoreLabel } from "@/lib/theme";

/** Min words for a reliable deep scan — mirrors app/api/detect MIN_WORDS. */
const DEEP_MIN_WORDS = 25;

const SEVERITY_COLOR: Record<Severity, string> = {
  critical: THEME.ai,
  high: THEME.ai,
  medium: THEME.warn,
  low: THEME.accent,
};

interface DeepScan {
  aiLikelihood: number;
  confidence: "low" | "medium" | "high";
  verdict: string;
  signals: string[];
  reasoning: string;
}

export function AnalysisPanel({
  text,
  result,
  busy,
  onHumanize,
  onBack,
}: {
  text: string;
  result: AnalysisResult;
  busy: boolean;
  onHumanize: () => void;
  onBack: () => void;
}) {
  const [deep, setDeep] = useState<DeepScan | null>(null);
  const [deepLoading, setDeepLoading] = useState(false);

  const words = useMemo(() => (text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0), [text]);
  const segments = useMemo(() => buildFlaggedSegments(text, result.patterns), [text, result]);
  const triggered = useMemo(() => result.patterns.filter((p) => p.hits > 0), [result]);

  // Split the breakdown into spans we could highlight inline vs whole-text signals.
  const inline: PatternHit[] = [];
  const wholeText: PatternHit[] = [];
  for (const p of triggered) (isHighlightable(text, p) ? inline : wholeText).push(p);

  const human = humanScore(result.score);

  async function runDeepScan() {
    if (words < DEEP_MIN_WORDS || deepLoading) return;
    setDeepLoading(true);
    try {
      const res = await fetch("/api/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error?.message ?? "Deep scan failed. Please try again.");
        return;
      }
      setDeep(data as DeepScan);
    } catch {
      toast.error("Couldn't reach the deep scan. Check your connection and try again.");
    } finally {
      setDeepLoading(false);
    }
  }

  return (
    <div className="animate-fade-up" style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      {/* Score + verdict */}
      <div style={{ display: "flex", gap: 28, alignItems: "center", flexWrap: "wrap" }}>
        <ScoreRing score={result.score} size={128} countUp />
        <div style={{ flex: "1 1 260px", minWidth: 240 }}>
          <div style={{ fontSize: 12, color: THEME.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
            Instant estimate · {humanScoreLabel(human)}
          </div>
          <p style={{ fontSize: 15, color: THEME.textDim, lineHeight: 1.6, margin: "0 0 14px" }}>
            {triggered.length === 0
              ? "No strong AI patterns found in the instant scan. Run a deep scan for a precise verdict."
              : `${triggered.length} signal${triggered.length === 1 ? "" : "s"} detected across ${result.wordCount.toLocaleString()} words. Highlighted spans below are the locatable tells.`}
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={onHumanize} disabled={busy}
              style={{ display: "inline-flex", alignItems: "center", gap: 8, background: busy ? THEME.surface3 : THEME.gradient, color: busy ? THEME.textMuted : "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontSize: 14, fontWeight: 700, cursor: busy ? "not-allowed" : "pointer", boxShadow: busy ? "none" : glow(THEME.brand, 0.3), fontFamily: THEME.fontSans }}>
              <Wand2 size={15} aria-hidden="true" /> {busy ? "Humanizing…" : "Humanize this"}
            </button>
            <button onClick={onBack} style={ghost}><Pencil size={14} aria-hidden="true" /> Back to edit</button>
          </div>
        </div>
      </div>

      {/* Flagged text */}
      <div>
        <SectionLabel>What&apos;s flagged</SectionLabel>
        <div style={{ fontSize: 16, lineHeight: 1.85, color: THEME.text, whiteSpace: "pre-wrap", background: THEME.surface1, border: `1px solid ${THEME.border}`, borderRadius: THEME.radiusLg, padding: 18, maxHeight: "42vh", overflowY: "auto" }}>
          {segments.map((seg, i) =>
            seg.flag ? (
              <span key={i} title={seg.flag.label}
                style={{ background: SEVERITY_COLOR[seg.flag.severity] + "1f", boxShadow: `inset 0 -2px 0 ${SEVERITY_COLOR[seg.flag.severity]}`, borderRadius: 3, padding: "0 1px", cursor: "help" }}>
                {seg.text}
              </span>
            ) : (
              <span key={i}>{seg.text}</span>
            )
          )}
        </div>
      </div>

      {/* Signal breakdown */}
      {triggered.length > 0 && (
        <div style={{ display: "grid", gap: 16 }}>
          {inline.length > 0 && (
            <div>
              <SectionLabel>Inline tells ({inline.length})</SectionLabel>
              <ChipRow patterns={inline} />
            </div>
          )}
          {wholeText.length > 0 && (
            <div>
              <SectionLabel>Whole-text signals ({wholeText.length})</SectionLabel>
              <ChipRow patterns={wholeText} />
            </div>
          )}
        </div>
      )}

      {/* Deep scan */}
      <div style={{ borderTop: `1px solid ${THEME.border}`, paddingTop: 18 }}>
        {!deep ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div style={{ flex: "1 1 260px" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: THEME.text }}>Deep scan</div>
              <div style={{ fontSize: 13, color: THEME.textMuted, lineHeight: 1.5 }}>
                The score above is an instant heuristic. Run an AI-powered deep scan for a precise, calibrated verdict.
              </div>
            </div>
            <button onClick={runDeepScan} disabled={deepLoading || words < DEEP_MIN_WORDS}
              title={words < DEEP_MIN_WORDS ? `Need at least ${DEEP_MIN_WORDS} words for a deep scan` : undefined}
              style={{ display: "inline-flex", alignItems: "center", gap: 8, background: deepLoading || words < DEEP_MIN_WORDS ? THEME.surface3 : THEME.brand, color: deepLoading || words < DEEP_MIN_WORDS ? THEME.textMuted : "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontSize: 14, fontWeight: 700, cursor: deepLoading || words < DEEP_MIN_WORDS ? "not-allowed" : "pointer", fontFamily: THEME.fontSans, whiteSpace: "nowrap" }}>
              <ScanSearch size={15} aria-hidden="true" /> {deepLoading ? "Scanning…" : "Run deep scan"}
            </button>
          </div>
        ) : (
          <div className="animate-fade-up">
            <div style={{ display: "flex", gap: 26, alignItems: "center", flexWrap: "wrap" }}>
              <ScoreRing score={deep.aiLikelihood} size={112} countUp />
              <div style={{ flex: "1 1 260px", minWidth: 240 }}>
                <div style={{ fontSize: 12, color: THEME.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
                  Deep scan · AI-likelihood {deep.aiLikelihood}/100 · {deep.confidence} confidence
                </div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 17, fontWeight: 800, color: deep.aiLikelihood >= 55 ? THEME.ai : deep.aiLikelihood <= 30 ? THEME.human : THEME.warn, marginBottom: 8 }}>
                  <Sparkles size={16} aria-hidden="true" /> {deep.verdict}
                </div>
                {deep.reasoning && <p style={{ fontSize: 14, color: THEME.textDim, lineHeight: 1.6, margin: 0 }}>{deep.reasoning}</p>}
              </div>
            </div>
            {deep.signals.length > 0 && (
              <ul style={{ margin: "14px 0 0", paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
                {deep.signals.map((s, i) => (
                  <li key={i} style={{ fontSize: 13, color: THEME.textDim, lineHeight: 1.5 }}>{s}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 700, color: THEME.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
      {children}
    </div>
  );
}

function ChipRow({ patterns }: { patterns: PatternHit[] }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {patterns
        .slice()
        .sort((a, b) => b.weight * b.hits - a.weight * a.hits)
        .map((p) => (
          <span key={p.id}
            style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, color: THEME.textDim, background: THEME.surface2, border: `1px solid ${THEME.border}`, padding: "6px 12px", borderRadius: 999 }}>
            <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: "50%", background: SEVERITY_COLOR[p.severity] }} />
            {p.label}
            <span style={{ color: THEME.textMuted }}>×{p.hits}</span>
          </span>
        ))}
    </div>
  );
}

const ghost: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, background: THEME.surface2, color: THEME.text, border: `1px solid ${THEME.border}`, borderRadius: 10, padding: "10px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: THEME.fontSans };
