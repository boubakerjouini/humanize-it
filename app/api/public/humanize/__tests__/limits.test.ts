// POST /api/public/humanize limits, against an in-memory limiter keyed exactly
// like the real one: IPv6 addresses in one /64 share a daily allowance, and the
// global anonymous ceiling refuses fresh IPs without calling the model.

jest.mock("@/lib/db", () => ({ db: {} }));
jest.mock("@/lib/llm", () => ({ activeProvider: () => "anthropic" }));
jest.mock("@/lib/algorithms/humanizeText", () => ({ humanizeText: jest.fn() }));
const mockCounts = new Map<string, number>();
function mockHit(key: string, limit: number) {
  const count = (mockCounts.get(key) ?? 0) + 1;
  mockCounts.set(key, count);
  return { ok: count <= limit, limit, remaining: Math.max(0, limit - count), resetAt: new Date(), retryAfterSeconds: 60 };
}
jest.mock("@/lib/rate-limit", () => ({
  checkRateLimit: jest.fn(async (key: string, limit: number) => mockHit(key, limit)),
  checkDailyLimit: jest.fn(async (key: string, limit: number) => mockHit(key, limit)),
  rateLimitHeaders: () => ({}),
}));
jest.mock("@/lib/growth/attribution-server", () => ({
  ...jest.requireActual("@/lib/growth/attribution-server"),
  readAttribution: jest.fn(async () => null),
}));
jest.mock("@/lib/growth/safe", () => ({ runAfter: jest.fn(), logGrowthError: jest.fn() }));
jest.mock("@/lib/posthog", () => ({ trackServer: jest.fn() }));

import { POST } from "@/app/api/public/humanize/route";
import { humanizeText } from "@/lib/algorithms/humanizeText";

const TEXT = "Furthermore, it is important to note that this plays a pivotal role in today's fast-paced world. Moreover, the landscape continues to evolve.";

function rewrite(ip: string) {
  return POST(new Request("http://localhost/api/public/humanize", { method: "POST", body: JSON.stringify({ text: TEXT }), headers: { "x-real-ip": ip } }));
}

beforeEach(() => {
  mockCounts.clear();
  jest.clearAllMocks();
  (humanizeText as jest.Mock).mockResolvedValue({ humanizedText: "A plain rewrite.", model: "test-model" });
});

it("gives every address in one IPv6 /64 the same daily allowance", async () => {
  expect((await rewrite("2a01:db8:1:1::1")).status).toBe(200);
  expect((await rewrite("2a01:db8:1:1::ffff")).status).toBe(200);
  const third = await rewrite("2a01:db8:1:1:abcd::9");
  expect(third.status).toBe(429);
  expect((await third.json()).error.code).toBe("DAILY_LIMIT_REACHED");
  expect(humanizeText).toHaveBeenCalledTimes(2);
  // Another /64 still has its own allowance.
  expect((await rewrite("2a01:db8:1:2::1")).status).toBe(200);
});

it("refuses a fresh IP once the global anonymous ceiling is used up, without calling the model", async () => {
  mockCounts.set("pub:hz:day:all", 300);
  const res = await rewrite("198.51.100.20");
  expect(res.status).toBe(429);
  expect(await res.json()).toEqual({
    error: { code: "BUSY_TRY_LATER", message: "The free tool is busy today. Sign up free to keep going." },
    signupCta: true,
  });
  expect(humanizeText).not.toHaveBeenCalled();
});

it("does not spend the global budget on calls an IP's own limit refused", async () => {
  for (let i = 0; i < 4; i++) await rewrite("198.51.100.30");
  expect(mockCounts.get("pub:hz:day:all")).toBe(2);
});
