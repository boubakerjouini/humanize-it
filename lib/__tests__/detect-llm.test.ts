// lib/detect-llm.ts: the deep scan never invents a score and its headline
// always matches the score.

const mockComplete = jest.fn();
jest.mock("@/lib/llm", () => ({ complete: (...args: unknown[]) => mockComplete(...args) }));

import { deepScanText } from "@/lib/detect-llm";

function modelSays(json: unknown) {
  mockComplete.mockResolvedValueOnce({ text: typeof json === "string" ? json : JSON.stringify(json), tokensUsed: 900, model: "anthropic:test" });
}

beforeEach(() => mockComplete.mockReset());

it("fails the scan when the model gives no usable score, instead of reporting 50", async () => {
  modelSays({ confidence: "high", verdict: "Clearly human", signals: [], reasoning: "" });
  await expect(deepScanText("some text")).rejects.toThrow(/aiLikelihood/);
  modelSays({ aiLikelihood: "unknown", confidence: "low" });
  await expect(deepScanText("some text")).rejects.toThrow(/aiLikelihood/);
});

it("reads the score under the misspelled key the model really produced", async () => {
  modelSays('```json\n{"aiLelihood": 8, "confidence": "high", "verdict": "Clearly human", "signals": [], "reasoning": ""}\n```');
  const r = await deepScanText("some text");
  expect(r.aiLikelihood).toBe(8);
  expect(r.verdict).toBe("Very likely human-written");
});

it("derives the headline from the score, ignoring a contradicting model phrase", async () => {
  modelSays({ aiLikelihood: 50, confidence: "high", verdict: "Clearly human", signals: ["a"], reasoning: "r" });
  const r = await deepScanText("some text");
  expect(r.aiLikelihood).toBe(50);
  expect(r.verdict).toBe("Mixed / uncertain");
});

it("clamps and rounds numeric strings", async () => {
  modelSays('Sure. {"aiLikelihood": "104.6", "confidence": "medium", "signals": [], "reasoning": ""} done');
  expect((await deepScanText("x")).aiLikelihood).toBe(100);
});
