// ===========================================================
// HumanizeIt — Text Analysis Engine
// ===========================================================

import {
  type PatternConfig,
  type Severity,
  PATTERNS_CONFIG,
  SEVERITY_MULTIPLIERS,
  SCORE_WEIGHTS,
  AI_VOCABULARY_TIER_1,
  AI_VOCABULARY_TIER_2,
  AI_VOCABULARY_TIER_3,
  SYCOPHANTIC_PHRASES,
  FILLER_PHRASES,
  GENERIC_CONCLUSIONS,
  HEDGING_PHRASES,
  TRANSITION_WORDS,
} from "./patterns";

import {
  computeBurstiness,
  computeTypeTokenRatio,
  computeAvgSentenceLength,
  computeFleschReadingEase,
} from "./stats";

// ---- Types ----

export interface PatternHit {
  id: string;
  label: string;
  hits: number;
  examples: string[];
  severity: Severity;
  weight: number;
}

export interface TextStats {
  burstiness: number;
  typeTokenRatio: number;
  avgSentenceLength: number;
  fleschReadingEase: number;
}

export interface AnalysisResult {
  score: number;
  patterns: PatternHit[];
  stats: TextStats;
  wordCount: number;
}

// ---- Helpers ----

function clamp(min: number, max: number, value: number): number {
  return Math.min(max, Math.max(min, value));
}

function tokenize(text: string): string[] {
  return text.toLowerCase().split(/\s+/).filter(Boolean);
}

function getSentences(text: string): string[] {
  return text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// ---- Pattern Detection ----

function detectVocabularyPattern(
  words: string[],
  vocabulary: readonly string[],
  config: PatternConfig
): PatternHit | null {
  const lowerVocab = vocabulary.map((w) => w.toLowerCase());
  const found: string[] = [];

  for (const word of words) {
    if (lowerVocab.includes(word) && !found.includes(word)) {
      found.push(word);
    }
  }

  if (found.length === 0) return null;

  return {
    id: config.id,
    label: config.label,
    hits: found.length,
    examples: found.slice(0, 5),
    severity: config.severity,
    weight: config.weight,
  };
}

function detectPhrasePattern(
  textLower: string,
  phrases: readonly string[],
  config: PatternConfig
): PatternHit | null {
  const found: string[] = [];

  for (const phrase of phrases) {
    if (textLower.includes(phrase.toLowerCase())) {
      found.push(phrase);
    }
  }

  if (found.length === 0) return null;

  return {
    id: config.id,
    label: config.label,
    hits: found.length,
    examples: found.slice(0, 5),
    severity: config.severity,
    weight: config.weight,
  };
}

// ---- Scoring ----

function computePatternScore(patterns: PatternHit[]): number {
  let raw = 0;
  for (const p of patterns) {
    const multiplier = SEVERITY_MULTIPLIERS[p.severity];
    raw += p.hits * p.weight * multiplier;
  }
  return Math.min(100, raw);
}

function computeStatisticalScore(stats: TextStats): number {
  let score = 0;

  // TODO: Low burstiness → high AI probability
  // AI text typically has burstiness < 0.20
  const burstyScore = stats.burstiness < 0.2 ? 100 : stats.burstiness < 0.4 ? 50 : 0;
  score += burstyScore * 0.3;

  // TODO: Low TTR → high AI probability
  // AI text typically has TTR < 0.40
  const ttrScore = stats.typeTokenRatio < 0.4 ? 100 : stats.typeTokenRatio < 0.55 ? 50 : 0;
  score += ttrScore * 0.25;

  // TODO: Avg sentence length in AI range (18-25)
  const asl = stats.avgSentenceLength;
  const aslScore = asl >= 18 && asl <= 25 ? 80 : asl >= 15 && asl <= 30 ? 40 : 0;
  score += aslScore * 0.25;

  // TODO: Flesch Reading Ease in AI range (40-60)
  const fre = stats.fleschReadingEase;
  const freScore = fre >= 40 && fre <= 60 ? 80 : fre >= 30 && fre <= 70 ? 40 : 0;
  score += freScore * 0.2;

  return Math.min(100, score);
}

function computeStructuralScore(_text: string, _sentences: string[]): number {
  // TODO: Implement structural analysis
  // - Repetitive sentence starters (3+ consecutive with same first word)
  // - List-heavy structure (>30% bullet/numbered content)
  // - Uniform paragraph lengths (all within ±15% of mean)
  // - Perfect grammar (no contractions, fragments, colloquialisms)
  // - Formulaic introduction ("In [topic], [broad claim]")
  // - Formulaic conclusion (restates intro verbatim)
  return 0;
}

// ---- Main Entry Point ----

export function analyzeText(text: string): AnalysisResult {
  const words = tokenize(text);
  const sentences = getSentences(text);
  const textLower = text.toLowerCase();
  const wordCount = words.length;

  // Step 1: Detect vocabulary patterns
  const patterns: PatternHit[] = [];

  const vocabT1 = detectVocabularyPattern(
    words,
    AI_VOCABULARY_TIER_1,
    PATTERNS_CONFIG[0]
  );
  if (vocabT1) patterns.push(vocabT1);

  const vocabT2 = detectVocabularyPattern(
    words,
    AI_VOCABULARY_TIER_2,
    PATTERNS_CONFIG[1]
  );
  if (vocabT2) patterns.push(vocabT2);

  const vocabT3 = detectVocabularyPattern(
    words,
    AI_VOCABULARY_TIER_3,
    PATTERNS_CONFIG[2]
  );
  if (vocabT3) patterns.push(vocabT3);

  // Step 2: Detect phrase patterns
  const sycophantic = detectPhrasePattern(
    textLower,
    SYCOPHANTIC_PHRASES,
    PATTERNS_CONFIG[3]
  );
  if (sycophantic) patterns.push(sycophantic);

  const filler = detectPhrasePattern(
    textLower,
    FILLER_PHRASES,
    PATTERNS_CONFIG[4]
  );
  if (filler) patterns.push(filler);

  const conclusion = detectPhrasePattern(
    textLower,
    GENERIC_CONCLUSIONS,
    PATTERNS_CONFIG[5]
  );
  if (conclusion) patterns.push(conclusion);

  const hedging = detectPhrasePattern(
    textLower,
    HEDGING_PHRASES,
    PATTERNS_CONFIG[6]
  );
  if (hedging) patterns.push(hedging);

  const transitions = detectPhrasePattern(
    textLower,
    TRANSITION_WORDS,
    PATTERNS_CONFIG[7]
  );
  if (transitions) patterns.push(transitions);

  // TODO: Step 3 — Detect structural patterns (9–14)
  // - Repetitive sentence starters
  // - List-heavy structure
  // - Uniform paragraph lengths
  // - Perfect grammar detection
  // - Formulaic intro/conclusion

  // TODO: Step 4 — Detect semantic patterns (15–19)
  // - Over-explanation detection
  // - Balanced viewpoint analysis
  // - Excessive qualifiers count
  // - Abstract language density
  // - Personality/emoji absence check

  // Step 5: Compute statistics
  const stats: TextStats = {
    burstiness: computeBurstiness(sentences),
    typeTokenRatio: computeTypeTokenRatio(words),
    avgSentenceLength: computeAvgSentenceLength(sentences),
    fleschReadingEase: computeFleschReadingEase(text),
  };

  // TODO: Step 6 — Detect statistical patterns (20–24)
  // - Low burstiness → pattern hit
  // - Low TTR → pattern hit
  // - Median sentence length in AI range → pattern hit
  // - Predictable reading level → pattern hit
  // - Low perplexity indicators → pattern hit

  // Step 7: Compute final score
  const patternScore = computePatternScore(patterns);
  const statisticalScore = computeStatisticalScore(stats);
  const structuralScore = computeStructuralScore(text, sentences);

  const score = clamp(
    0,
    100,
    patternScore * SCORE_WEIGHTS.pattern +
      statisticalScore * SCORE_WEIGHTS.statistical +
      structuralScore * SCORE_WEIGHTS.structural
  );

  return {
    score: Math.round(score * 10) / 10,
    patterns,
    stats,
    wordCount,
  };
}
