// ===========================================================
// HumanizeIt — Text Humanization Engine
// ===========================================================

import { anthropic } from "@/lib/anthropic";
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
function buildSystemPrompt(): string {
  return `You are an expert human writing editor. Your job is to rewrite AI-generated text so it sounds like a real, specific human wrote it — not a language model.

Core principles you must follow:
1. Replace "serves as" → "is", "boasts" → "has", "stands as" → "is" — use direct verbs
2. Replace vague attributions: "experts say" → cite a specific source or rephrase as your own claim
3. Vary sentence length deliberately: include at least 2 sentences under 8 words AND at least 1 sentence over 30 words
4. Add at least one concrete specific: a number, a name, a date, or a direct example
5. Have an opinion — react to the facts, don't just report them
6. Short paragraphs. One idea per paragraph.

Before/after example of the transformation you must achieve:

BEFORE (AI-sounding):
"Great question! Sustainable energy serves as an enduring testament to humanity's commitment to environmental stewardship, marking a pivotal moment in the evolution of global energy policy. In today's rapidly evolving landscape, these groundbreaking technologies are reshaping how nations approach energy production. The future looks bright."

AFTER (human-sounding):
"Solar panel costs dropped 90% between 2010 and 2023. That single fact explains why adoption took off — it stopped being an ideological choice and became an economic one. Germany gets 46% of its electricity from renewables now. The transition is real, but the storage problem is still mostly unsolved."

Output ONLY the rewritten text. No preamble. No commentary. No "Here is the rewritten version:".`;
}

function buildUserPrompt(
  text: string,
  tone: ToneOption,
  analysisResult: AnalysisResult
): string {
  const detectedPatternDescriptions = analysisResult.patterns
    .slice(0, 12)
    .map(p => `- ${p.label} (${p.severity}): ${p.examples.join(", ")}`)
    .join("\n");

  const extendedBannedWords = [
    // Tier 1 — dead giveaways
    "delve", "tapestry", "landscape", "moreover", "furthermore", "comprehensive",
    "multifaceted", "pivotal", "nuanced", "intricate", "underscores", "underpins",
    "embark", "unravel", "endeavor", "testament", "cornerstone", "paramount",
    "fostering", "navigating", "groundbreaking", "spearhead", "reimagine",
    "disruptive", "cutting-edge", "game-changing", "revolutionary", "unprecedented",
    "transformative", "visionary", "pioneering", "synergistic", "seamlessly",
    "holistically", "robust", "leverage", "utilize", "facilitate", "paradigm",
    "innovative", "dynamic", "holistic", "proactive", "meticulous",
    // Skill additions
    "vibrant", "bustling", "nestled", "realm", "showcase", "seamless",
    "catalyst", "invaluable", "quintessential", "illuminate", "encompasses",
    "ubiquitous", "proactive", "actionable", "impactful", "deliverables",
    "stakeholders", "ecosystem", "bandwidth", "showcasing", "highlighting",
    "demonstrating", "reflecting", "underscoring",
  ].join(", ");

  const bannedPhrases = [
    ...SYCOPHANTIC_PHRASES.slice(0, 8),
    "in today's rapidly evolving",
    "in the realm of",
    "when it comes to",
    "it is important to note",
    "it's worth mentioning",
    "serves as a testament",
    "in conclusion",
    "to sum up",
    "moving forward",
    "the future looks bright",
    "exciting times lie ahead",
    "in order to",
    "due to the fact that",
  ].join(", ");

  const wordCount = analysisResult.wordCount;
  const targetRange = `${Math.round(wordCount * 0.9)}–${Math.round(wordCount * 1.1)}`;

  return `Rewrite the following text in 3 mental passes:

PASS 1 — Vocabulary: Replace every AI-flagged word with a plain, direct alternative. Never use these words: ${extendedBannedWords}

PASS 2 — Structure: Break up uniform sentence lengths. Mix punchy short sentences with longer ones. Remove list-heavy formatting if present. Kill all these phrases: ${bannedPhrases}

PASS 3 — Personality: Add one concrete specific (a number, name, date, or example). Replace any vague attribution ("experts say", "studies show") with either a named source or your own direct claim. Add one opinion or reaction — what does this actually mean?

## Tone: ${TONE_INSTRUCTIONS[tone]}

## Detected AI patterns to fix in this specific text:
${detectedPatternDescriptions}

## Hard constraints:
- Target word count: ${targetRange} words
- Min 2 sentences under 8 words
- Min 1 sentence over 30 words
- Never 3+ consecutive sentences of similar length (within ±3 words of each other)
- Preserve the original meaning completely — do not invent facts not implied by the original

## Original text:
${text}

## Rewritten text:`;
}

/**
 * Rewrite text to sound more human using Claude.
 */
export async function humanizeText(
  text: string,
  tone: ToneOption,
  analysisResult: AnalysisResult
): Promise<{ humanizedText: string; tokensUsed: number }> {
  // Max tokens = 2× input word count, minimum 256
  const maxTokens = Math.max(256, analysisResult.wordCount * 2);

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: maxTokens,
    temperature: 0.85,
    system: buildSystemPrompt(),
    messages: [
      {
        role: "user",
        content: buildUserPrompt(text, tone, analysisResult),
      },
    ],
  });

  const humanizedText =
    response.content[0].type === "text" ? response.content[0].text.trim() : text;
  const tokensUsed = response.usage.input_tokens + response.usage.output_tokens;

  return { humanizedText, tokensUsed };
}
