// ===========================================================
// HumanizeIt — Text Humanization Engine
// ===========================================================

import { openai } from "@/lib/openai";
import type { AnalysisResult } from "./analyzeText";
import { AI_VOCABULARY_TIER_1, SYCOPHANTIC_PHRASES } from "./patterns";

export type ToneOption = "standard" | "formal" | "casual" | "academic";

const TONE_INSTRUCTIONS: Record<ToneOption, string> = {
  standard:
    "Use a natural, conversational tone. Add contractions where they fit naturally (it's, don't, we're, etc.). Write like a thoughtful person explaining something to a peer.",
  formal:
    "Use a professional, formal tone appropriate for business communication. Avoid slang but do not sound robotic. Use measured language without excessive hedging.",
  casual:
    "Use a relaxed, friendly, everyday tone. Contractions are expected. Short sentences are fine. Write like you're texting a smart friend — clear but not formal.",
  academic:
    "Use a precise, scholarly tone appropriate for academic writing. Avoid colloquialisms. Be specific and cite reasoning clearly. Do not use hedging phrases like 'it could be argued' — state things directly.",
};

/**
 * Build a targeted humanization prompt based on the patterns found.
 */
function buildPrompt(
  text: string,
  tone: ToneOption,
  analysisResult: AnalysisResult
): string {
  const detectedPatternDescriptions = analysisResult.patterns
    .slice(0, 10) // top 10 most important
    .map(
      (p) =>
        `- ${p.label} (${p.severity}): examples found: ${p.examples.join(", ")}`
    )
    .join("\n");

  const bannedWords = [...AI_VOCABULARY_TIER_1].join(", ");
  const bannedPhrases = [...SYCOPHANTIC_PHRASES].slice(0, 5).join(", ");

  const wordCount = analysisResult.wordCount;
  const targetRange = `${Math.round(wordCount * 0.9)}–${Math.round(wordCount * 1.1)}`;

  return `You are a human writing coach. Your job is to rewrite the following text so it sounds genuinely human — not AI-generated.

## Detected AI patterns to fix:
${detectedPatternDescriptions}

## Tone requirement:
${TONE_INSTRUCTIONS[tone]}

## Hard rules:
1. Preserve the original meaning completely — do not add or remove key ideas
2. Target word count: ${targetRange} words (original: ${wordCount} words)
3. NEVER use these AI-flagged words: ${bannedWords}
4. NEVER use these sycophantic phrases: ${bannedPhrases}
5. Vary sentence lengths intentionally — mix short punchy sentences with longer ones
6. Replace abstract language with specific, concrete alternatives
7. Do not start with "In conclusion", "In summary", "Moving forward", or similar
8. Do not open with "In today's", "When it comes to", or "In the realm of"
9. Remove all generic conclusion phrases (in conclusion, to sum up, as we have seen)
10. Break up any runs of 3+ sentences starting with the same word

## Original text:
${text}

## Rewritten text (output ONLY the rewritten text, no commentary, no preamble):`;
}

/**
 * Rewrite text to sound more human using GPT-4o-mini.
 */
export async function humanizeText(
  text: string,
  tone: ToneOption,
  analysisResult: AnalysisResult
): Promise<{ humanizedText: string; tokensUsed: number }> {
  const prompt = buildPrompt(text, tone, analysisResult);

  // Max tokens = 2× input word count, minimum 256
  const maxTokens = Math.max(256, analysisResult.wordCount * 2);

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.7,
    max_tokens: maxTokens,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const humanizedText =
    response.choices[0]?.message?.content?.trim() ?? text;
  const tokensUsed = response.usage?.total_tokens ?? 0;

  return { humanizedText, tokensUsed };
}
