/**
 * Shared corpus loader + metrics for the detector evals
 * (scripts/detector-eval.ts, scripts/detector-deepscan-eval.ts).
 *
 * Fixtures live in tests/fixtures/detector/{ai,human}; the file name carries
 * the category (see tests/fixtures/detector/README.md). Synthetic human-style
 * samples are reported on their own and never count toward the headline
 * false-positive rate, which is measured on genuinely human writing only.
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

export const ROOT = join(__dirname, "..", "tests", "fixtures", "detector");
export const FLAG = 50; // score >= FLAG counts as "flagged AI"

export type Label = "ai" | "human";
export interface Sample { name: string; label: Label; category: string; text: string }

export function categoryOf(label: Label, name: string): string {
  if (label === "human") {
    if (name.startsWith("synthetic-")) return "human:synthetic-esl";
    if (name.startsWith("fr-")) return "human:french";
    return "human:english";
  }
  if (name.startsWith("fr-")) return "ai:french";
  if (/humanlike|adversarial|evade/.test(name)) return "ai:adversarial";
  if (/-edited/.test(name)) return "ai:edited";
  if (name.startsWith("short-")) return "ai:short";
  return "ai:default";
}

export function loadCorpus(): Sample[] {
  const out: Sample[] = [];
  for (const label of ["ai", "human"] as const) {
    const dir = join(ROOT, label);
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir).filter((x) => x.endsWith(".txt")).sort()) {
      out.push({ name: f.replace(/\.txt$/, ""), label, category: categoryOf(label, f), text: readFileSync(join(dir, f), "utf8") });
    }
  }
  return out;
}

export const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
export const pct = (n: number, d: number) => (d ? `${((n / d) * 100).toFixed(0)}%` : "n/a");
export const pad = (s: string, n: number) => (s + " ".repeat(n)).slice(0, n);

/** Probability that a random AI sample outscores a random human one (ties count half). */
export function auc(ai: number[], human: number[]): number {
  if (!ai.length || !human.length) return NaN;
  let wins = 0;
  for (const a of ai) for (const h of human) wins += a > h ? 1 : a === h ? 0.5 : 0;
  return wins / (ai.length * human.length);
}

export interface Scored { name: string; label: Label; category: string; score: number }

/** Print the standard report block for one set of scored samples. */
export function report(title: string, rows: Scored[]): void {
  const genuineHuman = rows.filter((r) => r.label === "human" && r.category !== "human:synthetic-esl");
  const ai = rows.filter((r) => r.label === "ai");
  const tp = ai.filter((r) => r.score >= FLAG).length;
  const fp = genuineHuman.filter((r) => r.score >= FLAG).length;
  console.log(`\n=== ${title} ===`);
  console.log(`  Confusion @${FLAG} (genuine human only):   flagged-AI   not-flagged`);
  console.log(`    AI    (${pad(String(ai.length), 3)})                         ${pad(String(tp), 12)} ${ai.length - tp}`);
  console.log(`    Human (${pad(String(genuineHuman.length), 3)})                         ${pad(String(fp), 12)} ${genuineHuman.length - fp}`);
  console.log(`  FALSE-POSITIVE RATE (genuine human): ${fp}/${genuineHuman.length} = ${pct(fp, genuineHuman.length)}   recall (all AI): ${pct(tp, ai.length)}`);
  console.log(`  AUC: ${auc(ai.map((r) => r.score), genuineHuman.map((r) => r.score)).toFixed(3)}   highest genuine-human score: ${Math.max(0, ...genuineHuman.map((r) => r.score)).toFixed(0)}`);

  const cats = [...new Set(rows.map((r) => r.category))].sort();
  console.log("  Per category:  n   mean   flagged@50");
  for (const c of cats) {
    const rs = rows.filter((r) => r.category === c);
    const f = rs.filter((r) => r.score >= FLAG).length;
    console.log(`    ${pad(c, 22)} ${pad(String(rs.length), 3)} ${pad(mean(rs.map((r) => r.score)).toFixed(1), 6)} ${f}/${rs.length}`);
  }

  console.log("  Threshold trade-off (genuine human FPR / AI recall):");
  for (const t of [30, 40, 50, 60, 70]) {
    const fpT = genuineHuman.filter((r) => r.score >= t).length;
    const tpT = ai.filter((r) => r.score >= t).length;
    console.log(`    >=${t}: FPR ${pad(pct(fpT, genuineHuman.length), 5)} recall ${pct(tpT, ai.length)}`);
  }

  // Calibration: share of AI samples in each score bin (genuine human + AI).
  console.log("  Calibration (score bin -> share that is AI):");
  const pool = [...ai, ...genuineHuman];
  for (const [lo, hi] of [[0, 25], [25, 45], [45, 70], [70, 101]] as const) {
    const inBin = pool.filter((r) => r.score >= lo && r.score < hi);
    const aiIn = inBin.filter((r) => r.label === "ai").length;
    console.log(`    [${lo}-${hi === 101 ? 100 : hi}) n=${pad(String(inBin.length), 3)} AI share ${pct(aiIn, inBin.length)}`);
  }
}
