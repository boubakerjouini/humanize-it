// ===========================================================
// Detector calibration regression test.
//
// Guards the 2026 recalibration (see tests/fixtures/detector/BASELINE.md)
// against silent drift by running analyzeText() over the committed labeled
// corpus and asserting the accuracy invariants we shipped:
//   - ZERO false positives (no human sample reaches the AI flag threshold),
//   - default (non-adversarial) AI is reliably flagged,
//   - strong AI-vs-human separation.
// Adversarial "sound human" + creative samples are intentionally NOT required
// to flag here — those are deferred to the server LLM deep scan.
// ===========================================================

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { analyzeText } from "../analyzeText";

const ROOT = join(__dirname, "..", "..", "..", "tests", "fixtures", "detector");
const FLAG = 50; // score >= FLAG ⇒ flagged AI

function load(label: "ai" | "human") {
  const dir = join(ROOT, label);
  if (!existsSync(dir)) return [] as { name: string; score: number }[];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".txt"))
    .map((f) => ({ name: f, score: analyzeText(readFileSync(join(dir, f), "utf8")).score }));
}

const ai = load("ai");
const human = load("human");
const isAdversarial = (n: string) => /humanlike|adversarial|evade/i.test(n);
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

describe("detector calibration (corpus regression)", () => {
  test("corpus fixtures are present", () => {
    expect(ai.length).toBeGreaterThanOrEqual(6);
    expect(human.length).toBeGreaterThanOrEqual(6);
  });

  test("ZERO false positives — no human sample is flagged as AI", () => {
    const flagged = human.filter((r) => r.score >= FLAG);
    expect(flagged.map((r) => `${r.name}=${r.score}`)).toEqual([]);
  });

  test("human samples keep a safety margin below the threshold", () => {
    // Dense formal/professional human prose (journalism, academic) is the
    // hardest heuristic case — statistically close to formal AI — so the margin
    // is modest; the LLM deep scan is the precise verdict for that band.
    const highest = Math.max(0, ...human.map((r) => r.score));
    expect(highest).toBeLessThan(FLAG - 2);
  });

  test("default (typical-paste) AI is reliably flagged", () => {
    const def = ai.filter((r) => !isAdversarial(r.name));
    const missed = def.filter((r) => r.score < FLAG);
    // Allow at most one miss (creative `story` is the genuine hard case).
    expect(missed.length).toBeLessThanOrEqual(1);
  });

  test("strong AI-vs-human separation", () => {
    const sep = mean(ai.map((r) => r.score)) - mean(human.map((r) => r.score));
    expect(sep).toBeGreaterThan(40);
  });
});
