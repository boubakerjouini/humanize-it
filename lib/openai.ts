// ===========================================================
// HumanizeIt — OpenAI Client Singleton
// ===========================================================

import OpenAI from "openai";

declare global {
  var openaiClient: OpenAI | undefined; // required for global augmentation
}

function createOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable is not set");
  }
  return new OpenAI({ apiKey });
}

export const openai: OpenAI =
  globalThis.openaiClient ?? createOpenAIClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.openaiClient = openai;
}
