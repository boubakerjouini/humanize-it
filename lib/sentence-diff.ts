// ===========================================================
// lib/sentence-diff.ts — lightweight, dependency-free sentence diffing for the
// in-place document editor. Used to (a) highlight which humanized sentences
// changed, and (b) render an original⇄humanized diff view.
// ===========================================================

/** Split text into sentence-ish segments, preserving order. */
export function splitSentences(text: string): string[] {
  const matches = text.match(/[^.!?\n]+[.!?]+|\n+|[^.!?\n]+$/g);
  if (!matches) return text.trim() ? [text.trim()] : [];
  return matches.map((s) => s.trim()).filter((s) => s.length > 0);
}

/** Normalize a sentence for comparison (case/whitespace/trailing punctuation insensitive). */
function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").replace(/[.,!?;:'"—–-]+/g, "").trim();
}

export interface Segment {
  text: string;
  changed: boolean;
}

/** Humanized sentences, each flagged `changed` if it isn't present verbatim in the original. */
export function highlightChanges(original: string, humanized: string): Segment[] {
  const origSet = new Set(splitSentences(original).map(norm));
  return splitSentences(humanized).map((text) => ({ text, changed: !origSet.has(norm(text)) }));
}

export interface DiffPart {
  type: "same" | "add" | "del";
  text: string;
}

/** Sentence-level diff (LCS) between original and humanized text. */
export function sentenceDiff(original: string, humanized: string): DiffPart[] {
  const a = splitSentences(original);
  const b = splitSentences(humanized);
  const an = a.map(norm);
  const bn = b.map(norm);
  const m = a.length;
  const n = b.length;

  // LCS length table.
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = an[i] === bn[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  // Backtrack into ordered diff parts.
  const parts: DiffPart[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (an[i] === bn[j]) { parts.push({ type: "same", text: b[j] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { parts.push({ type: "del", text: a[i] }); i++; }
    else { parts.push({ type: "add", text: b[j] }); j++; }
  }
  while (i < m) { parts.push({ type: "del", text: a[i] }); i++; }
  while (j < n) { parts.push({ type: "add", text: b[j] }); j++; }
  return parts;
}
