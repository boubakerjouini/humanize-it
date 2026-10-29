// ===========================================================
// lib/detector-copy.ts — user-facing copy shared by the detector surfaces
// (the /ai-detector tool, the blog widget, the editor's analysis panel), so
// the honesty wording stays identical everywhere.
// ===========================================================

import { RELIABLE_MIN_WORDS, type AnalysisResult } from "@/lib/algorithms/analyzeText";

/** Why the instant score is only a hint (AnalysisResult.lowReliability). */
export const LOW_RELIABILITY_NOTE: Record<NonNullable<AnalysisResult["lowReliability"]>, string> = {
  "short-text": `Short text: under ${RELIABLE_MIN_WORDS} words the instant check can't reliably tell careful human writing from AI, so it stays in the uncertain range. Paste more text or run a deep scan.`,
  "unsupported-script":
    "The instant check is tuned for English and other Latin-script languages, so this score is not meaningful here. Run a deep scan instead.",
};
