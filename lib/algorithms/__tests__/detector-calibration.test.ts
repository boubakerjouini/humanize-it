// ===========================================================
// Detector calibration regression test.
//
// Runs analyzeText() over the committed labeled corpus
// (tests/fixtures/detector, categories in its README) and guards what we ship:
//   - ZERO false positives on genuine human writing, at full length AND on
//     the opening 40-200 words (snippets used to reach 96/100: the 2026-10
//     deep dive, scripts/detector-eval.ts),
//   - default (typical-paste) AI is still caught at a stated floor,
//   - clear AI-vs-human separation.
// Adversarial "sound human", lightly edited and short AI are NOT required to
// flag here — the instant check defers those to the LLM deep scan.
// ===========================================================

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { analyzeText } from "../analyzeText";

const ROOT = join(__dirname, "..", "..", "..", "tests", "fixtures", "detector");
const FLAG = 50; // score >= FLAG ⇒ flagged AI

function load(label: "ai" | "human") {
  const dir = join(ROOT, label);
  if (!existsSync(dir)) return [] as { name: string; text: string }[];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".txt"))
    .map((f) => ({ name: f, text: readFileSync(join(dir, f), "utf8") }));
}

const ai = load("ai");
// Synthetic human-style samples are reported by the eval, not asserted here.
const human = load("human").filter((s) => !s.name.startsWith("synthetic-"));
const aiDefault = ai.filter((s) => !/humanlike|adversarial|evade|-edited|^short-|^fr-/.test(s.name));
const score = (t: string) => analyzeText(t).score;
const firstWords = (t: string, n: number) => t.trim().split(/\s+/).slice(0, n).join(" ");
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

describe("detector calibration (corpus regression)", () => {
  test("corpus fixtures are present", () => {
    expect(ai.length).toBeGreaterThanOrEqual(25);
    expect(human.length).toBeGreaterThanOrEqual(25);
  });

  test("ZERO false positives — no full-length human sample is flagged as AI", () => {
    const flagged = human.map((s) => ({ name: s.name, score: score(s.text) })).filter((r) => r.score >= FLAG);
    expect(flagged.map((r) => `${r.name}=${r.score}`)).toEqual([]);
  });

  test.each([40, 70, 100, 150, 200])("ZERO false positives on the first %i words of every human sample", (n) => {
    const flagged = human.map((s) => ({ name: s.name, score: score(firstWords(s.text, n)) })).filter((r) => r.score >= FLAG);
    expect(flagged.map((r) => `${r.name}=${r.score}`)).toEqual([]);
  });

  test("human samples keep a safety margin below the threshold", () => {
    // Dense formal human prose (journalism, 19th-century essays) is the
    // hardest heuristic case; the deep scan is the precise verdict there.
    expect(Math.max(0, ...human.map((s) => score(s.text)))).toBeLessThan(FLAG - 2);
  });

  test("default (typical-paste) AI is still caught at the stated floor", () => {
    // 6/12 at the 2026-10 recalibration. Short (<250-word) default AI now
    // stays "uncertain" by design, which is where the misses are.
    const caught = aiDefault.filter((s) => score(s.text) >= FLAG);
    expect(caught.length).toBeGreaterThanOrEqual(Math.ceil(aiDefault.length * 0.45));
  });

  test("clear AI-vs-human separation", () => {
    const sep = mean(aiDefault.map((s) => score(s.text))) - mean(human.map((s) => score(s.text)));
    expect(sep).toBeGreaterThan(30);
  });
});
