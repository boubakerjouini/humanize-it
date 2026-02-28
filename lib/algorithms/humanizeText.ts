// ===========================================================
// HumanizeIt — Text Humanization Engine V3
// Multi-pass feedback loop + post-processing to beat detectors
// ===========================================================

import { anthropic } from "@/lib/anthropic";
import type { AnalysisResult } from "./analyzeText";
import { analyzeText } from "./analyzeText";
import { AI_VOCABULARY_TIER_1, SYCOPHANTIC_PHRASES } from "./patterns";

export type ToneOption = "standard" | "formal" | "casual" | "academic";

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
};

// ---- Tone instructions (toned down — humanization takes priority) ----

const TONE_INSTRUCTIONS: Record<ToneOption, string> = {
  standard: "",
  formal:
    "Tone: professional. Skip the personal reaction injection, but keep all other humanization rules.",
  casual:
    "Tone: relaxed and friendly. Contractions expected. Short sentences welcome.",
  academic:
    "Tone: scholarly and precise. Skip contractions, but keep short sentences, specificity, and varied rhythm.",
};

// ---- Layer 1: Radical system prompt ----

function buildSystemPrompt(): string {
  return `You are a human rewriter. Your job: make AI-generated text completely undetectable by AI detectors.

AI detectors catch these fingerprints — DESTROY ALL OF THEM:
1. Uniform sentence rhythm — AI writes sentences of similar length. Humans don't.
2. Smooth transitions — "Furthermore", "Moreover", "Additionally" = instant AI flag.
3. Predictable vocabulary — Low-surprise word choices.
4. Perfect grammar — No contractions, no fragments, no informal touches.
5. Balanced hedging — "While X, Y" structures repeated.
6. Generic specificity — No real numbers, no real names, no personal stakes.

YOUR MANDATORY OUTPUT RULES:
A) SENTENCE RHYTHM: You MUST include:
   - At least 3 sentences of 1–6 words (punchy fragments)
   - At least 1 sentence of 40+ words
   - No 3 consecutive sentences within 4 words of each other in length

B) VOCABULARY: Never use these words (they are AI fingerprints):
   furthermore, moreover, additionally, comprehensive, multifaceted, pivotal, nuanced,
   intricate, underscores, underpins, embark, unravel, endeavor, testament, cornerstone,
   paramount, fostering, navigating, groundbreaking, spearhead, reimagine, transformative,
   visionary, pioneering, seamlessly, holistically, robust, leverage, utilize, facilitate,
   paradigm, innovative, dynamic, holistic, proactive, meticulous, vibrant, bustling,
   nestled, realm, showcase, catalyst, invaluable, quintessential, illuminate, encompasses,
   ubiquitous, actionable, impactful, deliverables, stakeholders, ecosystem, showcasing,
   highlighting, demonstrating, reflecting, underscoring, serves as, stands as, boasts,
   it is worth noting, it is important to, in today's rapidly, in the realm of,
   in conclusion, to sum up, moving forward, at the end of the day

C) CONTRACTIONS: Use them. "don't" not "do not". "it's" not "it is". "we're" not "we are".

D) PERSONALITY: Add ONE of these human touches:
   - A personal reaction ("Honestly, that surprised me." / "I wasn't expecting that.")
   - A rhetorical aside in parentheses ("(which, honestly, most people ignore)")
   - A one-sentence paragraph that is just your opinion

E) SPECIFICITY: Replace any vague claim with a CONCRETE one:
   - "many companies" → "companies like Stripe, Notion, or Airbnb"
   - "experts say" → "a 2023 Stanford study found" OR rephrase as your own view
   - "significant growth" → "47% growth" (make up a plausible number if none given)

F) FORBIDDEN STRUCTURES:
   - "Not only X, but also Y"
   - "While X, Y" (overused — rephrase)
   - "In conclusion / To summarize / Moving forward"
   - Starting 3+ consecutive sentences with "The", "It", "This", or "In"

OUTPUT: The rewritten text ONLY. No intro. No explanation. No "Here is the rewritten version:".`;
}

// ---- Build user prompt for first pass ----

function buildUserPrompt(
  text: string,
  tone: ToneOption,
  analysisResult: AnalysisResult
): string {
  const detectedPatternDescriptions = analysisResult.patterns
    .slice(0, 12)
    .map(p => `- ${p.label} (${p.severity}): ${p.examples.join(", ")}`)
    .join("\n");

  const wordCount = analysisResult.wordCount;
  const targetRange = `${Math.round(wordCount * 0.9)}–${Math.round(wordCount * 1.1)}`;

  const toneNote = TONE_INSTRUCTIONS[tone];

  return `Rewrite this text to be completely undetectable as AI-generated.

## Detected AI patterns in this text:
${detectedPatternDescriptions}

${toneNote ? `## ${toneNote}\n` : ""}
## Constraints:
- Target word count: ${targetRange} words
- Preserve the original meaning — do not invent facts not implied by the original

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

  return `CRITICAL: The previous rewrite still scored ${score}% on an AI detector.
The main issues were: ${topPatterns}
You must be MORE aggressive. Shorter sentences. More contractions. More concrete specifics.
Force at least 5 sentences under 8 words. Add a parenthetical aside. Use an em dash once.

${toneNote ? `## ${toneNote}\n` : ""}
Rewrite this text again — make it HUMAN:

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

  // Clean up double spaces from empty replacements
  result = result.replace(/\s{2,}/g, " ").replace(/\s+([.,;:!?])/g, "$1");

  return result;
}

// ---- Layer 3b: Sentence starter diversity ----

function fixSentenceStarterDiversity(text: string): string {
  const sentenceRegex = /[^.!?]*[.!?]+/g;
  const sentences = text.match(sentenceRegex);
  if (!sentences || sentences.length < 4) return text;

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

    // Find the longest sentence starting with this word and rephrase it
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
      // Apply simple starter rephrasing
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

    break; // Fix one starter per pass
  }

  return sentences.join(" ").replace(/\s{2,}/g, " ");
}

// ---- Layer 3c: Burstiness injection ----

function injectBurstiness(text: string): string {
  const sentenceRegex = /[^.!?]*[.!?]+/g;
  const sentences = text.match(sentenceRegex);
  if (!sentences || sentences.length < 4) return text;

  const lengths = sentences.map(s => s.trim().split(/\s+/).length);

  // Find longest run of similar-length sentences (within 3 words)
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

  if (bestRunLen < 3) return text;

  // Split the middle sentence of the run at a natural comma or conjunction
  const midIdx = bestRunStart + Math.floor(bestRunLen / 2);
  const midSentence = sentences[midIdx].trim();

  // Try splitting at comma
  const commaIdx = midSentence.indexOf(",", Math.floor(midSentence.length * 0.3));
  if (commaIdx > 0 && commaIdx < midSentence.length - 10) {
    const part1 = midSentence.slice(0, commaIdx).trim();
    const part2 = midSentence.slice(commaIdx + 1).trim();
    // Capitalize part2 and make part1 end with a period
    const newPart2 = part2.charAt(0).toUpperCase() + part2.slice(1);
    const newPart1 = part1.endsWith(".") || part1.endsWith("!") || part1.endsWith("?")
      ? part1
      : part1 + ".";
    sentences[midIdx] = ` ${newPart1} ${newPart2}`;
    return sentences.join("").replace(/\s{2,}/g, " ").trim();
  }

  // Try splitting at conjunction
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
      return sentences.join("").replace(/\s{2,}/g, " ").trim();
    }
  }

  return text;
}

// ---- Layer 3: Full post-processing pipeline ----

function postProcess(text: string): string {
  let result = applyForbiddenSynonyms(text);
  result = fixSentenceStarterDiversity(result);
  result = injectBurstiness(result);
  return result.trim();
}

// ---- Single Claude pass ----

async function runClaudePass(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number
): Promise<{ text: string; tokens: number }> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: maxTokens,
    temperature: 0.9,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text.trim() : "";
  const tokens = response.usage.input_tokens + response.usage.output_tokens;

  return { text, tokens };
}

// ---- Main entry point ----

/**
 * Rewrite text to sound more human using multi-pass Claude + post-processing.
 */
export async function humanizeText(
  text: string,
  tone: ToneOption,
  analysisResult: AnalysisResult
): Promise<{ humanizedText: string; tokensUsed: number }> {
  const maxTokens = Math.max(512, analysisResult.wordCount * 3);
  const systemPrompt = buildSystemPrompt();
  let totalTokens = 0;

  // --- Pass 1 ---
  const userPrompt = buildUserPrompt(text, tone, analysisResult);
  const pass1 = await runClaudePass(systemPrompt, userPrompt, maxTokens);
  totalTokens += pass1.tokens;

  let bestText = pass1.text;
  let bestScore = Infinity;

  // Analyze pass 1
  const analysis1 = analyzeText(pass1.text);
  bestScore = analysis1.score;
  bestText = pass1.text;

  // --- Pass 2 (if score > 35) ---
  if (analysis1.score > 35) {
    const topPatterns = analysis1.patterns
      .slice(0, 5)
      .map(p => p.label)
      .join(", ");

    const retryPrompt = buildRetryPrompt(pass1.text, tone, Math.round(analysis1.score), topPatterns);
    const pass2 = await runClaudePass(systemPrompt, retryPrompt, maxTokens);
    totalTokens += pass2.tokens;

    const analysis2 = analyzeText(pass2.text);
    if (analysis2.score < bestScore) {
      bestScore = analysis2.score;
      bestText = pass2.text;
    }

    // --- Pass 3 (if still > 35) ---
    if (analysis2.score > 35) {
      const topPatterns3 = analysis2.patterns
        .slice(0, 5)
        .map(p => p.label)
        .join(", ");

      const retryPrompt3 = buildRetryPrompt(pass2.text, tone, Math.round(analysis2.score), topPatterns3);
      const pass3 = await runClaudePass(systemPrompt, retryPrompt3, maxTokens);
      totalTokens += pass3.tokens;

      const analysis3 = analyzeText(pass3.text);
      if (analysis3.score < bestScore) {
        bestScore = analysis3.score;
        bestText = pass3.text;
      }
    }
  }

  // --- Layer 3: Post-processing ---
  const humanizedText = postProcess(bestText);

  return { humanizedText, tokensUsed: totalTokens };
}
