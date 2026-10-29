// ===========================================================
// lib/llm.ts — Provider-flexible text completion
//
// The humanization engine used to call the Anthropic SDK directly via a
// hard dependency on ANTHROPIC_API_KEY. In environments where only
// OPENAI_API_KEY is configured every rewrite failed with a 502 — which is
// why "the current flow is not working". This module makes the model call
// provider-agnostic:
//
//   1. Anthropic (ANTHROPIC_MODEL, default below) — used when ANTHROPIC_API_KEY is set.
//   2. OpenAI    (gpt-4o by default)  — fallback when only OPENAI_API_KEY is set.
//   3. Otherwise → a clear, surfaced error (never a silent empty result).
//
// Steps in the durable document workflow and the legacy /api/humanize route
// both call complete() so behaviour is identical regardless of provider.
//
// Model generations differ on the wire: Claude 4.5 and older take a
// `temperature`; newer ones reject non-default sampling and think by default
// (thinking blocks come BEFORE the text block, and thinking tokens count
// toward max_tokens). anthropicParams() keeps one call shape working on both,
// so switching ANTHROPIC_MODEL is a one-line change.
// ===========================================================

import Anthropic from "@anthropic-ai/sdk";
import { anthropic } from "@/lib/anthropic";

export interface CompletionRequest {
  system: string;
  prompt: string;
  maxTokens: number;
  /** 0–2. Defaults to 1.0 (high variance helps humanization). Ignored by models that reject sampling params. */
  temperature?: number;
}

export interface CompletionResult {
  text: string;
  tokensUsed: number;
  /** e.g. "anthropic:claude-sonnet-4-5" or "openai:gpt-4o" — stored on the document. */
  model: string;
  inputTokens: number;
  outputTokens: number;
  /**
   * Why generation stopped, normalised: "end" (finished), "max_tokens"
   * (cut off: the text is incomplete), "refusal" (declined), or the raw value.
   */
  stopReason: string;
}

export type LlmProvider = "anthropic" | "openai" | "none";

const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5";
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o";

/** Which provider will actually be used for a completion right now. */
export function activeProvider(): LlmProvider {
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.OPENAI_API_KEY) return "openai";
  return "none";
}

export class LlmConfigError extends Error {
  constructor() {
    super(
      "No AI provider configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY."
    );
    this.name = "LlmConfigError";
  }
}

/**
 * Claude 3.x and 4.0–4.6 accept `temperature` and don't think unless asked.
 * Handles both id shapes: claude-sonnet-4-5(-20250929) and claude-3-5-sonnet-20241022.
 */
export function isLegacyClaude(model: string): boolean {
  const m = /^claude-(?:(?:sonnet|opus|haiku)-)?(\d+)(?:-(\d+))?/.exec(model);
  if (!m) return false;
  const major = Number(m[1]);
  // A date suffix right after the major (claude-sonnet-4-20250514) is not a minor version.
  const minor = m[2] && m[2].length <= 2 ? Number(m[2]) : 0;
  return major < 4 || (major === 4 && minor <= 6);
}

/**
 * Request params that differ by model generation. Newer models: no
 * temperature (non-default values 400), thinking off by default because these
 * are single-shot rewrite/grading calls where thinking only adds latency and
 * eats max_tokens, and an explicit effort. Both are overridable by env for
 * the model A/B (ANTHROPIC_THINKING=adaptive, ANTHROPIC_EFFORT=low|medium|high).
 */
export function anthropicParams(model: string, req: CompletionRequest): Record<string, unknown> {
  if (isLegacyClaude(model)) return { temperature: req.temperature ?? 1.0 };
  const thinking = process.env.ANTHROPIC_THINKING === "adaptive" ? { type: "adaptive" } : { type: "between_tools" };
  const effort = process.env.ANTHROPIC_EFFORT ?? (thinking.type === "adaptive" ? "low" : "high");
  return { thinking, output_config: { effort } };
}

async function completeWithAnthropic(req: CompletionRequest): Promise<CompletionResult> {
  // Cast: the pinned SDK's types predate thinking/output_config; the body is sent as-is.
  const response = (await anthropic.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: req.maxTokens,
    system: req.system,
    messages: [{ role: "user", content: req.prompt }],
    ...anthropicParams(ANTHROPIC_MODEL, req),
  } as Anthropic.MessageCreateParamsNonStreaming)) as Anthropic.Message;

  // Every text block, not content[0]: on thinking models the first block is
  // the (empty) thinking block, which read as an empty rewrite.
  const text = response.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim();
  const inputTokens = response.usage.input_tokens;
  const outputTokens = response.usage.output_tokens;
  const raw = response.stop_reason ?? "end";
  const stopReason = raw === "end_turn" || raw === "stop_sequence" ? "end" : raw;

  return {
    text,
    tokensUsed: inputTokens + outputTokens,
    model: `anthropic:${ANTHROPIC_MODEL}`,
    inputTokens,
    outputTokens,
    stopReason,
  };
}

interface OpenAIChatResponse {
  choices?: { message?: { content?: string }; finish_reason?: string }[];
  usage?: { total_tokens?: number; prompt_tokens?: number; completion_tokens?: number };
  error?: { message?: string };
}

async function completeWithOpenAI(req: CompletionRequest): Promise<CompletionResult> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      // OpenAI caps temperature at 2; 1.0 keeps parity with the Anthropic path.
      temperature: Math.min(2, req.temperature ?? 1.0),
      max_tokens: req.maxTokens,
      messages: [
        { role: "system", content: req.system },
        { role: "user", content: req.prompt },
      ],
    }),
  });

  if (!res.ok) {
    let detail = `${res.status}`;
    try {
      const body = (await res.json()) as OpenAIChatResponse;
      detail = body.error?.message ?? detail;
    } catch {
      /* keep status code */
    }
    throw new Error(`OpenAI completion failed: ${detail}`);
  }

  const body = (await res.json()) as OpenAIChatResponse;
  const text = (body.choices?.[0]?.message?.content ?? "").trim();
  const finish = body.choices?.[0]?.finish_reason ?? "stop";

  return {
    text,
    tokensUsed: body.usage?.total_tokens ?? 0,
    model: `openai:${OPENAI_MODEL}`,
    inputTokens: body.usage?.prompt_tokens ?? 0,
    outputTokens: body.usage?.completion_tokens ?? 0,
    stopReason: finish === "length" ? "max_tokens" : finish === "content_filter" ? "refusal" : "end",
  };
}

/**
 * Run a single completion using the primary provider, falling back to the other
 * provider at RUNTIME if the primary call fails and the other key is configured.
 * This gives real provider redundancy during an outage/rate-limit, not just
 * config-time selection. Throws LlmConfigError when no provider key is present.
 */
export async function complete(req: CompletionRequest): Promise<CompletionResult> {
  const provider = activeProvider();
  if (provider === "none") throw new LlmConfigError();

  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
  const hasOpenAI = !!process.env.OPENAI_API_KEY;

  if (provider === "anthropic") {
    try {
      return await completeWithAnthropic(req);
    } catch (err) {
      if (hasOpenAI) {
        console.error("[llm] Anthropic failed, falling back to OpenAI:", err);
        return completeWithOpenAI(req);
      }
      throw err;
    }
  }

  // provider === "openai"
  try {
    return await completeWithOpenAI(req);
  } catch (err) {
    if (hasAnthropic) {
      console.error("[llm] OpenAI failed, falling back to Anthropic:", err);
      return completeWithAnthropic(req);
    }
    throw err;
  }
}
