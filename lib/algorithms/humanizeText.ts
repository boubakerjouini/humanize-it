// ===========================================================
// HumanizeIt — Text Humanization Engine V3
// Multi-pass feedback loop + post-processing to beat detectors
// ===========================================================

import { complete } from "@/lib/llm";
import type { AnalysisResult } from "./analyzeText";
import { analyzeText } from "./analyzeText";
import { AI_VOCABULARY_TIER_1, SYCOPHANTIC_PHRASES } from "./patterns";

export type ToneOption = "standard" | "formal" | "casual" | "academic" | "storytelling" | "professional";
export type IntensityLevel = "light" | "medium" | "heavy";

// ---- Layer 3a: Forbidden word synonym map ----

const FORBIDDEN_SYNONYMS: Record<string, string> = {
  "utilize": "use",
  "utilizes": "uses",
  "utilized": "used",
  "utilizing": "using",
  "commence": "start",
  "commences": "starts",
  "commenced": "started",
  "commencing": "starting",
  "optimal": "best",
  "facilitate": "help",
  "facilitates": "helps",
  "facilitated": "helped",
  "implement": "use",
  "leverage": "use",
  "leveraging": "using",
  "leveraged": "used",
  "prior to": "before",
  "subsequent to": "after",
  "in order to": "to",
  "due to the fact that": "because",
  "in the event that": "if",
  "at this point in time": "now",
  "on a daily basis": "daily",
  "a large number of": "many",
  "the majority of": "most",
  "it is important to note": "",
  "it should be noted that": "",
  "it is worth mentioning": "",
  "needless to say": "",
  "of course": "",
  "as previously mentioned": "",
  "as mentioned earlier": "",
  "delve into": "look at",
  "delves into": "looks at",
  "delved into": "looked at",
  "delving into": "looking at",
  "it is worth noting that": "",
  "it's worth noting that": "",
  "it is important to note that": "",
  "plays a crucial role": "matters a lot",
  "plays a key role": "matters",
  "when it comes to": "for",
  "in terms of": "for",
  "the fact that": "",
};

// ---- Token protection (URLs, technical terms) ----

function protectTokens(text: string): { protected: string; tokens: Map<string, string> } {
  const tokens = new Map<string, string>();
  let i = 0;
  // Protect URLs
  const urlRegex = /https?:\/\/[^\s)>\]"]+/g;
  let protected_text = text.replace(urlRegex, (match) => {
    const key = `__TOKEN_${i++}__`;
    tokens.set(key, match);
    return key;
  });
  // Protect word.ext patterns (technical terms, domains, filenames)
  protected_text = protected_text.replace(/(\w+)\.(\w)/g, (match, _p1: string, p2: string) => {
    if (/^(js|ts|css|html|md|json|svg|png|jpg|env|sh|py|rb|go|rs)$/i.test(p2)) {
      const key = `__TOKEN_${i++}__`;
      tokens.set(key, match);
      return key;
    }
    return match;
  });
  return { protected: protected_text, tokens };
}

function restoreTokens(text: string, tokens: Map<string, string>): string {
  let result = text;
  for (const [key, value] of tokens) {
    // Try with possible spaces Claude might inject
    result = result.replace(new RegExp(key.replace(/_/g, "_\\s*"), "g"), value);
    result = result.replace(key, value);
  }
  return result;
}

// ---- Tone instructions (toned down — humanization takes priority) ----

const TONE_INSTRUCTIONS: Record<ToneOption, string> = {
  standard: "",
  formal:
    "Tone: professional. Skip the personal reaction injection, but keep all other humanization rules.",
  casual:
    "Tone: relaxed and friendly. Contractions expected. Short sentences welcome.",
  academic:
    "Tone: scholarly and precise. Skip contractions, but keep short sentences, specificity, and varied rhythm.",
  storytelling:
    "Tone: narrative and engaging. Use anecdotes, vivid descriptions, and a storytelling arc. Write as if sharing an experience or explaining through a story. Weave in sensory details and personal observations.",
  professional:
    "Tone: polished business writing. Clear, direct, and authoritative. Use active voice, data-driven language, and executive-level clarity. No fluff, no filler. Write like a senior consultant's memo.",
};

// ---- Intensity instructions ----

const INTENSITY_INSTRUCTIONS: Record<IntensityLevel, string> = {
  light:
    "INTENSITY: LIGHT. Make minimal changes. Keep the original voice and structure as much as possible. Only fix the most obvious AI tells (em dashes, banned words, uniform sentence length). Do NOT restructure paragraphs or rewrite sentences that already sound natural.",
  medium: "",
  heavy:
    "INTENSITY: HEAVY. Completely overhaul this text. Restructure every paragraph. Rewrite every sentence from scratch. Change the opening, reorganize the flow, vary paragraph lengths dramatically. The output should share the same meaning but read like a completely different person wrote it. Be bold and creative.",
};

// ---- Layer 1: Radical system prompt ----

function buildSystemPrompt(intensity: IntensityLevel = "medium"): string {
  return `You are a human rewriter. Your ONLY job: make AI-generated text completely undetectable by GPTZero, Turnitin, Originality.ai, and Copyleaks.

THESE ARE THE EXACT SIGNALS DETECTORS USE — ELIMINATE ALL OF THEM:

1. EM DASH (—): The single biggest ChatGPT fingerprint. NEVER use —. Replace with a comma, period, or rewrite the sentence entirely. This is non-negotiable.
2. Uniform sentence length — AI writes 18-22 word sentences repeatedly. Break this pattern.
3. Smooth formal transitions — "Furthermore", "Moreover", "Additionally", "In addition" = instant flag.
4. Hedging pairs — "While X, Y" / "Although X, Y" used repeatedly.
5. Perfect grammar — No contractions = AI. Use "don't", "it's", "you're".
6. Abstract vagueness — "many experts", "significant impact", "various approaches". Replace with specifics.
7. Formulaic structure — Intro paragraph → 3 body paragraphs → conclusion. Break this.
8. Consistent paragraph length — All paragraphs 3-4 sentences. Vary it: some 1 sentence, some 6.

MANDATORY RULES:

A) PUNCTUATION — CRITICAL:
   - ZERO em dashes (—). Replace every single one.
   - Use commas, periods, colons, or parentheses instead.
   - Occasional sentence fragments are fine. Humans write them.

B) SENTENCE RHYTHM:
   - Mix short (3-8 words) and long (30+ words) sentences throughout.
   - Never have 3 consecutive sentences within 5 words of each other in length.
   - Break long sentences into 2 short ones randomly.

C) BANNED WORDS — never appear in output:
   furthermore, moreover, additionally, comprehensive, multifaceted, pivotal, nuanced,
   intricate, underscores, underpins, embark, unravel, endeavor, testament, cornerstone,
   paramount, fostering, navigating, groundbreaking, spearhead, reimagine, transformative,
   visionary, pioneering, seamlessly, holistically, robust, leverage, utilize, facilitate,
   paradigm, innovative, dynamic, holistic, proactive, meticulous, vibrant, bustling,
   nestled, realm, showcase, catalyst, invaluable, quintessential, illuminate, encompasses,
   ubiquitous, actionable, impactful, delve, delves, delving, tapestry, landscape,
   it is worth noting, it is important to, in today's rapidly, in the realm of,
   in conclusion, to sum up, moving forward, at the end of the day, it's worth mentioning,
   when it comes to, in terms of, plays a crucial role, plays a key role

D) CONTRACTIONS: Always use them unless tone is explicitly academic.
   "do not" → "don't" | "it is" → "it's" | "we are" → "we're" | "they are" → "they're"

E) HUMAN PERSONALITY — pick ONE per rewrite:
   - A blunt parenthetical aside: "(and honestly, most people skip this part)"
   - A short opinion sentence standing alone as its own paragraph.
   - A question mid-text: "Why does this matter? Because..."

F) SPECIFICITY — replace every vague claim:
   - "many companies" → "companies like Figma, Linear, or Notion"
   - "experts say" → "a 2024 MIT study showed" or just state it as your view
   - "significant results" → "37% improvement" (plausible number if none given)

G) BANNED STRUCTURES:
   - "Not only X, but also Y"
   - "While X, Y" or "Although X, Y" used more than once
   - Oxford comma in every list (mix it up: sometimes skip it)
   - All paragraphs the same length

H) FORMATTING PRESERVATION — CRITICAL:
   - Preserve ALL line breaks and paragraph structure from the original text EXACTLY.
   - If the original has blank lines between sections, keep blank lines in the same places.
   - If the original has bullet points or numbered lists, keep the same list structure.
   - If the original has emoji at the start of lines (👋, 💼, 🔥, etc.), keep them in place.
   - Do NOT merge separate paragraphs into one block.
   - Do NOT remove blank lines between sections.
   - URLs must be copied VERBATIM — never modify, shorten, or add spaces inside URLs.
   - Technical terms (Next.js, Node.js, TypeScript, SignalR, etc.) must be copied EXACTLY as written. Never add spaces inside them.

OUTPUT RULE: Return ONLY the rewritten text. No intro like "Here is..." or "Sure, here's...". Just the text.

${INTENSITY_INSTRUCTIONS[intensity] || ""}`;
}

// ---- Build user prompt for first pass ----

function buildUserPrompt(
  text: string,
  tone: ToneOption,
  analysisResult: AnalysisResult,
  styleFingerprint?: Record<string, string>,
  language?: string
): string {
  const detectedPatternDescriptions = analysisResult.patterns
    .slice(0, 12)
    .map(p => `- ${p.label} (${p.severity}): ${p.examples.join(", ")}`)
    .join("\n");

  const wordCount = analysisResult.wordCount;
  const targetRange = `${Math.round(wordCount * 0.9)}–${Math.round(wordCount * 1.1)}`;

  const toneNote = TONE_INSTRUCTIONS[tone];

  const styleSection = styleFingerprint
    ? `\n## Match this writing style:\n${JSON.stringify(styleFingerprint, null, 2)}\n`
    : "";

  const languageSection = language && language !== "English"
    ? `\n## Language: Write the output in ${language}. Preserve the meaning while writing naturally in ${language}.\n`
    : "";

  return `Rewrite this text to be completely undetectable as AI-generated.

## Detected AI patterns in this text:
${detectedPatternDescriptions}

${toneNote ? `## ${toneNote}\n` : ""}${styleSection}${languageSection}
## Constraints:
- Target word count: ${targetRange} words
- Preserve the original meaning — do not invent facts not implied by the original
- CRITICAL: Preserve all line breaks, blank lines, bullet points, and emoji positions exactly as in the original. URLs must be copied word-for-word without modification.

## Original text:
${text}`;
}

// ---- Build retry prompt for pass 2+ ----

function buildRetryPrompt(
  text: string,
  tone: ToneOption,
  score: number,
  topPatterns: string
): string {
  const toneNote = TONE_INSTRUCTIONS[tone];

  return `FAILED: The previous rewrite still scored ${score}% on AI detectors. That's too high.
Issues remaining: ${topPatterns}

BE MORE AGGRESSIVE THIS TIME:
- Check every sentence for em dashes (—) and REMOVE them all. Replace with comma or period.
- Find every sentence over 20 words. Split it into two.
- Find 3 short sentences (under 8 words) and make them even shorter.
- Replace any remaining abstract words with specific, concrete language.
- Add a blunt parenthetical comment somewhere: "(which, honestly, nobody talks about enough)"
- Make sure contractions are used throughout.

${toneNote ? `Tone note: ${toneNote}\n` : ""}
Rewrite this text — it needs to read like a real person wrote it fast:

${text}`;
}

// ---- Layer 3a: AI word substitution ----

function applyForbiddenSynonyms(text: string): string {
  let result = text;

  // Apply multi-word phrases first (longer matches first to avoid partial replacements)
  const phrases = Object.entries(FORBIDDEN_SYNONYMS)
    .filter(([key]) => key.includes(" "))
    .sort(([a], [b]) => b.length - a.length);

  for (const [phrase, replacement] of phrases) {
    const regex = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    result = result.replace(regex, replacement);
  }

  // Apply single-word replacements
  const singleWords = Object.entries(FORBIDDEN_SYNONYMS)
    .filter(([key]) => !key.includes(" "));

  for (const [word, replacement] of singleWords) {
    const regex = new RegExp(`\\b${word}\\b`, "gi");
    result = result.replace(regex, replacement);
  }

  // Clean up double spaces from empty replacements (preserve newlines)
  result = result.replace(/[^\S\n]{2,}/g, " ").replace(/[^\S\n]+([.,;:!?])/g, "$1");

  return result;
}

// ---- Layer 3b: Sentence starter diversity ----

function fixSentenceStarterDiversity(text: string): string {
  // Process line-by-line to preserve newline structure
  const lines = text.split("\n");
  const processedLines = lines.map(line => {
    const sentenceRegex = /[^.!?]*[.!?]+/g;
    const sentences = line.match(sentenceRegex);
    if (!sentences || sentences.length < 4) return line;

    // Count first words
    const firstWords: Record<string, number> = {};
    for (const s of sentences) {
      const trimmed = s.trim();
      if (!trimmed) continue;
      const firstWord = trimmed.split(/\s+/)[0]?.replace(/[^a-zA-Z]/g, "").toLowerCase() ?? "";
      if (firstWord) {
        firstWords[firstWord] = (firstWords[firstWord] ?? 0) + 1;
      }
    }

    const commonStarters = ["the", "it", "this", "in", "for", "a"];
    const totalSentences = sentences.length;

    for (const starter of commonStarters) {
      const count = firstWords[starter] ?? 0;
      if (count / totalSentences <= 0.5) continue;

      let longestIdx = -1;
      let longestLen = 0;
      for (let i = 0; i < sentences.length; i++) {
        const trimmed = sentences[i].trim();
        const fw = trimmed.split(/\s+/)[0]?.replace(/[^a-zA-Z]/g, "").toLowerCase() ?? "";
        if (fw === starter && trimmed.length > longestLen) {
          longestLen = trimmed.length;
          longestIdx = i;
        }
      }

      if (longestIdx >= 0) {
        const original = sentences[longestIdx].trim();
        if (/^The\s+\w+\s+is\s+/i.test(original)) {
          const match = original.match(/^The\s+(\w+)\s+is\s+(.*)/i);
          if (match) {
            sentences[longestIdx] = sentences[longestIdx].replace(original, `${match[1]}? It's ${match[2]}`);
          }
        } else if (/^It is important/i.test(original)) {
          sentences[longestIdx] = sentences[longestIdx].replace(/^It is important/i, "Worth knowing:");
        } else if (/^This means/i.test(original)) {
          sentences[longestIdx] = sentences[longestIdx].replace(/^This means/i, "Meaning:");
        } else if (/^In order to/i.test(original)) {
          sentences[longestIdx] = sentences[longestIdx].replace(/^In order to/i, "To");
        }
      }

      break;
    }

    return sentences.join("").replace(/[^\S\n]{2,}/g, " ");
  });
  return processedLines.join("\n");
}

// ---- Layer 3c: Burstiness injection ----

function injectBurstiness(text: string): string {
  // Process line-by-line to preserve newline structure
  const lines = text.split("\n");
  const processedLines = lines.map(line => {
    const sentenceRegex = /[^.!?]*[.!?]+/g;
    const sentences = line.match(sentenceRegex);
    if (!sentences || sentences.length < 4) return line;

    const lengths = sentences.map(s => s.trim().split(/\s+/).length);

    let bestRunStart = -1;
    let bestRunLen = 0;

    for (let i = 0; i < lengths.length; i++) {
      let runLen = 1;
      for (let j = i + 1; j < lengths.length; j++) {
        const allSimilar = lengths.slice(i, j + 1).every((l, _, arr) =>
          Math.abs(l - arr[0]) <= 3
        );
        if (allSimilar) runLen = j - i + 1;
        else break;
      }
      if (runLen > bestRunLen) {
        bestRunLen = runLen;
        bestRunStart = i;
      }
    }

    if (bestRunLen < 3) return line;

    const midIdx = bestRunStart + Math.floor(bestRunLen / 2);
    const midSentence = sentences[midIdx].trim();

    const commaIdx = midSentence.indexOf(",", Math.floor(midSentence.length * 0.3));
    if (commaIdx > 0 && commaIdx < midSentence.length - 10) {
      const part1 = midSentence.slice(0, commaIdx).trim();
      const part2 = midSentence.slice(commaIdx + 1).trim();
      const newPart2 = part2.charAt(0).toUpperCase() + part2.slice(1);
      const newPart1 = part1.endsWith(".") || part1.endsWith("!") || part1.endsWith("?")
        ? part1
        : part1 + ".";
      sentences[midIdx] = ` ${newPart1} ${newPart2}`;
      return sentences.join("").replace(/[^\S\n]{2,}/g, " ").trim();
    }

    const conjunctions = [" and ", " but ", " so ", " yet "];
    for (const conj of conjunctions) {
      const conjIdx = midSentence.indexOf(conj, Math.floor(midSentence.length * 0.3));
      if (conjIdx > 0) {
        const part1 = midSentence.slice(0, conjIdx).trim();
        const part2 = midSentence.slice(conjIdx + conj.length).trim();
        const newPart2 = part2.charAt(0).toUpperCase() + part2.slice(1);
        const newPart1 = part1.endsWith(".") || part1.endsWith("!") || part1.endsWith("?")
          ? part1
          : part1 + ".";
        sentences[midIdx] = ` ${newPart1} ${newPart2}`;
        return sentences.join("").replace(/[^\S\n]{2,}/g, " ").trim();
      }
    }

    return line;
  });
  return processedLines.join("\n");
}

// ---- Layer 3d: Strip AI punctuation signatures ----

function stripAIPunctuation(text: string): string {
  let result = text;

  // Replace em dash (—) with comma + space or just a comma
  // Pattern: word — word → word, word
  result = result.replace(/\s*—\s*/g, ", ");

  // Remove trailing comma artifacts like ", ," or ",,"
  result = result.replace(/,\s*,/g, ",");
  result = result.replace(/,\s*\./g, ".");

  // Replace en dash (–) used as em dash substitute
  result = result.replace(/\s*–\s*/g, ", ");

  // Strip "delve" variants that somehow sneak through
  result = result.replace(/\bdelves?\b/gi, "looks");
  result = result.replace(/\bdelving\b/gi, "looking");

  // Strip "tapestry" and "landscape" (overused AI metaphors)
  result = result.replace(/\btapestry\b/gi, "mix");
  result = result.replace(/\blandscape\b/gi, "space");

  // Strip "it is worth noting that" and variants
  result = result.replace(/it('?s| is) worth (noting|mentioning) that\s*/gi, "");
  result = result.replace(/it('?s| is) important to note that\s*/gi, "");

  // Clean up double spaces (preserve newlines)
  result = result.replace(/[^\S\n]{2,}/g, " ");
  result = result.replace(/[^\S\n]+([.,;:!?])/g, "$1");

  return result;
}

// ---- Layer 3: Full post-processing pipeline ----

function postProcess(text: string): string {
  let result = stripAIPunctuation(text);       // First: remove — and AI punctuation
  result = applyForbiddenSynonyms(result);     // Word substitutions
  result = fixSentenceStarterDiversity(result); // Vary sentence starters
  result = injectBurstiness(result);            // Break uniform lengths
  result = stripAIPunctuation(result);          // Second pass to catch any new issues
  return result.trim();
}

// ---- Single model pass (provider-flexible: Anthropic or OpenAI) ----

async function runModelPass(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number
): Promise<{ text: string; tokens: number; model: string }> {
  const result = await complete({
    system: systemPrompt,
    prompt: userPrompt,
    maxTokens,
    temperature: 1.0,
  });
  return { text: result.text, tokens: result.tokensUsed, model: result.model };
}

// ---- Main entry point ----

/**
 * Rewrite text to sound more human using multi-pass Claude + post-processing.
 */
export async function humanizeText(
  text: string,
  tone: ToneOption,
  analysisResult: AnalysisResult,
  intensity: IntensityLevel = "medium",
  styleFingerprint?: Record<string, string>,
  language?: string,
  aggressiveHint?: string
): Promise<{ humanizedText: string; tokensUsed: number; model: string }> {
  const maxTokens = Math.max(512, analysisResult.wordCount * 3);
  let systemPrompt = buildSystemPrompt(intensity);
  if (aggressiveHint) {
    systemPrompt += `\n\n${aggressiveHint}`;
  }
  let totalTokens = 0;
  let modelUsed = "";

  // Protect URLs and technical terms before processing
  const { protected: protectedText, tokens: protectedTokenMap } = protectTokens(text);

  // --- Pass 1 ---
  const userPrompt = buildUserPrompt(protectedText, tone, analysisResult, styleFingerprint, language);
  const pass1 = await runModelPass(systemPrompt, userPrompt, maxTokens);
  totalTokens += pass1.tokens;
  modelUsed = pass1.model;

  let bestText = pass1.text;
  let bestScore = Infinity;

  // Analyze pass 1
  const analysis1 = analyzeText(pass1.text);
  bestScore = analysis1.score;
  bestText = pass1.text;

  // --- Pass 2 (if score > 25) ---
  if (analysis1.score > 25) {
    const topPatterns = analysis1.patterns
      .slice(0, 5)
      .map(p => p.label)
      .join(", ");

    const retryPrompt = buildRetryPrompt(pass1.text, tone, Math.round(analysis1.score), topPatterns);
    const pass2 = await runModelPass(systemPrompt, retryPrompt, maxTokens);
    totalTokens += pass2.tokens;

    const analysis2 = analyzeText(pass2.text);
    if (analysis2.score < bestScore) {
      bestScore = analysis2.score;
      bestText = pass2.text;
    }

    // --- Pass 3 (if still > 25) ---
    if (analysis2.score > 25) {
      const topPatterns3 = analysis2.patterns
        .slice(0, 5)
        .map(p => p.label)
        .join(", ");

      const retryPrompt3 = buildRetryPrompt(pass2.text, tone, Math.round(analysis2.score), topPatterns3);
      const pass3 = await runModelPass(systemPrompt, retryPrompt3, maxTokens);
      totalTokens += pass3.tokens;

      const analysis3 = analyzeText(pass3.text);
      if (analysis3.score < bestScore) {
        bestScore = analysis3.score;
        bestText = pass3.text;
      }
    }
  }

  // --- Layer 3: Post-processing ---
  let humanizedText = postProcess(bestText);

  // Restore protected URLs and technical terms
  humanizedText = restoreTokens(humanizedText, protectedTokenMap);

  return { humanizedText, tokensUsed: totalTokens, model: modelUsed };
}
