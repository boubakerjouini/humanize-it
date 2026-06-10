/**
 * Detector evaluation harness.
 *
 * Runs analyzeText() over a labeled corpus (tests/fixtures/detector/{ai,human})
 * and reports accuracy: per-sample AI-likelihood + aggregate false-negative
 * (AI scoring human) and false-positive (human scoring AI) rates. This is the
 * empirical audit + the feedback loop for recalibration.
 *
 *   npx tsx scripts/detector-eval.ts
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { analyzeText } from "../lib/algorithms/analyzeText";

const ROOT = join(__dirname, "..", "tests", "fixtures", "detector");
// A sample is a "miss" for AI if its AI-likelihood is below this (looks human/uncertain).
const AI_FLAG_THRESHOLD = 50; // score >= this counts as "flagged AI"

interface Row { name: string; label: "ai" | "human"; score: number; human: number; band: string; words: number }

function load(label: "ai" | "human"): Row[] {
  const dir = join(ROOT, label);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".txt"))
    .map((f) => {
      const text = readFileSync(join(dir, f), "utf8");
      const r = analyzeText(text);
      return { name: f, label, score: r.score, human: 100 - r.score, band: r.confidenceBand, words: r.wordCount };
    });
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const pad = (s: string, n: number) => (s + " ".repeat(n)).slice(0, n);

function main() {
  const ai = load("ai");
  const human = load("human");
  if (ai.length === 0 && human.length === 0) {
    console.log(`No fixtures found in ${ROOT}. Add .txt files under ai/ and human/ (run scripts/gen-corpus.ts).`);
    return;
  }

  console.log("\n=== Per-sample (AI-likelihood / human-score) ===");
  for (const r of [...ai, ...human].sort((a, b) => a.label.localeCompare(b.label) || b.score - a.score)) {
    const flag = r.label === "ai" ? (r.score >= AI_FLAG_THRESHOLD ? "✓" : "✗ MISS") : (r.score >= AI_FLAG_THRESHOLD ? "✗ FALSE-POS" : "✓");
    console.log(`  ${pad(r.label.toUpperCase(), 6)} ${pad(r.name, 34)} ai=${pad(r.score.toFixed(0), 3)} human=${pad((100 - r.score).toFixed(0), 3)} ${pad(r.band, 14)} ${flag}`);
  }

  const aiScores = ai.map((r) => r.score);
  const humanScores = human.map((r) => r.score);
  const fn = ai.filter((r) => r.score < AI_FLAG_THRESHOLD).length;
  const fp = human.filter((r) => r.score >= AI_FLAG_THRESHOLD).length;

  // Split AI into "default" (what users actually paste) vs "humanlike"
  // (adversarially prompted to evade) — the honest, separate accuracy picture.
  const isAdversarial = (name: string) => /humanlike|adversarial|evade/i.test(name);
  const aiDefault = ai.filter((r) => !isAdversarial(r.name));
  const aiAdversarial = ai.filter((r) => isAdversarial(r.name));
  const fnIn = (rows: Row[]) => rows.filter((r) => r.score < AI_FLAG_THRESHOLD).length;

  console.log("\n=== Aggregate ===");
  console.log(`  AI samples    (${ai.length}): mean ai-likelihood ${mean(aiScores).toFixed(1)}, median ${median(aiScores).toFixed(1)}`);
  console.log(`  Human samples (${human.length}): mean ai-likelihood ${mean(humanScores).toFixed(1)}, median ${median(humanScores).toFixed(1)}`);
  console.log(`  FALSE NEGATIVES (AI scoring < ${AI_FLAG_THRESHOLD} ai): ${fn}/${ai.length} = ${ai.length ? ((fn / ai.length) * 100).toFixed(0) : 0}%`);
  if (aiDefault.length)
    console.log(`    · default AI (typical paste): ${fnIn(aiDefault)}/${aiDefault.length} missed = ${((fnIn(aiDefault) / aiDefault.length) * 100).toFixed(0)}%`);
  if (aiAdversarial.length)
    console.log(`    · adversarial "sound human" : ${fnIn(aiAdversarial)}/${aiAdversarial.length} missed = ${((fnIn(aiAdversarial) / aiAdversarial.length) * 100).toFixed(0)}%  (deep-scan territory)`);
  console.log(`  FALSE POSITIVES (human scoring >= ${AI_FLAG_THRESHOLD} ai): ${fp}/${human.length} = ${human.length ? ((fp / human.length) * 100).toFixed(0) : 0}%`);
  console.log(`  Highest-scoring human (FP safety margin): ${Math.max(0, ...humanScores).toFixed(0)} ai (threshold ${AI_FLAG_THRESHOLD})`);
  const sep = mean(aiScores) - mean(humanScores);
  console.log(`  Separation (AI mean − human mean): ${sep.toFixed(1)} points  (higher = better discrimination)`);
}

main();
