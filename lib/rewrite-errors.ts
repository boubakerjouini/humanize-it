// ===========================================================
// lib/rewrite-errors.ts — One mapping from a failed rewrite to the API error
//
// Every humanize route used to answer any model failure with the same 502
// "try again", including an Anthropic overload (529) or rate limit (429)
// where trying again right away fails again. Busy → 503 + Retry-After;
// cut-off / declined rewrites get their own code so the UI can say why.
// Duck-typed (no instanceof on HumanizeError) so route tests that mock the
// engine still exercise this mapping.
// ===========================================================

import Anthropic from "@anthropic-ai/sdk";

export interface RewriteFailure {
  status: number;
  code: string;
  message: string;
  /** Seconds, for a Retry-After header. */
  retryAfter?: number;
}

/** The provider is overloaded, rate-limiting us, or timed out: worth a retry later, not a bug. */
export function isProviderBusy(err: unknown): boolean {
  if (err instanceof Anthropic.APIConnectionTimeoutError) return true;
  if (err instanceof Anthropic.APIError) {
    const status = err.status ?? 0;
    return status === 429 || status === 529 || status === 503 || status === 504;
  }
  return false;
}

export function rewriteFailure(err: unknown): RewriteFailure {
  const code = (err as { name?: string; code?: string } | null)?.name === "HumanizeError" ? (err as { code: string }).code : null;
  if (code === "REWRITE_TRUNCATED") {
    return { status: 502, code, message: "The rewrite was cut off before the end, so we didn't keep it. Try again, or split the text into shorter parts." };
  }
  if (code === "REWRITE_REFUSED") {
    return { status: 422, code, message: "The AI model declined to rewrite this text. Your original is unchanged." };
  }
  if (code === "EMPTY_RESULT") {
    return { status: 502, code, message: "The rewrite returned no usable text. Your original is unchanged." };
  }
  if (isProviderBusy(err)) {
    return { status: 503, code: "MODEL_BUSY", message: "Our AI provider is busy right now. Nothing was charged; try again in a minute.", retryAfter: 30 };
  }
  return { status: 502, code: "REWRITE_FAILED", message: "The rewrite could not be completed. Please try again." };
}
