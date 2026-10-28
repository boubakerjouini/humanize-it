// POST /api/detect limits, against an in-memory limiter keyed exactly like the
// real one: anonymous IPv6 callers are bucketed per /64, the global anonymous
// ceiling refuses fresh IPs without a model call, and signed-in callers keep
// their per-account scope and skip the anonymous ceiling.

jest.mock("@/lib/db", () => ({ db: {} }));
jest.mock("@clerk/nextjs/server", () => ({ auth: jest.fn(async () => ({ userId: null })) }));
jest.mock("@/lib/user", () => ({ ensureUser: jest.fn() }));
jest.mock("@/lib/llm", () => ({ activeProvider: () => "anthropic" }));
jest.mock("@/lib/detect-llm", () => ({ deepScanText: jest.fn() }));
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

import { POST } from "@/app/api/detect/route";
import { auth } from "@clerk/nextjs/server";
import { ensureUser } from "@/lib/user";
import { deepScanText } from "@/lib/detect-llm";

const TEXT = Array.from({ length: 40 }, (_, i) => `word${i}`).join(" ");

function scan(ip: string) {
  return POST(new Request("http://localhost/api/detect", { method: "POST", body: JSON.stringify({ text: TEXT }), headers: { "x-real-ip": ip } }));
}

beforeEach(() => {
  mockCounts.clear();
  jest.clearAllMocks();
  (deepScanText as jest.Mock).mockResolvedValue({ aiLikelihood: 50, confidence: "low", verdict: "Mixed", signals: [], reasoning: "", model: "m" });
});

it("keys anonymous IPv6 callers on their /64", async () => {
  await scan("2a01:db8:1:1::1");
  await scan("2a01:db8:1:1::ffff");
  expect(mockCounts.get("detect:day:ip:2a01:db8:1:1::/64")).toBe(2);
});

it("refuses a fresh IP once the global anonymous ceiling is used up, without calling the model", async () => {
  mockCounts.set("detect:day:anon:all", 1500);
  const res = await scan("198.51.100.20");
  expect(res.status).toBe(429);
  expect(await res.json()).toEqual({
    error: { code: "BUSY_TRY_LATER", message: "The free tool is busy today. Sign up free to keep going." },
    signupCta: true,
  });
  expect(deepScanText).not.toHaveBeenCalled();
});

it("keeps signed-in callers on their account scope, outside the anonymous ceiling", async () => {
  mockCounts.set("detect:day:anon:all", 1500);
  (auth as unknown as jest.Mock).mockResolvedValueOnce({ userId: "user_1" });
  (ensureUser as jest.Mock).mockResolvedValueOnce({ id: "u_1", plan: "FREE" });
  expect((await scan("198.51.100.20")).status).toBe(200);
  expect(mockCounts.get("detect:day:user:u_1")).toBe(1);
  expect(mockCounts.get("detect:day:anon:all")).toBe(1500);
});
