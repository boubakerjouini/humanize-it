/**
 * Deep-scan (LLM) evaluation harness.
 *
 * Runs the server deepScanText() rubric over the SAME labeled corpus as
 * scripts/detector-eval.ts and prints the same report (confusion matrix,
 * genuine-human false-positive rate, per category, thresholds, AUC,
 * calibration) plus latency and an estimated cost per call. Makes one model
 * call per sample (real API spend: about $0.006 per call on Sonnet pricing).
 *
 *   npx tsx scripts/detector-deepscan-eval.ts                 # whole corpus
 *   npx tsx scripts/detector-deepscan-eval.ts --only=human    # one label
 *   npx tsx scripts/detector-deepscan-eval.ts --short=60      # first N words of each sample
 */

import dotenv from "dotenv";
import { loadCorpus, mean, pad, report, type Scored } from "./detector-corpus";

dotenv.config({ path: ".env.local", quiet: true });

// claude-sonnet-4-5 list prices, USD per token. Output share is estimated from
// the verdict length (complete() only reports input + output together).
const PRICE_IN = 3 / 1e6;
const PRICE_OUT = 15 / 1e6;

async function main() {
  // dotenv must run before importing modules that read ANTHROPIC_API_KEY at init.
  const { deepScanWithUsage } = await import("../lib/detect-llm");
  const only = process.argv.find((a) => a.startsWith("--only="))?.split("=")[1];
  const shortN = Number(process.argv.find((a) => a.startsWith("--short="))?.split("=")[1] ?? 0);

  const samples = loadCorpus()
    .filter((s) => !only || s.label === only)
    .map((s) => (shortN ? { ...s, text: s.text.trim().split(/\s+/).slice(0, shortN).join(" ") } : s));
  if (!samples.length) {
    console.log("No fixtures under tests/fixtures/detector/{ai,human}.");
    return;
  }

  const rows: Scored[] = [];
  const latencies: number[] = [];
  const costs: number[] = [];
  for (const s of samples) {
    const t0 = Date.now();
    try {
      const { result, tokensUsed } = await deepScanWithUsage(s.text);
      const ms = Date.now() - t0;
      const outTok = Math.round(JSON.stringify(result).length / 3.5);
      const cost = (tokensUsed - outTok) * PRICE_IN + outTok * PRICE_OUT;
      latencies.push(ms);
      costs.push(cost);
      rows.push({ name: s.name, label: s.label, category: s.category, score: result.aiLikelihood });
      console.log(`  ${pad(s.category, 22)} ${pad(s.name, 32)} ai=${pad(String(result.aiLikelihood), 3)} ${pad(result.confidence, 6)} ${pad(`${ms}ms`, 7)} ${result.verdict}`);
    } catch (e) {
      console.log(`  ! ${s.name}: ${e instanceof Error ? e.message : e}`);
    }
  }

  report(`Deep scan${shortN ? ` (first ${shortN} words)` : ""}`, rows);
  const sorted = [...latencies].sort((a, b) => a - b);
  console.log(`\n=== Latency & cost ===`);
  console.log(`  latency mean ${mean(latencies).toFixed(0)} ms, p50 ${sorted[Math.floor(sorted.length / 2)] ?? 0} ms, max ${sorted[sorted.length - 1] ?? 0} ms`);
  console.log(`  est. cost per call mean $${mean(costs).toFixed(4)}, run total $${costs.reduce((a, b) => a + b, 0).toFixed(3)} (${rows.length} calls)`);
}

main().catch((e) => {
  console.error("✗", e instanceof Error ? e.message : e);
  process.exit(1);
});
