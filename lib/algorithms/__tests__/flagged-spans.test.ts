// ===========================================================
// Tests for buildFlaggedSegments — locating AI-pattern hits in text.
// ===========================================================

import { buildFlaggedSegments, isHighlightable } from "../flagged-spans";
import type { PatternHit } from "../analyzeText";

function hit(partial: Partial<PatternHit> & { examples: string[] }): PatternHit {
  return {
    id: "x",
    label: "AI Vocabulary",
    hits: partial.examples.length,
    severity: "high",
    weight: 5,
    category: "vocabulary",
    ...partial,
  };
}

const join = (segs: { text: string }[]) => segs.map((s) => s.text).join("");

describe("buildFlaggedSegments", () => {
  test("returns [] for empty text", () => {
    expect(buildFlaggedSegments("", [hit({ examples: ["delve"] })])).toEqual([]);
  });

  test("returns one plain segment when nothing matches", () => {
    const segs = buildFlaggedSegments("a plain human sentence.", [hit({ examples: ["delve"] })]);
    expect(segs).toEqual([{ text: "a plain human sentence." }]);
  });

  test("locates a vocabulary example and flags it", () => {
    const text = "We must delve into this.";
    const segs = buildFlaggedSegments(text, [hit({ examples: ["delve"], label: "Tier 1" })]);
    const flagged = segs.filter((s) => s.flag);
    expect(flagged).toHaveLength(1);
    expect(flagged[0].text).toBe("delve");
    expect(flagged[0].flag).toEqual({ label: "Tier 1", severity: "high" });
  });

  test("word-like examples respect word boundaries (no inside-word matches)", () => {
    const text = "He understands the standstill.";
    const segs = buildFlaggedSegments(text, [hit({ examples: ["stands"] })]);
    // "stands" must NOT match inside "understands" or "standstill".
    expect(segs.some((s) => s.flag)).toBe(false);
  });

  test("matches a multi-word phrase literally and case-insensitively", () => {
    const text = "In conclusion, it is clear.";
    const segs = buildFlaggedSegments(text, [hit({ examples: ["in conclusion"], label: "Generic Conclusions", severity: "high" })]);
    const flagged = segs.filter((s) => s.flag);
    expect(flagged).toHaveLength(1);
    expect(flagged[0].text).toBe("In conclusion");
  });

  test("excludes descriptive (non-substring) examples — whole-text signals", () => {
    const text = "Some ordinary writing here.";
    const segs = buildFlaggedSegments(text, [
      hit({ examples: ["Sentence length CoV: 0.27 (AI-typical < 0.30)"], category: "statistical", label: "Uniform Sentence Length" }),
    ]);
    expect(segs).toEqual([{ text }]);
  });

  test("merges overlapping ranges, keeping the strongest severity", () => {
    const text = "comprehensive analysis";
    const segs = buildFlaggedSegments(text, [
      hit({ examples: ["comprehensive"], severity: "low", label: "Low one" }),
      hit({ examples: ["comprehensive analysis"], severity: "critical", label: "Critical phrase" }),
    ]);
    const flagged = segs.filter((s) => s.flag);
    expect(flagged).toHaveLength(1);
    expect(flagged[0].text).toBe("comprehensive analysis");
    expect(flagged[0].flag?.severity).toBe("critical");
    expect(flagged[0].flag?.label).toBe("Critical phrase");
  });

  test("segments always reconstruct the original text exactly", () => {
    const text = "Furthermore, we delve into a comprehensive, nuanced tapestry of ideas.";
    const segs = buildFlaggedSegments(text, [
      hit({ examples: ["furthermore", "delve", "comprehensive", "nuanced", "tapestry"] }),
    ]);
    expect(join(segs)).toBe(text);
    expect(segs.filter((s) => s.flag).length).toBeGreaterThan(0);
  });

  test("isHighlightable distinguishes locatable tells from whole-text signals", () => {
    const text = "We delve into the topic.";
    expect(isHighlightable(text, hit({ examples: ["delve"] }))).toBe(true);
    expect(isHighlightable(text, hit({ examples: ["Burstiness: 0.12 (very uniform)"], category: "statistical" }))).toBe(false);
  });
});
