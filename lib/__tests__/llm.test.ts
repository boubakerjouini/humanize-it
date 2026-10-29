// ===========================================================
// Tests for lib/llm.ts — request params per model generation, and reading a
// response whose first block is a thinking block (newer models).
// ===========================================================

const mockCreate = jest.fn();
jest.mock("@/lib/anthropic", () => ({ anthropic: { messages: { create: (...a: unknown[]) => mockCreate(...a) } } }));

import { anthropicParams, complete, isLegacyClaude } from "../llm";

const req = { system: "s", prompt: "p", maxTokens: 100, temperature: 0 };

describe("isLegacyClaude", () => {
  test.each([
    ["claude-sonnet-4-5", true],
    ["claude-sonnet-4-5-20250929", true],
    ["claude-sonnet-4-20250514", true],
    ["claude-3-5-sonnet-20241022", true],
    ["claude-sonnet-4-6", true],
    ["claude-opus-4-7", false],
    ["claude-sonnet-5-5", false],
    ["claude-opus-5-5", false],
  ])("%s → %s", (model, legacy) => expect(isLegacyClaude(model)).toBe(legacy));
});

describe("anthropicParams", () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  test("legacy models get the temperature", () => {
    expect(anthropicParams("claude-sonnet-4-5", req)).toEqual({ temperature: 0 });
  });

  test("newer models get no sampling params and thinking off by default", () => {
    expect(anthropicParams("claude-sonnet-5-5", req)).toEqual({
      thinking: { type: "between_tools" },
      output_config: { effort: "high" },
    });
  });

  test("adaptive thinking is opt-in by env, at low effort", () => {
    process.env.ANTHROPIC_THINKING = "adaptive";
    expect(anthropicParams("claude-sonnet-5-5", req)).toEqual({ thinking: { type: "adaptive" }, output_config: { effort: "low" } });
  });
});

describe("complete (Anthropic)", () => {
  beforeAll(() => {
    process.env.ANTHROPIC_API_KEY = "test";
  });

  test("reads the text after a thinking block and reports usage and stop reason", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "thinking", thinking: "" }, { type: "text", text: " Rewritten. " }],
      usage: { input_tokens: 12, output_tokens: 5 },
      stop_reason: "end_turn",
    });
    const r = await complete(req);
    expect(r).toMatchObject({ text: "Rewritten.", inputTokens: 12, outputTokens: 5, tokensUsed: 17, stopReason: "end" });
  });

  test("surfaces a cut-off response", async () => {
    mockCreate.mockResolvedValueOnce({ content: [{ type: "text", text: "Half" }], usage: { input_tokens: 1, output_tokens: 100 }, stop_reason: "max_tokens" });
    expect((await complete(req)).stopReason).toBe("max_tokens");
  });
});
