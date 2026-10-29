// ===========================================================
// HumanizeIt — Anthropic Claude Client Singleton
//
// Timeout and retries are explicit because the SDK defaults (10 min, 2
// retries) outlive a Vercel function (300 s): a stalled call used to hang
// until the platform killed the request, with no refund and no error copy.
// 90 s per attempt fits a ~1,000-word chunk with room to spare; the SDK
// retries 408/409/429/5xx and 529 "overloaded" with backoff (honouring
// retry-after), so short provider blips never reach the user.
// ===========================================================

import Anthropic from "@anthropic-ai/sdk";

const globalForAnthropic = globalThis as unknown as {
  anthropic: Anthropic | undefined;
};

export const anthropic =
  globalForAnthropic.anthropic ??
  new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    timeout: 90_000,
    maxRetries: 2,
  });

if (process.env.NODE_ENV !== "production") {
  globalForAnthropic.anthropic = anthropic;
}
