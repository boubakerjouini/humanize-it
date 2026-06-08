// ===========================================================
// lib/llm.ts — Provider-flexible text completion
//
// The humanization engine used to call the Anthropic SDK directly via a
// hard dependency on ANTHROPIC_API_KEY. In environments where only
// OPENAI_API_KEY is configured every rewrite failed with a 502 — which is
// why "the current flow is not working". This module makes the model call
// provider-agnostic:
//
//   1. Anthropic (claude-sonnet-4-5)  — used when ANTHROPIC_API_KEY is set.
//   2. OpenAI    (gpt-4o by default)  — fallback when only OPENAI_API_KEY is set.
//   3. Otherwise → a clear, surfaced error (never a silent empty result).
//
// Steps in the durable document workflow and the legacy /api/humanize route
// both call complete() so behaviour is identical regardless of provider.
// ===========================================================

import { anthropic } from "@/lib/anthropic";

export interface CompletionRequest {
  system: string;
  prompt: string;
  maxTokens: number;
  /** 0–2. Defaults to 1.0 (high variance helps humanization). */
  temperature?: number;
}

export interface CompletionResult {
  text: string;
  tokensUsed: number;
  /** e.g. "anthropic:claude-sonnet-4-5" or "openai:gpt-4o" — stored on the document. */
  model: string;
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

async function completeWithAnthropic(req: CompletionRequest): Promise<CompletionResult> {
  const response = await anthropic.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: req.maxTokens,
    temperature: req.temperature ?? 1.0,
    system: req.system,
    messages: [{ role: "user", content: req.prompt }],
  });

  const text =
    response.content[0]?.type === "text" ? response.content[0].text.trim() : "";
  const tokensUsed =
    response.usage.input_tokens + response.usage.output_tokens;

  return { text, tokensUsed, model: `anthropic:${ANTHROPIC_MODEL}` };
}

interface OpenAIChatResponse {
  choices?: { message?: { content?: string } }[];
  usage?: { total_tokens?: number };
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
  const tokensUsed = body.usage?.total_tokens ?? 0;

  return { text, tokensUsed, model: `openai:${OPENAI_MODEL}` };
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
