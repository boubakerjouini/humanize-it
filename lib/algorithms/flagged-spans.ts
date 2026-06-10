// ===========================================================
// lib/algorithms/flagged-spans.ts — locate AI-pattern hits in the text
//
// analyzeText() returns the patterns it triggered, but a PatternHit only
// carries `examples` (the literal matched words/phrases) — no character
// offsets. To highlight "what's flagged" inline in the editor we search those
// examples back into the source text and merge the resulting ranges into an
// ordered list of segments the UI can render (same shape as
// lib/sentence-diff.ts `highlightChanges`).
//
// Whole-text signals (burstiness, uniform rhythm, etc.) have descriptive
// examples that are NOT substrings of the text, so they simply never match and
// fall through to the breakdown list only — exactly what we want.
// ===========================================================

import type { PatternHit } from "./analyzeText";
import type { Severity } from "./patterns";

export interface FlaggedSegment {
  text: string;
  /** Present when this segment is a located AI-pattern hit. */
  flag?: { label: string; severity: Severity };
}

const SEVERITY_RANK: Record<Severity, number> = { critical: 4, high: 3, medium: 2, low: 1 };

interface Range {
  start: number;
  end: number;
  severity: Severity;
  label: string;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** A "word-like" example (letters/'-' only) is matched on word boundaries so
 *  "stands" doesn't light up inside "understands"; phrases match literally. */
function buildMatcher(example: string): RegExp | null {
  const trimmed = example.trim();
  if (trimmed.length < 2) return null;
  const isWordLike = /^[a-zA-Z][a-zA-Z'-]*$/.test(trimmed);
  const body = escapeRegExp(trimmed);
  try {
    return new RegExp(isWordLike ? `\\b${body}\\b` : body, "gi");
  } catch {
    return null;
  }
}

/**
 * Split `text` into ordered segments, flagging the spans that match any
 * triggered pattern's examples. Overlapping matches merge into one span,
 * keeping the highest-severity label.
 */
export function buildFlaggedSegments(text: string, patterns: PatternHit[]): FlaggedSegment[] {
  if (!text) return [];

  // 1. Collect every located range.
  const ranges: Range[] = [];
  for (const p of patterns) {
    for (const example of p.examples) {
      const re = buildMatcher(example);
      if (!re) continue;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        if (m[0].length === 0) { re.lastIndex++; continue; }
        ranges.push({ start: m.index, end: m.index + m[0].length, severity: p.severity, label: p.label });
      }
    }
  }
  if (ranges.length === 0) return [{ text }];

  // 2. Sort and merge overlaps (keep the strongest severity for the merged span).
  ranges.sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: Range[] = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r.start <= last.end) {
      last.end = Math.max(last.end, r.end);
      if (SEVERITY_RANK[r.severity] > SEVERITY_RANK[last.severity]) {
        last.severity = r.severity;
        last.label = r.label;
      }
    } else {
      merged.push({ ...r });
    }
  }

  // 3. Walk the text, emitting plain + flagged segments in order.
  const segments: FlaggedSegment[] = [];
  let cursor = 0;
  for (const r of merged) {
    if (r.start > cursor) segments.push({ text: text.slice(cursor, r.start) });
    segments.push({ text: text.slice(r.start, r.end), flag: { label: r.label, severity: r.severity } });
    cursor = r.end;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor) });
  return segments;
}

/** Count of located (highlightable) vs whole-text-only triggered patterns —
 *  used by the breakdown UI to group "inline tells" vs "whole-text signals". */
export function isHighlightable(text: string, p: PatternHit): boolean {
  return p.examples.some((ex) => {
    const re = buildMatcher(ex);
    return re ? re.test(text) : false;
  });
}
