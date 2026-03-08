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
  PROMOTIONAL_ADJECTIVES,
  VAGUE_ATTRIBUTION_PHRASES,
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
  category: "vocabulary" | "phrase" | "structural" | "semantic" | "statistical";
}

export interface TextStats {
  burstiness: number;
  typeTokenRatio: number;
  avgSentenceLength: number;
  fleschReadingEase: number;
}

export type ConfidenceBand = "likely-human" | "uncertain" | "possibly-ai" | "likely-ai";

export interface AnalysisResult {
  score: number;
  confidenceBand: ConfidenceBand;
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

function getConfigById(id: string): PatternConfig {
  const cfg = PATTERNS_CONFIG.find((p) => p.id === id);
  if (!cfg) throw new Error(`Pattern config not found: ${id}`);
  return cfg;
}

function stddev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
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
    category: config.category,
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
    category: config.category,
  };
}

// ---- Structural Pattern Detectors (9–14) ----

/**
 * Pattern 9: Repetitive Sentence Starters
 * 3+ consecutive sentences starting with the same word (The/It/This).
 */
function detectRepetitiveStarters(sentences: string[]): PatternHit | null {
  const config = getConfigById("repetitive-starters");
  let hits = 0;
  const examples: string[] = [];

  let i = 0;
  while (i < sentences.length) {
    const firstWord = sentences[i].trim().split(/\s+/)[0]?.toLowerCase() ?? "";
    if (!firstWord) { i++; continue; }

    // Count consecutive sentences starting with the same word
    let runLength = 1;
    while (
      i + runLength < sentences.length &&
      sentences[i + runLength].trim().split(/\s+/)[0]?.toLowerCase() === firstWord
    ) {
      runLength++;
    }

    if (runLength >= 3) {
      hits++;
      if (examples.length < 3) {
        examples.push(`"${firstWord}" (${runLength} consecutive)`);
      }
    }

    i += runLength;
  }

  if (hits === 0) return null;

  return {
    id: config.id,
    label: config.label,
    hits,
    examples,
    severity: config.severity,
    weight: config.weight,
    category: config.category,
  };
}

/**
 * Pattern 10: List-Heavy Structure
 * More than 30% of lines are bullet/numbered list items.
 */
function detectListHeavy(text: string): PatternHit | null {
  const config = getConfigById("list-heavy");
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length === 0) return null;

  const listLines = lines.filter((l) =>
    /^(\s*[-*•]|\s*\d+\.)/.test(l)
  );

  const ratio = listLines.length / lines.length;
  if (ratio <= 0.3) return null;

  return {
    id: config.id,
    label: config.label,
    hits: listLines.length,
    examples: [`${Math.round(ratio * 100)}% of lines are list items`],
    severity: config.severity,
    weight: config.weight,
    category: config.category,
  };
}

/**
 * Pattern 11: Uniform Paragraph Length
 * All paragraphs within ±15% of average word count.
 */
function detectUniformParagraphs(text: string): PatternHit | null {
  const config = getConfigById("uniform-paragraphs");
  const paragraphs = text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  if (paragraphs.length < 3) return null;

  const wordCounts = paragraphs.map(
    (p) => p.split(/\s+/).filter(Boolean).length
  );
  const mean = wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length;
  if (mean === 0) return null;

  const sd = stddev(wordCounts);
  const relativeStddev = sd / mean;

  if (relativeStddev >= 0.15) return null;

  return {
    id: config.id,
    label: config.label,
    hits: 1,
    examples: [
      `${paragraphs.length} paragraphs, std dev ${Math.round(relativeStddev * 100)}% of mean (< 15%)`,
    ],
    severity: config.severity,
    weight: config.weight,
    category: config.category,

  };
}

/**
 * Pattern 12: Perfect Grammar
 * Zero contractions, no informal markers — flagged for longer texts.
 */
function detectPerfectGrammar(text: string, wordCount: number): PatternHit | null {
  if (wordCount < 100) return null;

  const config = getConfigById("perfect-grammar");

  const contractionPattern =
    /\b(don't|can't|won't|I'm|it's|they're|we're|you're|I've|I'd|I'll|isn't|aren't|wasn't|weren't|hasn't|haven't|hadn't|doesn't|didn't|wouldn't|couldn't|shouldn't|that's|there's|here's|who's|what's|let's)\b/i;

  const informalPattern =
    /\b(gonna|wanna|gotta|kinda|sorta|yeah|yep|nope|ok|okay|hey|wow|oops|duh|ugh|hmm)\b/i;

  const hasContractions = contractionPattern.test(text);
  const hasInformal = informalPattern.test(text);

  if (hasContractions || hasInformal) return null;

  return {
    id: config.id,
    label: config.label,
    hits: 1,
    examples: ["No contractions or informal markers detected"],
    severity: config.severity,
    weight: config.weight,
    category: config.category,
  };
}

/**
 * Pattern 13: Formulaic Introduction
 * Opening matches AI-typical intro templates.
 */
function detectFormulaicIntro(sentences: string[]): PatternHit | null {
  if (sentences.length === 0) return null;

  const config = getConfigById("formulaic-intro");
  const firstSentence = sentences[0].toLowerCase().trim();

  const introPatterns = [
    /^in today's\s+(rapidly\s+)?(evolving|changing|complex|digital|modern|fast-paced|dynamic)/,
    /^when it comes to/,
    /^in the (realm|world|context|domain|field|landscape) of/,
    /^in (recent|today's|this|our)/,
    /^the (concept|notion|idea|importance|role|impact|significance) of/,
    /^as (society|technology|we|businesses|organizations|the world)/,
    /^in an (increasingly|ever-changing|rapidly)/,
    /^(understanding|exploring|examining|considering) (the|how|why|what)/,
  ];

  const matched = introPatterns.find((pat) => pat.test(firstSentence));
  if (!matched) return null;

  return {
    id: config.id,
    label: config.label,
    hits: 1,
    examples: [sentences[0].slice(0, 80) + (sentences[0].length > 80 ? "…" : "")],
    severity: config.severity,
    weight: config.weight,
    category: config.category,
  };
}

/**
 * Pattern 14: Formulaic Conclusion
 * Last paragraph contains generic conclusion phrases.
 */
function detectFormulaicConclusion(text: string, textLower: string): PatternHit | null {
  const config = getConfigById("formulaic-conclusion");

  const paragraphs = text.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  const lastParagraph =
    paragraphs.length > 0
      ? paragraphs[paragraphs.length - 1].toLowerCase()
      : textLower.slice(-300).toLowerCase();

  const conclusionPhrases = [
    "in conclusion",
    "to sum up",
    "in summary",
    "as we have seen",
    "moving forward",
    "to summarize",
    "all things considered",
    "taking everything into account",
    "in light of the above",
    "overall, it is clear",
    // Also include all GENERIC_CONCLUSIONS phrases
    ...GENERIC_CONCLUSIONS.map(p => p.toLowerCase()),
  ];

  const found = conclusionPhrases.filter((phrase) =>
    lastParagraph.includes(phrase)
  );

  if (found.length === 0) return null;

  return {
    id: config.id,
    label: config.label,
    hits: found.length,
    examples: found.slice(0, 3),
    severity: config.severity,
    weight: config.weight,
    category: config.category,
  };
}

// ---- Semantic Pattern Detectors (15–19) ----

/**
 * Pattern 15: Over-Explanation
 * Terms defined right after being used.
 */
function detectOverExplanation(text: string): PatternHit | null {
  const config = getConfigById("over-explanation");

  const patterns = [
    /\b\w+\s*\(also known as\s+\w+\)/gi,
    /\b\w[\w\s]+,\s+which means\b/gi,
    /\b\w[\w\s]+,\s+defined as\b/gi,
    /\b\w[\w\s]+,\s+referred to as\b/gi,
    /\b\w[\w\s]+\s+\(or\s+simply\s+\w+\)/gi,
  ];

  const found: string[] = [];

  for (const pattern of patterns) {
    const matches = text.match(pattern) ?? [];
    for (const m of matches) {
      if (!found.includes(m)) found.push(m.slice(0, 50));
    }
  }

  if (found.length === 0) return null;

  return {
    id: config.id,
    label: config.label,
    hits: found.length,
    examples: found.slice(0, 3),
    severity: config.severity,
    weight: config.weight,
    category: config.category,
  };
}

/**
 * Pattern 16: Balanced Viewpoint
 * "while/although/however/nevertheless" heavy texts.
 */
function detectBalancedViewpoint(text: string, wordCount: number): PatternHit | null {
  if (wordCount < 50) return null;

  const config = getConfigById("balanced-viewpoint");

  const balancingPhrases = [
    /\bwhile\b/gi,
    /\balthough\b/gi,
    /\bon one hand\b/gi,
    /\bon the other hand\b/gi,
    /\bhowever\b/gi,
    /\bnevertheless\b/gi,
    /\byet\b/gi,
    /\bconversely\b/gi,
  ];

  let totalHits = 0;
  const examples: string[] = [];

  for (const pat of balancingPhrases) {
    const matches = text.match(pat) ?? [];
    if (matches.length > 0) {
      totalHits += matches.length;
      examples.push(`"${pat.source.replace(/\\b/g, "")}" ×${matches.length}`);
    }
  }

  // Flag if ratio > 1 per 100 words
  const ratio = (totalHits / wordCount) * 100;
  if (ratio <= 1) return null;

  return {
    id: config.id,
    label: config.label,
    hits: totalHits,
    examples: examples.slice(0, 3),
    severity: config.severity,
    weight: config.weight,
    category: config.category,
  };
}

/**
 * Pattern 17: Excessive Qualifiers
 * Overuse of intensifiers/qualifiers.
 */
function detectExcessiveQualifiers(text: string, wordCount: number): PatternHit | null {
  if (wordCount === 0) return null;

  const config = getConfigById("excessive-qualifiers");

  const qualifiers = [
    "very",
    "extremely",
    "highly",
    "particularly",
    "especially",
    "incredibly",
    "absolutely",
    "utterly",
    "remarkably",
    "significantly",
  ];

  const textLower = text.toLowerCase();
  const found: string[] = [];
  let totalCount = 0;

  for (const q of qualifiers) {
    const regex = new RegExp(`\\b${q}\\b`, "gi");
    const matches = textLower.match(regex) ?? [];
    if (matches.length > 0) {
      totalCount += matches.length;
      found.push(`"${q}" ×${matches.length}`);
    }
  }

  const density = (totalCount / wordCount) * 100;
  if (density <= 3) return null;

  return {
    id: config.id,
    label: config.label,
    hits: totalCount,
    examples: found.slice(0, 4),
    severity: config.severity,
    weight: config.weight,
    category: config.category,
  };
}

/**
 * Pattern 18: Abstract Language
 * High density of abstract nouns with no concrete examples.
 */
function detectAbstractLanguage(text: string, wordCount: number): PatternHit | null {
  if (wordCount < 50) return null;

  const config = getConfigById("abstract-language");

  const abstractNouns = [
    "concept",
    "notion",
    "idea",
    "aspect",
    "factor",
    "element",
    "approach",
    "perspective",
    "framework",
    "paradigm",
    "dimension",
    "component",
  ];

  const textLower = text.toLowerCase();
  let abstractCount = 0;
  const found: string[] = [];

  for (const noun of abstractNouns) {
    const regex = new RegExp(`\\b${noun}s?\\b`, "gi");
    const matches = textLower.match(regex) ?? [];
    if (matches.length > 0) {
      abstractCount += matches.length;
      found.push(noun);
    }
  }

  const density = (abstractCount / wordCount) * 100;
  if (density <= 5) return null;

  // Check for concrete examples (numbers or proper nouns — capitalized words not at sentence start)
  const hasNumbers = /\d+/.test(text);
  const hasProperNouns = /(?<=[.!?]\s+|^|\n)(?![A-Z][a-z]+\s)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/.test(
    text
  );

  if (hasNumbers || hasProperNouns) return null;

  return {
    id: config.id,
    label: config.label,
    hits: abstractCount,
    examples: found.slice(0, 5),
    severity: config.severity,
    weight: config.weight,
    category: config.category,
  };
}

/**
 * Pattern 19: No Personality
 * For texts >200 words: no question marks, exclamations, em dashes, parentheses, first-person.
 */
function detectNoPersonality(text: string, wordCount: number): PatternHit | null {
  if (wordCount < 200) return null;

  const config = getConfigById("no-personality");

  const hasQuestionMark = text.includes("?");
  const hasExclamation = text.includes("!");
  const hasEmDash = text.includes("—") || text.includes("--");
  const hasParentheses = text.includes("(") && text.includes(")");
  const hasFirstPerson =
    /\b(I|I'm|I've|I'd|I'll|my|me|myself)\b/.test(text);

  if (
    hasQuestionMark ||
    hasExclamation ||
    hasEmDash ||
    hasParentheses ||
    hasFirstPerson
  ) {
    return null;
  }

  return {
    id: config.id,
    label: config.label,
    hits: 1,
    examples: ["No questions, exclamations, em dashes, parentheses, or first-person voice"],
    severity: config.severity,
    weight: config.weight,
    category: config.category,
  };
}

// ---- Statistical Pattern Detectors (20–24) ----

/**
 * Pattern 20: Low Burstiness
 */
function detectLowBurstiness(burstiness: number): PatternHit | null {
  if (burstiness >= 0.2) return null;
  const config = getConfigById("low-burstiness");
  return {
    id: config.id,
    label: config.label,
    hits: 1,
    examples: [`Burstiness: ${burstiness} (AI-typical < 0.20)`],
    severity: config.severity,
    weight: config.weight,
    category: config.category,
  };
}

/**
 * Pattern 21: Low Type-Token Ratio
 */
function detectLowTTR(ttr: number): PatternHit | null {
  if (ttr >= 0.4) return null;
  const config = getConfigById("low-ttr");
  return {
    id: config.id,
    label: config.label,
    hits: 1,
    examples: [`TTR: ${ttr} (AI-typical < 0.40)`],
    severity: config.severity,
    weight: config.weight,
    category: config.category,
  };
}

/**
 * Pattern 22: Median Sentence Length
 */
function detectMedianSentenceLen(avgSentenceLength: number): PatternHit | null {
  if (avgSentenceLength < 18 || avgSentenceLength > 25) return null;
  const config = getConfigById("median-sentence-len");
  return {
    id: config.id,
    label: config.label,
    hits: 1,
    examples: [`Avg sentence length: ${avgSentenceLength} words (AI-typical: 18–25)`],
    severity: config.severity,
    weight: config.weight,
    category: config.category,
  };
}

/**
 * Pattern 23: Predictable Reading Level
 */
function detectPredictableReading(flesch: number): PatternHit | null {
  if (flesch < 40 || flesch > 60) return null;
  const config = getConfigById("predictable-reading");
  return {
    id: config.id,
    label: config.label,
    hits: 1,
    examples: [`Flesch: ${flesch} (AI-typical range 40–60)`],
    severity: config.severity,
    weight: config.weight,
    category: config.category,
  };
}

/**
 * Pattern 24: Low Perplexity Indicators
 * > 60% of sentences start with common AI sentence starters.
 */
function detectLowPerplexity(sentences: string[]): PatternHit | null {
  if (sentences.length < 5) return null;

  const config = getConfigById("low-perplexity");

  const commonStarters = new Set([
    "the", "it", "this", "in", "for", "when", "while", "as", "if",
    "there", "these", "one", "many", "most", "some", "such", "by",
    "with", "a", "an",
  ]);

  let predictableCount = 0;
  for (const sentence of sentences) {
    const firstWord = sentence.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
    if (commonStarters.has(firstWord)) {
      predictableCount++;
    }
  }

  const ratio = predictableCount / sentences.length;
  if (ratio <= 0.6) return null;

  return {
    id: config.id,
    label: config.label,
    hits: predictableCount,
    examples: [
      `${Math.round(ratio * 100)}% of sentences start with common AI starters`,
    ],
    severity: config.severity,
    weight: config.weight,
    category: config.category,
  };
}

// ---- New Pattern Detectors (25–29) ----

/**
 * Pattern 25: Em Dash Overuse
 * ChatGPT uses em dashes (—) heavily. >2 in <500 words or >4 in longer text → flag.
 */
function detectEmDash(text: string, wordCount: number): PatternHit | null {
  const matches = (text.match(/—/g) || []).length;
  if (matches === 0) return null;
  // Use density: flag if > 4 em dashes per 100 words (AI uses them extremely densely)
  const density = (matches * 100) / Math.max(wordCount, 1);
  if (density <= 4) return null;
  const config = getConfigById("em-dash-overuse");
  return {
    id: config.id,
    label: config.label,
    hits: matches,
    examples: [`Found ${matches} em dashes (—) — ${density.toFixed(1)} per 100 words`],
    severity: config.severity,
    weight: config.weight,
    category: config.category,
  };
}

/**
 * Pattern 26: Colon Abuse
 * AI uses colons heavily to introduce lists/explanations. ratio colons/sentences > 0.3 → flag.
 */
function detectColonAbuse(text: string, sentences: string[]): PatternHit | null {
  if (sentences.length === 0) return null;
  const colonCount = (text.match(/:/g) || []).length;
  const ratio = colonCount / sentences.length;
  if (ratio <= 0.3) return null;
  const config = getConfigById("colon-abuse");
  return {
    id: config.id,
    label: config.label,
    hits: colonCount,
    examples: [`${colonCount} colons across ${sentences.length} sentences (ratio: ${ratio.toFixed(2)})`],
    severity: config.severity,
    weight: config.weight,
    category: config.category,
  };
}

/**
 * Pattern 27: Passive Voice Excess
 * AI overuses passive voice. >3 per 100 words → flag.
 */
function detectPassiveVoice(text: string, wordCount: number): PatternHit | null {
  if (wordCount === 0) return null;
  const passiveRegex = /\b(is|are|was|were|has been|have been|will be|being)\s+\w+ed\b/gi;
  const matches = text.match(passiveRegex) || [];
  const rate = (matches.length / wordCount) * 100;
  if (rate <= 3) return null;
  const config = getConfigById("passive-voice");
  return {
    id: config.id,
    label: config.label,
    hits: matches.length,
    examples: matches.slice(0, 4).map(m => `"${m}"`),
    severity: config.severity,
    weight: config.weight,
    category: config.category,
  };
}

/**
 * Pattern 28: Oxford Comma Serial Listing
 * AI lists in "A, B, and C" format. Detect Oxford comma + 3-item lists.
 */
function detectSerialListing(text: string): PatternHit | null {
  // Matches: word/phrase, word/phrase, and word
  const serialRegex = /\b[\w][\w\s]{1,30},\s+[\w][\w\s]{1,30},\s+and\s+[\w]/gi;
  const matches = text.match(serialRegex) || [];
  if (matches.length === 0) return null;
  const config = getConfigById("serial-listing");
  return {
    id: config.id,
    label: config.label,
    hits: matches.length,
    examples: matches.slice(0, 3).map(m => `"${m.slice(0, 60)}"`),
    severity: config.severity,
    weight: config.weight,
    category: config.category,
  };
}

/**
 * Pattern 29: Rhetorical Questions
 * AI opens/closes paragraphs with rhetorical questions starting with interrogative words.
 */
function detectRhetoricalQuestions(text: string): PatternHit | null {
  // Split text into sentences that end with ?
  const questionRegex = /\b(What|Why|How|Is|Are|Can|Should|Do|Does)[^.!?]*\?/gi;
  const matches = text.match(questionRegex) || [];
  if (matches.length === 0) return null;
  const config = getConfigById("rhetorical-questions");
  return {
    id: config.id,
    label: config.label,
    hits: matches.length,
    examples: matches.slice(0, 3).map(m => `"${m.slice(0, 80)}"`),
    severity: config.severity,
    weight: config.weight,
    category: config.category,
  };
}

// ---- New Pattern Detectors V2 (30–37) ----

/**
 * Pattern 30: Vague Attributions
 * "Experts say", "Studies show" without naming actual source.
 */
function detectVagueAttributions(textLower: string): PatternHit | null {
  const config = PATTERNS_CONFIG.find(p => p.id === "vague-attribution")!;
  const found: string[] = [];
  for (const phrase of VAGUE_ATTRIBUTION_PHRASES) {
    if (textLower.includes(phrase.toLowerCase())) found.push(phrase);
  }
  if (found.length === 0) return null;
  return { id: config.id, label: config.label, hits: found.length, examples: found.slice(0, 4), severity: config.severity, weight: config.weight, category: config.category };
}

/**
 * Pattern 31: Copula Avoidance
 * "serves as", "boasts", "stands as" instead of "is" / "has".
 */
function detectCopulaAvoidance(text: string): PatternHit | null {
  const config = PATTERNS_CONFIG.find(p => p.id === "copula-avoidance")!;
  const patterns = [/\bserves as\b/gi, /\bstands as\b/gi, /\bboasts\b/gi, /\bacts as\b/gi, /\bfunctions as\b/gi];
  const found: string[] = [];
  let hits = 0;
  for (const pat of patterns) {
    const matches = text.match(pat) ?? [];
    if (matches.length) { hits += matches.length; found.push(`"${pat.source.replace(/\\b/g,'')}" ×${matches.length}`); }
  }
  if (hits === 0) return null;
  return { id: config.id, label: config.label, hits, examples: found.slice(0, 4), severity: config.severity, weight: config.weight, category: config.category };
}

/**
 * Pattern 32: Negative Parallelism
 * "It's not just X, it's Y" / "Not only X, but also Y" — rhetorical AI structure.
 */
function detectNegativeParallelism(text: string): PatternHit | null {
  const config = PATTERNS_CONFIG.find(p => p.id === "negative-parallelism")!;
  const patterns = [/it'?s not just\b/gi, /not (just|only|merely)\b[^.!?]+(it'?s|but also|but)\b/gi, /not only\b[^.!?]+but also\b/gi];
  let hits = 0;
  const examples: string[] = [];
  for (const pat of patterns) {
    const matches = text.match(pat) ?? [];
    hits += matches.length;
    matches.slice(0,2).forEach(m => examples.push(`"${m.slice(0,60)}"`));
  }
  if (hits === 0) return null;
  return { id: config.id, label: config.label, hits, examples: examples.slice(0,3), severity: config.severity, weight: config.weight, category: config.category };
}

/**
 * Pattern 33: Promotional -ing Chain
 * AI links ideas with "showcasing", "highlighting", "demonstrating", "reflecting" as empty connectors.
 */
function detectPromotionalIngChain(text: string, wordCount: number): PatternHit | null {
  if (wordCount < 50) return null;
  const config = PATTERNS_CONFIG.find(p => p.id === "promotional-ing")!;
  const ingWords = ["showcasing", "highlighting", "demonstrating", "reflecting", "underscoring", "emphasizing", "illustrating", "reinforcing"];
  const textLower = text.toLowerCase();
  const found: string[] = [];
  let hits = 0;
  for (const word of ingWords) {
    const regex = new RegExp(`\\b${word}\\b`, "gi");
    const matches = textLower.match(regex) ?? [];
    if (matches.length) { hits += matches.length; found.push(`"${word}" ×${matches.length}`); }
  }
  const density = (hits / wordCount) * 100;
  if (density <= 1) return null;
  return { id: config.id, label: config.label, hits, examples: found.slice(0,4), severity: config.severity, weight: config.weight, category: config.category };
}

/**
 * Pattern 34: Vague Challenges Formula
 * "Despite [challenges/X], [Y] continues to [thrive/grow/evolve]"
 */
function detectVagueChallenge(text: string): PatternHit | null {
  const config = PATTERNS_CONFIG.find(p => p.id === "vague-challenge")!;
  const patterns = [
    /despite\s+(challenges|obstacles|setbacks|difficulties|uncertainty)[^.!?]+(continues? to|remains?|still|persists?)/gi,
    /continues? to (thrive|grow|evolve|excel|succeed|flourish)/gi,
    /in spite of [^.!?]+(continues?|remains?|still)/gi,
  ];
  let hits = 0;
  const examples: string[] = [];
  for (const pat of patterns) {
    const matches = text.match(pat) ?? [];
    hits += matches.length;
    matches.slice(0,2).forEach(m => examples.push(`"${m.slice(0,70)}"`));
  }
  if (hits === 0) return null;
  return { id: config.id, label: config.label, hits, examples: examples.slice(0,3), severity: config.severity, weight: config.weight, category: config.category };
}

/**
 * Pattern 35: Promotional Adjectives
 * AI travel/marketing adjectives used in non-marketing contexts.
 */
function detectPromotionalAdjectives(words: string[]): PatternHit | null {
  const config = PATTERNS_CONFIG.find(p => p.id === "promotional-adjectives")!;
  const lowerPromo = PROMOTIONAL_ADJECTIVES.map(w => w.toLowerCase());
  const found: string[] = [];
  for (const word of words) {
    if (lowerPromo.includes(word) && !found.includes(word)) found.push(word);
  }
  if (found.length === 0) return null;
  return { id: config.id, label: config.label, hits: found.length, examples: found.slice(0,5), severity: config.severity, weight: config.weight, category: config.category };
}

/**
 * Pattern 36: Trigram Repetition
 * AI reuses 3-word sequences. Ratio repeated trigrams > 0.08 → flag.
 */
function detectTrigramRepetition(words: string[]): PatternHit | null {
  if (words.length < 20) return null;
  const config = PATTERNS_CONFIG.find(p => p.id === "trigram-repetition")!;
  const trigrams: Record<string, number> = {};
  for (let i = 0; i < words.length - 2; i++) {
    const key = `${words[i]} ${words[i+1]} ${words[i+2]}`;
    trigrams[key] = (trigrams[key] ?? 0) + 1;
  }
  const total = Object.keys(trigrams).length;
  const repeated = Object.entries(trigrams).filter(([,v]) => v > 1);
  const ratio = repeated.length / Math.max(total, 1);
  if (ratio <= 0.08) return null;
  const examples = repeated.sort(([,a],[,b]) => b - a).slice(0,4).map(([k,v]) => `"${k}" ×${v}`);
  return { id: config.id, label: config.label, hits: repeated.length, examples, severity: config.severity, weight: config.weight, category: config.category };
}

/**
 * Pattern 37: Uniform Sentence Length (Low CoV)
 * Humans write in bursts — varying short and long sentences.
 * CoV of sentence word counts < 0.30 → AI-typical metronomic rhythm.
 */
function detectLowSentenceCoV(sentences: string[]): PatternHit | null {
  if (sentences.length < 6) return null;
  const config = PATTERNS_CONFIG.find(p => p.id === "low-sentence-cov")!;
  const lengths = sentences.map(s => s.split(/\s+/).filter(Boolean).length);
  const mean = lengths.reduce((a,b) => a+b, 0) / lengths.length;
  if (mean === 0) return null;
  const variance = lengths.reduce((sum,v) => sum + (v - mean)**2, 0) / lengths.length;
  const cov = Math.sqrt(variance) / mean;
  if (cov >= 0.30) return null;
  return {
    id: config.id, label: config.label, hits: 1,
    examples: [`Sentence length CoV: ${cov.toFixed(2)} (AI-typical < 0.30, human typical > 0.50)`],
    severity: config.severity, weight: config.weight, category: config.category,
  };
}

/** Compute confidence band from score */
function getConfidenceBand(score: number): ConfidenceBand {
  if (score < 25) return "likely-human";
  if (score < 45) return "uncertain";
  if (score < 70) return "possibly-ai";
  return "likely-ai";
}

// ---- V3 Pattern Detectors (38–40) ----

/**
 * Pattern 38: Casual AI Opener Phrases
 * AI tries to sound casual with stock opener phrases.
 */
function detectCasualAIOpener(text: string): PatternHit | null {
  const config = PATTERNS_CONFIG.find(p => p.id === "casual-ai-opener")!;
  const phrases = [
    "so i've been thinking", "can we talk about", "okay so", "i gotta say",
    "here's the thing", "i've been really", "not gonna lie", "let's be honest",
    "the thing about", "update on", "i've been kind of",
  ];
  const textLower = text.toLowerCase();
  const found: string[] = [];
  for (const phrase of phrases) {
    if (textLower.includes(phrase)) found.push(phrase);
  }
  if (found.length < 2) return null;
  return { id: config.id, label: config.label, hits: found.length, examples: found.slice(0, 5), severity: config.severity, weight: config.weight, category: config.category };
}

/**
 * Pattern 39: AI Meta-Commentary
 * AI overuses "I think", "I believe", "I feel like" etc. to simulate opinion.
 */
function detectAIMetaCommentary(text: string, wordCount: number): PatternHit | null {
  if (wordCount <= 100) return null;
  const config = PATTERNS_CONFIG.find(p => p.id === "ai-metacommentary")!;
  const matches = text.match(/\b(I think|I believe|I feel like|I wonder|I'm not sure|maybe|perhaps)\b/gi) ?? [];
  const rate = (matches.length / wordCount) * 100;
  if (rate <= 4) return null;
  return { id: config.id, label: config.label, hits: matches.length, examples: matches.slice(0, 5), severity: config.severity, weight: config.weight, category: config.category };
}

/**
 * Pattern 40: Melodramatic Descriptors (AI Creative)
 * AI creative writing uses melodramatic/purple-prose vocabulary.
 */
function detectCreativeAIMelodrama(words: string[]): PatternHit | null {
  const config = PATTERNS_CONFIG.find(p => p.id === "creative-ai-melodrama")!;
  const melodramaticWords = new Set([
    "cascaded", "trembling", "shimmered", "whispered", "hollowness", "luminous",
    "ephemeral", "liminal", "aching", "yearning", "haunting", "ineffable", "ethereal", "luminescent",
    "weightless", "unspoken", "profound", "resonated", "visceral", "tender", "threshold", "piercing",
  ]);
  const found: string[] = [];
  for (const word of words) {
    if (melodramaticWords.has(word) && !found.includes(word)) found.push(word);
  }
  if (found.length < 4) return null;
  return { id: config.id, label: config.label, hits: found.length, examples: found.slice(0, 5), severity: config.severity, weight: config.weight, category: config.category };
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

  // Low burstiness → high AI probability (wider thresholds)
  const burstyScore =
    stats.burstiness < 0.15 ? 100 :
    stats.burstiness < 0.30 ? 80 :
    stats.burstiness < 0.45 ? 50 :
    stats.burstiness < 0.55 ? 20 : 0;
  score += burstyScore * 0.3;

  // Low TTR → high AI probability (stricter thresholds)
  const ttrScore =
    stats.typeTokenRatio < 0.35 ? 100 :
    stats.typeTokenRatio < 0.45 ? 70 :
    stats.typeTokenRatio < 0.55 ? 40 : 0;
  score += ttrScore * 0.25;

  // Avg sentence length in AI range (wider)
  const asl = stats.avgSentenceLength;
  const aslScore = asl >= 15 && asl <= 30 ? 85 : asl >= 12 && asl <= 35 ? 45 : 0;
  score += aslScore * 0.25;

  // Flesch Reading Ease in AI range (wider)
  const fre = stats.fleschReadingEase;
  const freScore = fre >= 35 && fre <= 65 ? 85 : fre >= 25 && fre <= 75 ? 45 : 0;
  score += freScore * 0.2;

  return Math.min(100, score);
}

function computeStructuralScore(
  structuralPatterns: PatternHit[]
): number {
  // Score based on structural patterns found
  // Each structural pattern has a severity and weight — use same formula
  if (structuralPatterns.length === 0) return 0;

  let raw = 0;
  for (const p of structuralPatterns) {
    const multiplier = SEVERITY_MULTIPLIERS[p.severity];
    raw += p.hits * p.weight * multiplier;
  }

  // Normalize: max possible structural score would be ~150 points
  // (6 patterns: 2 high×5×2 + 2 medium×3×1.5 + 1 low×2×1 = 20+9+2 = 31 at minimum hits)
  // We cap at 100
  return Math.min(100, raw * 2); // ×2 to give structural patterns more weight within their category
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

  // Step 3: Detect structural patterns (9–14)
  const structuralHits: PatternHit[] = [];

  const repStarters = detectRepetitiveStarters(sentences);
  if (repStarters) structuralHits.push(repStarters);

  const listHeavy = detectListHeavy(text);
  if (listHeavy) structuralHits.push(listHeavy);

  const uniformPara = detectUniformParagraphs(text);
  if (uniformPara) structuralHits.push(uniformPara);

  const perfectGrammar = detectPerfectGrammar(text, wordCount);
  if (perfectGrammar) structuralHits.push(perfectGrammar);

  const formulaicIntro = detectFormulaicIntro(sentences);
  if (formulaicIntro) structuralHits.push(formulaicIntro);

  const formulaicConclusion = detectFormulaicConclusion(text, textLower);
  if (formulaicConclusion) structuralHits.push(formulaicConclusion);

  // New structural patterns (25-29)
  const emDash = detectEmDash(text, wordCount);
  if (emDash) structuralHits.push(emDash);

  const colonAbuse = detectColonAbuse(text, sentences);
  if (colonAbuse) structuralHits.push(colonAbuse);

  const passiveVoice = detectPassiveVoice(text, wordCount);
  if (passiveVoice) structuralHits.push(passiveVoice);

  const serialListing = detectSerialListing(text);
  if (serialListing) structuralHits.push(serialListing);

  const rhetoricalQuestions = detectRhetoricalQuestions(text);
  if (rhetoricalQuestions) structuralHits.push(rhetoricalQuestions);

  // Add structural patterns to main patterns list
  patterns.push(...structuralHits);

  // Step 3b: New V2 pattern detectors
  const vagueAttr = detectVagueAttributions(textLower);
  if (vagueAttr) patterns.push(vagueAttr);

  const copulaAvoid = detectCopulaAvoidance(text);
  if (copulaAvoid) patterns.push(copulaAvoid);

  const negPara = detectNegativeParallelism(text);
  if (negPara) patterns.push(negPara);

  const promoIng = detectPromotionalIngChain(text, wordCount);
  if (promoIng) patterns.push(promoIng);

  const vagueChallenge = detectVagueChallenge(text);
  if (vagueChallenge) patterns.push(vagueChallenge);

  const promoAdj = detectPromotionalAdjectives(words);
  if (promoAdj) patterns.push(promoAdj);

  const trigramRep = detectTrigramRepetition(words);
  if (trigramRep) patterns.push(trigramRep);

  const lowCoV = detectLowSentenceCoV(sentences);
  if (lowCoV) patterns.push(lowCoV);

  // Step 3c: V3 pattern detectors
  const casualOpener = detectCasualAIOpener(text);
  if (casualOpener) patterns.push(casualOpener);

  const metaCommentary = detectAIMetaCommentary(text, wordCount);
  if (metaCommentary) patterns.push(metaCommentary);

  const melodrama = detectCreativeAIMelodrama(words);
  if (melodrama) patterns.push(melodrama);

  // Step 4: Detect semantic patterns (15–19)
  const overExp = detectOverExplanation(text);
  if (overExp) patterns.push(overExp);

  const balanced = detectBalancedViewpoint(text, wordCount);
  if (balanced) patterns.push(balanced);

  const qualifiers = detectExcessiveQualifiers(text, wordCount);
  if (qualifiers) patterns.push(qualifiers);

  const abstractLang = detectAbstractLanguage(text, wordCount);
  if (abstractLang) patterns.push(abstractLang);

  const noPersonality = detectNoPersonality(text, wordCount);
  if (noPersonality) patterns.push(noPersonality);

  // Step 5: Compute statistics
  const stats: TextStats = {
    burstiness: computeBurstiness(sentences),
    typeTokenRatio: computeTypeTokenRatio(words),
    avgSentenceLength: computeAvgSentenceLength(sentences),
    fleschReadingEase: computeFleschReadingEase(text),
  };

  // Step 6: Detect statistical patterns (20–24)
  const lowBurstinessHit = detectLowBurstiness(stats.burstiness);
  if (lowBurstinessHit) patterns.push(lowBurstinessHit);

  const lowTTRHit = detectLowTTR(stats.typeTokenRatio);
  if (lowTTRHit) patterns.push(lowTTRHit);

  const medianSentLen = detectMedianSentenceLen(stats.avgSentenceLength);
  if (medianSentLen) patterns.push(medianSentLen);

  const predictableReading = detectPredictableReading(stats.fleschReadingEase);
  if (predictableReading) patterns.push(predictableReading);

  const lowPerplexity = detectLowPerplexity(sentences);
  if (lowPerplexity) patterns.push(lowPerplexity);

  // Step 7: Compute final score
  const patternScore = computePatternScore(patterns);
  const statisticalScore = computeStatisticalScore(stats);
  const structuralScore = computeStructuralScore(structuralHits);

  // Multi-pattern amplifier: boost pattern score when many patterns fire
  const patternCount = patterns.length;
  const amplifier = patternCount >= 12 ? 1.6 : patternCount >= 8 ? 1.45 : patternCount >= 5 ? 1.25 : 1.0;
  const boostedPatternScore = Math.min(100, patternScore * amplifier);

  const score = clamp(
    0,
    100,
    boostedPatternScore * SCORE_WEIGHTS.pattern +
      statisticalScore * SCORE_WEIGHTS.statistical +
      structuralScore * SCORE_WEIGHTS.structural
  );

  return {
    score: Math.round(score * 10) / 10,
    confidenceBand: getConfidenceBand(Math.round(score * 10) / 10),
    patterns,
    stats,
    wordCount,
  };
}
