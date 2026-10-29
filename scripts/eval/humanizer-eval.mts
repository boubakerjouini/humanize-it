// ===========================================================
// scripts/eval/humanizer-eval.mts — Measure the humanizer end to end
//
// Runs humanizeText() on the fixtures and reports, per input: latency, model
// calls, tokens, cost, truncation, length drift, kept facts (numbers, names,
// quotes, URLs), layout (paragraphs, list lines), language, injection and the
// in-house detector score before/after (a secondary signal only: the goal is a
// faithful, natural rewrite, not a score).
//
// SPENDS REAL MONEY on the Anthropic key in .env.local. Only the API key is
// loaded from it; nothing touches the database.
//
//   npx tsx scripts/eval/humanizer-eval.mts --model claude-sonnet-4-5 --set short
//   npx tsx scripts/eval/humanizer-eval.mts --model claude-sonnet-5-5 --set long --budget 1
//
// Flags: --model, --set short|long|all, --only id1,id2, --label, --out dir,
// --budget USD (stops starting new inputs past it). Inputs run one at a time
// so latency and the per-input call log stay exact. Env ANTHROPIC_THINKING /
// ANTHROPIC_EFFORT are honoured (see anthropicParams in lib/llm.ts).
// ===========================================================

import dotenv from "dotenv";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { FIXTURES, LONG_MUST, longText, type Fixture } from "./humanizer-fixtures";

const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i].replace(/^--/, ""), process.argv[i + 1] ?? "");

const model = args.get("model") ?? "claude-sonnet-4-5";
const set = args.get("set") ?? "short";
const label = args.get("label") ?? model;
const budget = Number(args.get("budget") ?? "1.5");
const only = args.get("only")?.split(",").filter(Boolean);
const outDir = args.get("out") ?? path.join(os.tmpdir(), "humanizer-eval");

const env: Record<string, string> = {};
dotenv.config({ path: ".env.local", processEnv: env, quiet: true });
if (!env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY missing from .env.local");
process.env.ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY;
process.env.ANTHROPIC_MODEL = model;
delete process.env.OPENAI_API_KEY; // measure Anthropic only, never the fallback

// $ per million tokens (input, output). Thinking tokens bill as output.
const PRICES: Record<string, [number, number]> = {
  "claude-sonnet-4-5": [3, 15],
  "claude-sonnet-5-5": [2, 10],
  "claude-haiku-5-5": [0.1, 0.5],
  "claude-opus-5-5": [4, 20],
};

interface Call { ms: number; input: number; output: number; stop: string | null }
const calls: Call[] = [];

const { anthropic } = await import("../../lib/anthropic");
const original = anthropic.messages.create.bind(anthropic.messages);
(anthropic.messages as unknown as { create: unknown }).create = async (...a: unknown[]) => {
  const t0 = Date.now();
  const r = (await (original as (...x: unknown[]) => Promise<unknown>)(...a)) as {
    usage: { input_tokens: number; output_tokens: number };
    stop_reason: string | null;
  };
  calls.push({ ms: Date.now() - t0, input: r.usage.input_tokens, output: r.usage.output_tokens, stop: r.stop_reason });
  return r;
};
const { humanizeText } = await import("../../lib/algorithms/humanizeText");
const { analyzeText } = await import("../../lib/algorithms/analyzeText");

const words = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;
const paragraphs = (t: string) => t.split(/\n\s*\n/).filter((p) => p.trim()).length;
const listLines = (t: string) => t.split("\n").filter((l) => /^\s*([-*•]|\d+[.)])\s/.test(l)).length;
const STOP: Record<string, string[]> = {
  en: ["the", "and", "is", "to", "of", "that", "with"],
  fr: ["le", "la", "les", "des", "est", "et", "une", "pour", "dans"],
  es: ["el", "los", "las", "es", "y", "que", "una", "para", "con"],
};
function lang(t: string): string {
  const toks = t.toLowerCase().split(/[^\p{L}]+/u);
  let best = "en", bestN = -1;
  for (const [l, sw] of Object.entries(STOP)) {
    const n = toks.filter((w) => sw.includes(w)).length;
    if (n > bestN) { best = l; bestN = n; }
  }
  return best;
}
const numbersIn = (t: string) => [...new Set(t.match(/\d[\d.,]*\d|\d/g) ?? [])];

interface Row {
  id: string; words: number; ms: number; calls: number; input: number; output: number; cost: number;
  truncated: boolean; ratio: number; mustKept: string; missing: string[]; numsLost: string[];
  paras: string; lists: string; lang: string; langOk: boolean; injected: boolean; emDash: number;
  before: number; after: number; error?: string; output_text?: string;
}

function inputs(): Fixture[] {
  const short = FIXTURES.filter((f) => !only || only.includes(f.id));
  const long = [500, 1500, 3000].map((n) => ({ id: `long-${n}`, kind: `${n}-word essay`, lang: "en" as const, text: longText(n), must: LONG_MUST }));
  const filteredLong = long.filter((f) => !only || only.includes(f.id));
  return set === "short" ? short : set === "long" ? filteredLong : [...short, ...filteredLong];
}

let spent = 0;
async function runOne(f: Fixture): Promise<Row> {
  const before = analyzeText(f.text);
  const t0 = Date.now();
  let out = "";
  let error: string | undefined;
  try {
    const r = await humanizeText(f.text, "standard", before, "medium");
    out = r.humanizedText;
  } catch (e) {
    error = e instanceof Error ? `${e.name}: ${e.message}`.slice(0, 200) : String(e);
  }
  const ms = Date.now() - t0;
  const mine = calls.splice(0); // this input's calls (inputs run one at a time)
  const [pi, po] = PRICES[model] ?? [3, 15];
  const input = mine.reduce((s, c) => s + c.input, 0);
  const output = mine.reduce((s, c) => s + c.output, 0);
  const cost = (input * pi + output * po) / 1e6;
  spent += cost;
  const missing = f.must.filter((m) => !out.includes(m));
  const numsLost = numbersIn(f.text).filter((n) => !out.includes(n));
  const after = out ? analyzeText(out).score : NaN;
  return {
    id: f.id, words: words(f.text), ms, calls: mine.length, input, output, cost: +cost.toFixed(4),
    truncated: mine.some((c) => c.stop === "max_tokens"),
    ratio: out ? +(words(out) / words(f.text)).toFixed(2) : 0,
    mustKept: `${f.must.length - missing.length}/${f.must.length}`, missing, numsLost,
    paras: `${paragraphs(f.text)}->${paragraphs(out)}`, lists: `${listLines(f.text)}->${listLines(out)}`,
    lang: lang(out), langOk: !out || lang(out) === f.lang,
    injected: (f.mustNot ?? []).some((m) => out.toLowerCase().includes(m)),
    emDash: (out.match(/—/g) ?? []).length,
    before: Math.round(before.score), after: Math.round(after), error, output_text: out,
  };
}

const queue = inputs();
const rows: Row[] = [];
for (const f of queue) {
  if (spent > budget) {
    console.error(`budget $${budget} reached, stopping`);
    break;
  }
  const r = await runOne(f);
  rows.push(r);
  console.error(`${r.id}: ${r.ms}ms calls=${r.calls} $${r.cost} ${r.error ?? ""}`);
}

fs.mkdirSync(outDir, { recursive: true });
const file = path.join(outDir, `${label.replace(/[^\w.-]/g, "_")}-${set}.json`);
fs.writeFileSync(file, JSON.stringify({ model, label, set, spent, rows }, null, 2));
console.table(
  rows.map((r) => {
    const { missing, numsLost, ...rest } = r;
    delete rest.output_text;
    return { ...rest, missing: missing.join("|").slice(0, 40), numsLost: numsLost.join("|").slice(0, 30) };
  })
);
console.log(`total $${spent.toFixed(3)} -> ${file}`);
