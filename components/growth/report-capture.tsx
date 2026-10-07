"use client";

// ===========================================================
// components/growth/report-capture.tsx — "Email me this report" under the
// AI detector result. The report is built from the scores and the pattern
// labels only: the pasted text is never sent for it, which keeps the instant
// check's "runs in your browser" promise true.
// ===========================================================

import { useState } from "react";
import Link from "next/link";
import { LeadCaptureForm, type ReportContext } from "@/components/growth/lead-capture-form";
import { THEME } from "@/lib/theme";

type PatternLike = { id: string; label: string; hits: number; weight: number };

/** Strongest triggered patterns first, capped to what the API accepts. */
export function buildReportContext(input: {
  instantScore: number;
  patterns: PatternLike[];
  wordCount: number;
  deep?: { aiLikelihood: number; confidence: string; verdict: string } | null;
}): ReportContext {
  return {
    instantScore: Math.max(0, Math.min(100, Math.round(input.instantScore))),
    deepScore: input.deep ? Math.max(0, Math.min(100, Math.round(input.deep.aiLikelihood))) : undefined,
    verdict: input.deep?.verdict.slice(0, 80),
    confidence: input.deep?.confidence.slice(0, 20),
    patterns: input.patterns
      .filter((p) => p.hits > 0)
      .slice()
      .sort((a, b) => b.weight * b.hits - a.weight * a.hits)
      .slice(0, 12)
      .map((p) => ({ id: p.id.slice(0, 60), label: p.label.slice(0, 80), hits: Math.min(999, p.hits) })),
    wordCount: Math.min(20000, input.wordCount),
  };
}

export function ReportCapture({ context }: { context: ReportContext }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ marginTop: "22px", borderTop: `1px solid ${THEME.border}`, paddingTop: "18px" }}>
      {!open ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
          <div style={{ flex: "1 1 260px" }}>
            <div style={{ fontSize: "14px", fontWeight: 600, color: THEME.text }}>Keep this report</div>
            <div style={{ fontSize: "13px", color: THEME.textMuted, lineHeight: 1.5 }}>
              Get your scores and a one-line fix for each top pattern by email. Your text is never included.
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            style={{
              background: THEME.surface2,
              color: THEME.brandHi,
              border: `1px solid ${THEME.borderStrong}`,
              fontSize: "14px",
              fontWeight: 600,
              padding: "9px 18px",
              borderRadius: THEME.radius,
              cursor: "pointer",
              fontFamily: THEME.fontSans,
              whiteSpace: "nowrap",
            }}
          >
            Email me this report
          </button>
        </div>
      ) : (
        <LeadCaptureForm source="detector_report" context={context} variant="compact" ctaLabel="Send my report" />
      )}
      <p style={{ fontSize: "13px", color: THEME.textMuted, lineHeight: 1.5, margin: "14px 0 0" }}>
        Wrote it yourself and still got a high score? The free{" "}
        <Link href="/free/false-ai-flag-appeal-kit" style={{ color: THEME.brandHi }}>
          False AI Flag Appeal Kit
        </Link>{" "}
        shows you how to respond with evidence.
      </p>
    </div>
  );
}
