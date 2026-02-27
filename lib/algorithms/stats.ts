// ===========================================================
// HumanizeIt — Statistical Text Metrics
// ===========================================================

/**
 * Compute burstiness: variance in sentence length.
 *
 * burstiness = stddev(sentenceLengths) / mean(sentenceLengths)
 *
 * - Human text: > 0.40 (mix of short and long sentences)
 * - AI text:    < 0.20 (uniform sentence lengths)
 *
 * @param sentences Array of sentence strings
 * @returns Burstiness ratio (0 = perfectly uniform)
 */
export function computeBurstiness(sentences: string[]): number {
  if (sentences.length < 2) return 0;

  const lengths = sentences.map((s) => s.split(/\s+/).filter(Boolean).length);
  const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;

  if (mean === 0) return 0;

  const variance =
    lengths.reduce((sum, len) => sum + (len - mean) ** 2, 0) / lengths.length;
  const stddev = Math.sqrt(variance);

  return Math.round((stddev / mean) * 100) / 100;
}

/**
 * Compute Type-Token Ratio (TTR): lexical diversity measure.
 *
 * TTR = uniqueWords / totalWords
 *
 * Uses a sliding window of 100 words to normalize for text length,
 * then averages across all windows.
 *
 * - Human text: > 0.55
 * - AI text:    < 0.40
 *
 * @param words Array of lowercase word tokens
 * @returns TTR between 0 and 1
 */
export function computeTypeTokenRatio(words: string[]): number {
  if (words.length === 0) return 0;

  const windowSize = 100;

  // For short texts, compute TTR directly
  if (words.length <= windowSize) {
    const unique = new Set(words).size;
    return Math.round((unique / words.length) * 100) / 100;
  }

  // Sliding window TTR for longer texts
  let totalTTR = 0;
  let windowCount = 0;

  for (let i = 0; i <= words.length - windowSize; i += 50) {
    const window = words.slice(i, i + windowSize);
    const unique = new Set(window).size;
    totalTTR += unique / windowSize;
    windowCount++;
  }

  return Math.round((totalTTR / windowCount) * 100) / 100;
}

/**
 * Compute average sentence length in words.
 *
 * AI text typically averages 18–25 words per sentence.
 * Human text has more variance (some very short, some long).
 *
 * @param sentences Array of sentence strings
 * @returns Average words per sentence
 */
export function computeAvgSentenceLength(sentences: string[]): number {
  if (sentences.length === 0) return 0;

  const totalWords = sentences.reduce(
    (sum, s) => sum + s.split(/\s+/).filter(Boolean).length,
    0
  );

  return Math.round((totalWords / sentences.length) * 10) / 10;
}

/**
 * Compute Flesch Reading Ease score.
 *
 * FRE = 206.835 - (1.015 × ASL) - (84.6 × ASW)
 *
 * Where:
 * - ASL = average sentence length (words per sentence)
 * - ASW = average syllable count per word
 *
 * AI text tends to cluster in 40–60 ("college" level).
 * Human text shows more variance.
 *
 * @param text Raw text string
 * @returns Flesch Reading Ease score (0–100+)
 */
export function computeFleschReadingEase(text: string): number {
  const sentences = text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const words = text
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 0);

  if (sentences.length === 0 || words.length === 0) return 0;

  const asl = words.length / sentences.length;
  const totalSyllables = words.reduce((sum, w) => sum + countSyllables(w), 0);
  const asw = totalSyllables / words.length;

  const score = 206.835 - 1.015 * asl - 84.6 * asw;

  return Math.round(score * 10) / 10;
}

/**
 * Estimate syllable count for an English word.
 * Uses a simple heuristic: count vowel groups, adjust for silent -e.
 */
function countSyllables(word: string): number {
  const cleaned = word.replace(/[^a-z]/g, "");
  if (cleaned.length <= 2) return 1;

  const vowelGroups = cleaned.match(/[aeiouy]+/g);
  if (!vowelGroups) return 1;

  let count = vowelGroups.length;

  // Silent -e at end
  if (cleaned.endsWith("e") && count > 1) {
    count--;
  }

  // Common suffixes that add syllables
  if (cleaned.endsWith("le") && cleaned.length > 2 && !/[aeiouy]/.test(cleaned[cleaned.length - 3])) {
    count++;
  }

  return Math.max(1, count);
}
