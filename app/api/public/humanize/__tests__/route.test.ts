// POST /api/public/humanize: a finished free rewrite is counted in PostHog
// under a fresh, anonymous id with no person profile, never with the text; a
// refused or failed rewrite counts nothing.

jest.mock("@/lib/db", () => ({ db: {} }));
jest.mock("@/lib/llm", () => ({ activeProvider: () => "anthropic" }));
jest.mock("@/lib/algorithms/humanizeText", () => ({ humanizeText: jest.fn() }));
jest.mock("@/lib/rate-limit", () => ({
  checkRateLimit: jest.fn(async () => ({ ok: true, limit: 4, remaining: 3, retryAfterSeconds: 0 })),
  checkDailyLimit: jest.fn(async () => ({ ok: true, limit: 2, remaining: 1, retryAfterSeconds: 0 })),
  rateLimitHeaders: () => ({}),
}));
jest.mock("@/lib/growth/attribution-server", () => ({
  ...jest.requireActual("@/lib/growth/attribution-server"),
  readAttribution: jest.fn(async () => null),
}));
jest.mock("@/lib/growth/safe", () => ({ runAfter: (_l: string, fn: () => unknown) => void fn(), logGrowthError: jest.fn() }));
jest.mock("@/lib/posthog", () => ({ trackServer: jest.fn() }));
const mockRecordToolRun = jest.fn();
jest.mock("@/lib/growth/tool-runs", () => ({
  ...jest.requireActual("@/lib/growth/tool-runs"),
  recordToolRun: (...args: unknown[]) => mockRecordToolRun(...args),
}));

import { POST } from "@/app/api/public/humanize/route";
import { humanizeText } from "@/lib/algorithms/humanizeText";
import { buildTouch } from "@/lib/growth/attribution";
import { readAttribution } from "@/lib/growth/attribution-server";
import { checkDailyLimit } from "@/lib/rate-limit";
import { trackServer } from "@/lib/posthog";

const TEXT = "Furthermore, it is important to note that secretphrase plays a pivotal role in today's fast-paced world. Moreover, the landscape continues to evolve.";

function rewrite(body: Record<string, unknown> = { text: TEXT }) {
  return POST(new Request("http://localhost/api/public/humanize", { method: "POST", body: JSON.stringify(body), headers: { "x-real-ip": "203.0.113.9" } }));
}

beforeEach(() => {
  jest.clearAllMocks();
  (humanizeText as jest.Mock).mockResolvedValue({ humanizedText: "A plain rewrite of secretphrase.", model: "test-model" });
});

it("counts a finished rewrite without the text, under a fresh anonymous id", async () => {
  expect((await rewrite()).status).toBe(200);
  expect(trackServer).toHaveBeenCalledTimes(1);
  const [id, event, props] = (trackServer as jest.Mock).mock.calls[0];
  expect(event).toBe("free_humanize_completed");
  expect(id).toMatch(/^[0-9a-f-]{36}$/);
  expect(props).toEqual({
    word_count: TEXT.split(/\s+/).length,
    tone: "standard",
    intensity: "medium",
    channel: "unknown",
    $process_person_profile: false,
  });
  expect(JSON.stringify(props)).not.toContain("secretphrase");
});

it("adds the channel and campaign from the attribution cookie", async () => {
  const first = buildTouch({ href: "https://humanizeit.app/free-ai-humanizer?utm_source=linkedin&utm_medium=dm&utm_campaign=warm-seg-2", now: Date.now() });
  (readAttribution as jest.Mock).mockResolvedValueOnce({ first, last: first });
  await rewrite({ text: TEXT, intensity: "light" });
  expect((trackServer as jest.Mock).mock.calls[0][2]).toMatchObject({
    intensity: "light",
    channel: "outreach",
    utm_source: "linkedin",
    utm_campaign: "warm-seg-2",
  });
});

it("says exactly what a free account adds once the daily cap is reached", async () => {
  (checkDailyLimit as jest.Mock).mockResolvedValueOnce({ ok: false, limit: 2, remaining: 0, retryAfterSeconds: 60 });
  const res = await rewrite();
  expect(res.status).toBe(429);
  expect(await res.json()).toEqual({
    error: {
      code: "DAILY_LIMIT_REACHED",
      message: "You've used your 2 free rewrites for today. A free account adds 1 rewrite a day of up to 500 words; Pro has unlimited rewrites.",
    },
    signupCta: true,
  });
});

it("counts nothing when the rewrite fails or is refused", async () => {
  (humanizeText as jest.Mock).mockRejectedValueOnce(new Error("model down"));
  const quiet = jest.spyOn(console, "error").mockImplementation(() => {});
  expect((await rewrite()).status).toBe(502);
  quiet.mockRestore();
  expect((await rewrite({ text: TEXT, tone: "formal" })).status).toBe(403);
  (checkDailyLimit as jest.Mock).mockResolvedValueOnce({ ok: false, limit: 2, remaining: 0, retryAfterSeconds: 60 });
  expect((await rewrite()).status).toBe(429);
  expect(trackServer).not.toHaveBeenCalled();
});

it("records a ToolRun with the page and the before and after scores, never the text", async () => {
  await rewrite({ text: TEXT, page: "/free-ai-humanizer" });
  expect(mockRecordToolRun).toHaveBeenCalledTimes(1);
  const run = mockRecordToolRun.mock.calls[0][0];
  expect(run).toMatchObject({ tool: "humanizer_free", page: "/free-ai-humanizer", wordCount: TEXT.split(/\s+/).length, source: null });
  expect(typeof run.score).toBe("number");
  expect(typeof run.scoreAfter).toBe("number");
  expect(JSON.stringify(run)).not.toContain("secretphrase");
  expect((trackServer as jest.Mock).mock.calls[0][2]).toMatchObject({ tool_page: "/free-ai-humanizer" });
});
