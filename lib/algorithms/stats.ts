// ===========================================================
// HumanizeIt — Statistical Text Metrics
// ===========================================================

// Abbreviations whose period does not end a sentence. Splitting on every "."
// turned "e.g." or "Dr." into extra two-word sentences, which faked the
// uneven rhythm burstiness reads as human.
const ABBREVIATION_RE = /\b(?:e\.g|i\.e|etc|vs|mr|mrs|ms|dr|prof|st|jr|sr|no|fig|approx|u\.s|u\.k|a\.m|p\.m)\./gi;
const LIST_MARKER = String.raw`(?:[-*+•]|\d{1,3}[.)]|#{1,6})`;
// A blank line, or a newline that starts a list item or heading, always ends
// a sentence: list items and headings rarely carry their own period.
const BLOCK_BREAK_RE = new RegExp(String.raw`\n\s*\n|\n(?=[ \t]*${LIST_MARKER}\s)`);
const LEADING_MARKER_RE = new RegExp(String.raw`^\s*${LIST_MARKER}\s+`);
const PLACEHOLDER = "․"; // one-dot leader: same length, never a terminator

/**
 * Split text into sentences. Ends a sentence at . ! ? … followed by
 * whitespace (closing quotes/brackets stay with it), at blank lines, and at
 * list items / markdown headings. Hard-wrapped lines inside a paragraph are
 * joined. Decimals ("3.5"), initials ("J. R.") and common abbreviations do
 * not split, and neither do dots inside URLs or file names.
 */
export function splitSentences(text: string): string[] {
  const out: string[] = [];
  for (const rawBlock of text.replace(/\r/g, "").split(BLOCK_BREAK_RE)) {
    const block = rawBlock.replace(LEADING_MARKER_RE, "").replace(/\s*\n\s*/g, " ");
    const masked = block
      .replace(ABBREVIATION_RE, (m) => m.replace(/\./g, PLACEHOLDER))
      .replace(/(\d)\.(?=\d)/g, `$1${PLACEHOLDER}`)
      .replace(/\b([A-Z])\.(?=\s?[A-Z])/g, `$1${PLACEHOLDER}`); // initials: "J. R. Tolkien"
    for (const piece of masked.split(/[.!?…]+["'”’)\]]*(?=\s|$)/)) {
      const sentence = piece.replaceAll(PLACEHOLDER, ".").trim();
      if (/[\p{L}\p{N}]/u.test(sentence)) out.push(sentence);
    }
  }
  return out;
}

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
  const sentences = splitSentences(text);
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
