/**
 * Detector evaluation harness (instant heuristic).
 *
 * Runs analyzeText() over the labeled corpus (tests/fixtures/detector/{ai,human})
 * and reports the confusion matrix, false-positive rate on genuine human text
 * (the number our positioning depends on), per-category results, the
 * threshold trade-off, AUC and calibration. Then two stress tests real users
 * hit: short pastes (every sample cut to 40 / 70 words) and long pastes
 * (same-label samples joined into 600-1200-word documents), plus latency.
 *
 *   npx tsx scripts/detector-eval.ts            # full report
 *   npx tsx scripts/detector-eval.ts --json     # per-sample scores as JSON
 */

import { analyzeText } from "../lib/algorithms/analyzeText";
import { FLAG, loadCorpus, mean, pad, pct, report, type Scored } from "./detector-corpus";

const firstWords = (t: string, n: number) => t.trim().split(/\s+/).slice(0, n).join(" ");

function main() {
  const corpus = loadCorpus();
  if (!corpus.length) {
    console.log("No fixtures found under tests/fixtures/detector/{ai,human}.");
    return;
  }
  const rows: Scored[] = corpus.map((s) => ({ name: s.name, label: s.label, category: s.category, score: analyzeText(s.text).score }));

  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(rows, null, 2));
    return;
  }

  console.log("\n=== Per-sample (AI-likelihood) ===");
  for (const r of [...rows].sort((a, b) => a.category.localeCompare(b.category) || b.score - a.score)) {
    const flagged = r.score >= FLAG;
    const mark = r.label === "ai" ? (flagged ? "ok" : "MISS") : flagged ? "FALSE-POS" : "ok";
    console.log(`  ${pad(r.category, 22)} ${pad(r.name, 34)} ${pad(r.score.toFixed(0), 4)} ${mark}`);
  }
  report("Full-length samples", rows);

  // Short pastes: the instant check accepts 5+ words, so measure how it
  // behaves on snippets. Genuine human snippets must not be flagged.
  for (const n of [40, 70]) {
    const shortRows: Scored[] = corpus.map((s) => ({ name: s.name, label: s.label, category: s.category, score: analyzeText(firstWords(s.text, n)).score }));
    report(`First ${n} words of every sample`, shortRows);
  }

  // Long pastes: real users paste ~400 words on average. Join distinct
  // same-label English samples into longer documents (no duplicated text, so
  // repetition detectors don't fire artificially).
  const longRows: Scored[] = [];
  const englishHuman = corpus.filter((s) => s.category === "human:english");
  const englishAi = corpus.filter((s) => s.label === "ai" && s.category === "ai:default");
  for (const [label, pool] of [["human", englishHuman], ["ai", englishAi]] as const) {
    for (let i = 0; i < pool.length; i++) {
      const parts = [pool[i], pool[(i + 1) % pool.length], pool[(i + 2) % pool.length]];
      const text = parts.map((p) => p.text.trim()).join("\n\n");
      longRows.push({ name: parts.map((p) => p.name).join("+"), label, category: `${label}:long`, score: analyzeText(text).score });
    }
  }
  report("Long documents (3 distinct same-label samples joined)", longRows);

  // Latency: the instant check runs on every keystroke-triggered check in the browser.
  const big = englishHuman.map((s) => s.text).join("\n\n").repeat(6);
  const t0 = performance.now();
  const bigResult = analyzeText(big);
  const ms = performance.now() - t0;
  const t1 = performance.now();
  for (const s of corpus) analyzeText(s.text);
  const perSample = (performance.now() - t1) / corpus.length;
  console.log(`\n=== Latency ===\n  mean per corpus sample: ${perSample.toFixed(2)} ms   ${bigResult.wordCount}-word document: ${ms.toFixed(0)} ms`);

  const human = rows.filter((r) => r.category === "human:english" || r.category === "human:french");
  console.log(`\nHeadline: genuine-human FPR ${pct(human.filter((r) => r.score >= FLAG).length, human.length)}, mean human ${mean(human.map((r) => r.score)).toFixed(1)}, mean AI ${mean(rows.filter((r) => r.label === "ai").map((r) => r.score)).toFixed(1)}`);
}

main();
