/**
 * Feature distribution dump for detector calibration.
 *
 * For every corpus sample, compute the candidate discriminating signals and
 * print AI-mean vs human-mean vs separation for each — so thresholds/weights
 * are chosen from data, not guessed.
 *
 *   npx tsx scripts/detector-features.ts
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  computeBurstiness,
  computeTypeTokenRatio,
  computeAvgSentenceLength,
  computeFleschReadingEase,
} from "../lib/algorithms/stats";
import { analyzeText } from "../lib/algorithms/analyzeText";

const ROOT = join(__dirname, "..", "tests", "fixtures", "detector");

const tokenize = (t: string) => t.toLowerCase().split(/\s+/).filter(Boolean);
const getSentences = (t: string) =>
  t.split(/[.!?]+/).map((s) => s.trim()).filter((s) => s.length > 0);

function sentenceLenCoV(sentences: string[]): number {
  if (sentences.length < 2) return 0;
  const lens = sentences.map((s) => s.split(/\s+/).filter(Boolean).length);
  const mean = lens.reduce((a, b) => a + b, 0) / lens.length;
  if (mean === 0) return 0;
  const variance = lens.reduce((s, v) => s + (v - mean) ** 2, 0) / lens.length;
  return Math.sqrt(variance) / mean;
}

interface Feats {
  name: string;
  label: "ai" | "human";
  // engine output
  score: number;
  patterns: number;
  // stats
  burstiness: number;
  ttr: number;
  asl: number;
  fre: number;
  cov: number;
  // humanness candidates (per 100 words unless noted)
  contractions: number;
  firstPerson: number;
  secondPerson: number;
  informalMarkers: number; // lol/imo/gonna/anyway/honestly... raw count
  lowercaseStarts: number; // % of sentences starting lowercase
  shortFrags: number; // % of sentences < 5 words
  longRuns: number; // % of sentences > 30 words
  commaDensity: number; // commas per sentence
  multiPunct: number; // count of "!!", "...", "?!" etc
  digitTokens: number; // % tokens that are pure numbers
}

const CONTRACTION_RE = /\b\w+(?:'(?:t|s|m|re|ve|ll|d))\b|n't\b/gi;
const FIRST_PERSON_RE = /\b(i|me|my|mine|myself|i'm|i've|i'd|i'll)\b/gi;
const SECOND_PERSON_RE = /\b(you|your|yours|you're|you've|u)\b/gi;
const INFORMAL_RE =
  /\b(lol|lmao|imo|imho|tbh|omg|idk|btw|fyi|gonna|wanna|gotta|kinda|sorta|yeah|yep|nope|nah|anyway|honestly|literally|basically|ok so|okay so|dude|guys|af|ngl)\b/gi;
const MULTI_PUNCT_RE = /([!?]{2,}|\.{3,}|\?!|!\?)/g;

function features(name: string, label: "ai" | "human", text: string): Feats {
  const words = tokenize(text);
  const sentences = getSentences(text);
  const wc = Math.max(words.length, 1);
  const sc = Math.max(sentences.length, 1);
  const per100 = (n: number) => Math.round((n / wc) * 100 * 10) / 10;

  const lowercaseStarts =
    sentences.filter((s) => /^[a-z]/.test(s.trim())).length / sc;
  const shortFrags = sentences.filter((s) => s.split(/\s+/).filter(Boolean).length < 5).length / sc;
  const longRuns = sentences.filter((s) => s.split(/\s+/).filter(Boolean).length > 30).length / sc;
  const commas = (text.match(/,/g) ?? []).length;
  const digitTokens = words.filter((w) => /^\d[\d.,]*$/.test(w)).length;

  const r = analyzeText(text);

  return {
    name,
    label,
    score: r.score,
    patterns: r.patterns.length,
    burstiness: computeBurstiness(sentences),
    ttr: computeTypeTokenRatio(words),
    asl: computeAvgSentenceLength(sentences),
    fre: computeFleschReadingEase(text),
    cov: Math.round(sentenceLenCoV(sentences) * 100) / 100,
    contractions: per100((text.match(CONTRACTION_RE) ?? []).length),
    firstPerson: per100((text.match(FIRST_PERSON_RE) ?? []).length),
    secondPerson: per100((text.match(SECOND_PERSON_RE) ?? []).length),
    informalMarkers: (text.match(INFORMAL_RE) ?? []).length,
    lowercaseStarts: Math.round(lowercaseStarts * 100),
    shortFrags: Math.round(shortFrags * 100),
    longRuns: Math.round(longRuns * 100),
    commaDensity: Math.round((commas / sc) * 100) / 100,
    multiPunct: (text.match(MULTI_PUNCT_RE) ?? []).length,
    digitTokens: Math.round((digitTokens / wc) * 1000) / 10,
  };
}

function load(label: "ai" | "human"): Feats[] {
  const dir = join(ROOT, label);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".txt"))
    .map((f) => features(f, label, readFileSync(join(dir, f), "utf8")));
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const pad = (s: string, n: number) => (s + " ".repeat(n)).slice(0, n);
const num = (x: number, n = 6) => pad(x.toFixed(2), n);

function main() {
  const ai = load("ai");
  const human = load("human");
  if (!ai.length && !human.length) {
    console.log("No fixtures. Run scripts/gen-corpus.ts first.");
    return;
  }

  const cols: (keyof Feats)[] = [
    "score", "patterns", "burstiness", "ttr", "asl", "fre", "cov",
    "contractions", "firstPerson", "secondPerson", "informalMarkers",
    "lowercaseStarts", "shortFrags", "longRuns", "commaDensity", "multiPunct", "digitTokens",
  ];

  console.log("\n=== Per-sample features ===");
  const header = pad("LABEL", 6) + " " + pad("NAME", 26) + cols.map((c) => pad(c, 9)).join("");
  console.log(header);
  for (const f of [...ai, ...human]) {
    const row = pad(f.label.toUpperCase(), 6) + " " + pad(f.name.replace(".txt", ""), 26) +
      cols.map((c) => pad(String((f as any)[c]), 9)).join("");
    console.log(row);
  }

  console.log("\n=== AI-mean / human-mean / separation (AI-human) ===");
  console.log(pad("FEATURE", 18) + pad("AI", 9) + pad("HUMAN", 9) + pad("SEP", 9));
  for (const c of cols) {
    const a = mean(ai.map((f) => Number((f as any)[c])));
    const h = mean(human.map((f) => Number((f as any)[c])));
    console.log(pad(c, 18) + num(a, 9) + num(h, 9) + num(a - h, 9));
  }
}

main();
