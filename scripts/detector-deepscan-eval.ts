/**
 * Deep-scan (LLM) evaluation harness.
 *
 * Runs the server deepScanText() rubric over the SAME labeled corpus as
 * scripts/detector-eval.ts and reports per-sample AI-likelihood + false
 * negative / false positive rates. This is the calibration loop for the deep
 * scan prompt and the proof it catches the adversarial / creative cases the
 * instant heuristic defers. Makes one model call per sample (API cost).
 *
 *   npx tsx scripts/detector-deepscan-eval.ts
 */

import dotenv from "dotenv";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

dotenv.config({ path: ".env.local" });

const ROOT = join(__dirname, "..", "tests", "fixtures", "detector");
const AI_FLAG_THRESHOLD = 50;

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const pad = (s: string, n: number) => (s + " ".repeat(n)).slice(0, n);

async function main() {
  // dotenv must run before importing modules that read ANTHROPIC_API_KEY at init.
  const { deepScanText } = await import("../lib/detect-llm");

  const files = (label: "ai" | "human") => {
    const dir = join(ROOT, label);
    if (!existsSync(dir)) return [] as { name: string; label: "ai" | "human"; text: string }[];
    return readdirSync(dir)
      .filter((f) => f.endsWith(".txt"))
      .map((f) => ({ name: f, label, text: readFileSync(join(dir, f), "utf8") }));
  };
  const samples = [...files("ai"), ...files("human")];
  if (!samples.length) {
    console.log("No fixtures. Run scripts/gen-corpus.ts first.");
    return;
  }

  const rows: { name: string; label: "ai" | "human"; ai: number; verdict: string }[] = [];
  for (const s of samples) {
    try {
      const r = await deepScanText(s.text);
      rows.push({ name: s.name, label: s.label, ai: r.aiLikelihood, verdict: r.verdict });
      console.log(`  ${pad(s.label.toUpperCase(), 6)} ${pad(s.name.replace(".txt", ""), 26)} ai=${pad(String(r.aiLikelihood), 3)} ${r.verdict}`);
    } catch (e) {
      console.log(`  ! ${s.name}: ${e instanceof Error ? e.message : e}`);
    }
  }

  const ai = rows.filter((r) => r.label === "ai");
  const human = rows.filter((r) => r.label === "human");
  const fn = ai.filter((r) => r.ai < AI_FLAG_THRESHOLD).length;
  const fp = human.filter((r) => r.ai >= AI_FLAG_THRESHOLD).length;

  console.log("\n=== Deep scan aggregate ===");
  console.log(`  AI    (${ai.length}): mean ${mean(ai.map((r) => r.ai)).toFixed(1)}, median ${median(ai.map((r) => r.ai)).toFixed(1)}`);
  console.log(`  HUMAN (${human.length}): mean ${mean(human.map((r) => r.ai)).toFixed(1)}, median ${median(human.map((r) => r.ai)).toFixed(1)}`);
  console.log(`  FALSE NEGATIVES (AI < ${AI_FLAG_THRESHOLD}): ${fn}/${ai.length} = ${ai.length ? ((fn / ai.length) * 100).toFixed(0) : 0}%`);
  console.log(`  FALSE POSITIVES (human >= ${AI_FLAG_THRESHOLD}): ${fp}/${human.length} = ${human.length ? ((fp / human.length) * 100).toFixed(0) : 0}%`);
  console.log(`  Separation: ${(mean(ai.map((r) => r.ai)) - mean(human.map((r) => r.ai))).toFixed(1)} points`);
}

main().catch((e) => { console.error("✗", e instanceof Error ? e.message : e); process.exit(1); });
