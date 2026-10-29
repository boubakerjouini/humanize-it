// ===========================================================
// Tests for rewriteFailure — the API answer for a failed rewrite.
// ===========================================================

import Anthropic from "@anthropic-ai/sdk";
import { rewriteFailure } from "../rewrite-errors";
import { HumanizeError } from "../algorithms/humanizeText";

function apiError(status: number) {
  return Anthropic.APIError.generate(status, { type: "error", error: { type: "x", message: "x" } }, "x", new Headers());
}

describe("rewriteFailure", () => {
  test("an overloaded or rate-limited provider is a 503 with Retry-After", () => {
    for (const status of [429, 529]) {
      expect(rewriteFailure(apiError(status))).toMatchObject({ status: 503, code: "MODEL_BUSY", retryAfter: 30 });
    }
    expect(rewriteFailure(new Anthropic.APIConnectionTimeoutError())).toMatchObject({ code: "MODEL_BUSY" });
  });

  test("engine failures keep their own code", () => {
    expect(rewriteFailure(new HumanizeError("REWRITE_TRUNCATED", "x"))).toMatchObject({ status: 502, code: "REWRITE_TRUNCATED" });
    expect(rewriteFailure(new HumanizeError("REWRITE_REFUSED", "x"))).toMatchObject({ status: 422, code: "REWRITE_REFUSED" });
  });

  test("anything else is the generic retryable failure", () => {
    expect(rewriteFailure(apiError(400))).toMatchObject({ status: 502, code: "REWRITE_FAILED" });
    expect(rewriteFailure(new Error("boom"))).toMatchObject({ status: 502, code: "REWRITE_FAILED" });
  });
});
