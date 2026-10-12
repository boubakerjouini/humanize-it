// POST /api/detect: a finished deep scan is counted in PostHog under a fresh,
// anonymous id with no person profile, never with the text; a refused or
// failed scan counts nothing.

jest.mock("@/lib/db", () => ({ db: {} }));
jest.mock("@clerk/nextjs/server", () => ({ auth: jest.fn(async () => ({ userId: null })) }));
jest.mock("@/lib/user", () => ({ ensureUser: jest.fn() }));
jest.mock("@/lib/llm", () => ({ activeProvider: () => "anthropic" }));
jest.mock("@/lib/detect-llm", () => ({ deepScanText: jest.fn() }));
jest.mock("@/lib/rate-limit", () => ({
  checkRateLimit: jest.fn(async () => ({ ok: true, limit: 5, remaining: 4, retryAfterSeconds: 0 })),
  checkDailyLimit: jest.fn(async () => ({ ok: true, limit: 15, remaining: 14, retryAfterSeconds: 0 })),
  rateLimitHeaders: () => ({}),
}));
jest.mock("@/lib/growth/attribution-server", () => ({
  ...jest.requireActual("@/lib/growth/attribution-server"),
  readAttribution: jest.fn(async () => null),
}));
jest.mock("@/lib/growth/safe", () => ({ runAfter: (_l: string, fn: () => unknown) => void fn(), logGrowthError: jest.fn() }));
jest.mock("@/lib/posthog", () => ({ trackServer: jest.fn() }));

import { POST } from "@/app/api/detect/route";
import { auth } from "@clerk/nextjs/server";
import { ensureUser } from "@/lib/user";
import { deepScanText } from "@/lib/detect-llm";
import { buildTouch } from "@/lib/growth/attribution";
import { readAttribution } from "@/lib/growth/attribution-server";
import { checkDailyLimit } from "@/lib/rate-limit";
import { trackServer } from "@/lib/posthog";

const TEXT = Array.from({ length: 40 }, (_, i) => `secretword${i}`).join(" ");

function scan(text = TEXT) {
  return POST(new Request("http://localhost/api/detect", { method: "POST", body: JSON.stringify({ text }), headers: { "x-real-ip": "203.0.113.7" } }));
}

beforeEach(() => {
  jest.clearAllMocks();
  (deepScanText as jest.Mock).mockResolvedValue({
    aiLikelihood: 71.6,
    confidence: "medium",
    verdict: "Likely AI-generated",
    signals: ["uniform sentence length"],
    reasoning: "Even rhythm throughout.",
    model: "test-model",
  });
});

it("counts a finished scan without the text, under a fresh anonymous id", async () => {
  const res = await scan();
  expect(res.status).toBe(200);
  await scan();
  expect(trackServer).toHaveBeenCalledTimes(2);
  const [id, event, props] = (trackServer as jest.Mock).mock.calls[0];
  expect(event).toBe("deep_scan_completed");
  expect(props).toEqual({
    word_count: 40,
    ai_likelihood: 72,
    confidence: "medium",
    signed_in: false,
    channel: "unknown",
    $process_person_profile: false,
  });
  expect(id).toMatch(/^[0-9a-f-]{36}$/);
  expect((trackServer as jest.Mock).mock.calls[1][0]).not.toBe(id);
  expect(JSON.stringify((trackServer as jest.Mock).mock.calls)).not.toContain("secretword");
});

it("adds the channel and campaign from the attribution cookie, and whether the visitor is signed in", async () => {
  (auth as unknown as jest.Mock).mockResolvedValueOnce({ userId: "user_1" });
  (ensureUser as jest.Mock).mockResolvedValueOnce({ id: "u_1", plan: "FREE" });
  const first = buildTouch({ href: "https://humanizeit.app/ai-detector?utm_source=reddit&utm_campaign=launch-day", now: Date.now() });
  (readAttribution as jest.Mock).mockResolvedValueOnce({ first, last: null });
  await scan();
  expect((trackServer as jest.Mock).mock.calls[0][2]).toMatchObject({
    signed_in: true,
    channel: "social",
    utm_source: "reddit",
    utm_campaign: "launch-day",
  });
});

it("counts nothing when the scan fails or is refused", async () => {
  (deepScanText as jest.Mock).mockRejectedValueOnce(new Error("model down"));
  const quiet = jest.spyOn(console, "error").mockImplementation(() => {});
  expect((await scan()).status).toBe(502);
  quiet.mockRestore();
  expect((await scan("too short")).status).toBe(400);
  (checkDailyLimit as jest.Mock).mockResolvedValueOnce({ ok: false, limit: 15, remaining: 0, retryAfterSeconds: 60 });
  expect((await scan()).status).toBe(429);
  expect(trackServer).not.toHaveBeenCalled();
});
