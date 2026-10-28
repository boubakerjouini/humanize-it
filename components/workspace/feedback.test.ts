import { summarizeUsage, formatResetIn, humanizeError, deepScanError, historyError } from "./feedback";

describe("summarizeUsage", () => {
  const base = { plan: "FREE", wordsUsed: 120, wordsLimit: 500, quotaResetAt: "2026-10-28T08:00:00.000Z" };

  it("reports words left for the plan period", () => {
    const s = summarizeUsage(base, "day");
    expect(s.wordsLeft).toBe(380);
    expect(s.pct).toBe(24);
    expect(s.periodLabel).toBe("today");
    expect(s.limitReached).toBe(false);
    expect(s.low).toBe(false);
  });

  it("refills one period after quotaResetAt, like lib/quota", () => {
    expect(summarizeUsage(base, "day").resetsAt?.toISOString()).toBe("2026-10-29T08:00:00.000Z");
    expect(summarizeUsage(base, "month").periodLabel).toBe("this month");
    expect(summarizeUsage(base, "month").resetsAt?.getUTCMonth()).toBe(10);
  });

  it("is at the limit only when bonus words are gone too", () => {
    expect(summarizeUsage({ ...base, wordsUsed: 500 }, "day").limitReached).toBe(true);
    expect(summarizeUsage({ ...base, wordsUsed: 520, bonusWords: 300 }, "day").limitReached).toBe(false);
  });

  it("flags a low balance under 10%", () => {
    expect(summarizeUsage({ ...base, wordsUsed: 460 }, "day").low).toBe(true);
  });

  it("handles unlimited plans and a missing reset date", () => {
    const s = summarizeUsage({ ...base, wordsLimit: -1, quotaResetAt: null }, "month");
    expect(s.unlimited).toBe(true);
    expect(s.limitReached).toBe(false);
    expect(s.pct).toBe(0);
    expect(s.resetsAt).toBeNull();
  });
});

describe("formatResetIn", () => {
  const now = new Date("2026-10-28T10:00:00.000Z");
  it("uses minutes, hours, then a date", () => {
    expect(formatResetIn(new Date("2026-10-28T10:30:00.000Z"), now)).toBe("in 30 min");
    expect(formatResetIn(new Date("2026-10-28T15:00:00.000Z"), now)).toBe("in 5h");
    expect(formatResetIn(new Date("2026-11-03T12:00:00.000Z"), now)).toBe("on Nov 3");
  });
});

describe("humanizeError", () => {
  it("never surfaces a raw server message for unknown failures", () => {
    const e = humanizeError(500, { error: { code: "INTERNAL_ERROR", message: "PrismaClientKnownRequestError: boom" } });
    expect(e.message).not.toMatch(/Prisma/);
    expect(e.retryable).toBe(true);
  });

  it("maps offline, session and rate limits", () => {
    expect(humanizeError(0).title).toMatch(/offline/);
    expect(humanizeError(401).signIn).toBe(true);
    expect(humanizeError(429).retryable).toBe(true);
  });

  it("says no words were used when the route refunded them", () => {
    expect(humanizeError(502, { error: { code: "REWRITE_FAILED" } }).message).toMatch(/no words were used/);
    expect(humanizeError(502, { error: { code: "EMPTY_RESULT" } }).message).toMatch(/no words were used/);
  });

  it("does not offer Retry for input problems", () => {
    expect(humanizeError(400, { error: { code: "TEXT_TOO_LONG" } }).retryable).toBe(false);
  });
});

describe("deepScanError", () => {
  it("passes through the user-facing length message", () => {
    const e = deepScanError(400, { error: { code: "TEXT_TOO_SHORT", message: "Paste at least 25 words for an accurate deep scan." } });
    expect(e.message).toBe("Paste at least 25 words for an accurate deep scan.");
    expect(e.retryable).toBe(false);
  });

  it("checks the daily limit before the generic rate limit wording", () => {
    expect(deepScanError(429, { error: { code: "DAILY_LIMIT_REACHED" } }).retryable).toBe(false);
    expect(deepScanError(429, { error: { code: "RATE_LIMITED" } }).retryable).toBe(true);
  });
});

describe("historyError", () => {
  it("offers Retry for server errors", () => {
    expect(historyError(500).retryable).toBe(true);
  });
});
