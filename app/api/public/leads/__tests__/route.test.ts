// POST /api/public/leads: what an anonymous capture may send. No visitor
// string reaches the report email, an address that complained or opted out
// gets nothing (with the same answer), and a global daily cap protects the
// budget the rest of the product's email needs.

const mockDb = {
  contact: { findUnique: jest.fn() },
  emailSuppression: { count: jest.fn() },
};
const limits = new Map<string, number>();

jest.mock("@/lib/db", () => ({ db: mockDb }));
jest.mock("@/lib/email/send", () => ({ canSendInline: jest.fn(async () => true), sendEmail: jest.fn(async () => ({ status: "sent" })) }));
jest.mock("@/lib/crm/consent", () => ({ grantTopics: jest.fn(async () => ({ ok: true, granted: [] })) }));
jest.mock("@/lib/crm/contacts", () => ({ upsertLeadContact: jest.fn(async () => ({ contactId: "c_1", created: true })) }));
jest.mock("@/lib/crm/events", () => ({ recordEvent: jest.fn(async () => null) }));
jest.mock("@/lib/crm/recompute", () => ({ recomputeContact: jest.fn() }));
jest.mock("@/lib/growth/attribution-server", () => ({ readAttribution: jest.fn(async () => null) }));
jest.mock("@/lib/growth/daily-metrics", () => ({ bumpDailyMetric: jest.fn(), utcDay: (d: Date) => d }));
jest.mock("@/lib/growth/safe", () => ({ runAfter: (_l: string, fn: () => unknown) => void fn(), logGrowthError: jest.fn() }));
jest.mock("@/lib/growth/lead-validation", () => ({
  ...jest.requireActual("@/lib/growth/lead-validation"),
  checkMailDomain: jest.fn(async () => "ok"),
}));
jest.mock("@/lib/rate-limit", () => {
  const hit = async (key: string, limit: number) => {
    const n = (limits.get(key) ?? 0) + 1;
    limits.set(key, n);
    return { ok: n <= limit, limit, remaining: Math.max(0, limit - n), retryAfterSeconds: 60 };
  };
  return { checkRateLimit: hit, checkDailyLimit: hit, rateLimitHeaders: () => ({}) };
});

import { POST } from "@/app/api/public/leads/route";
import { sendEmail } from "@/lib/email/send";

let ipCounter = 0;
function post(body: Record<string, unknown>) {
  ipCounter++;
  return POST(
    new Request("http://localhost/api/public/leads", {
      method: "POST",
      body: JSON.stringify({ elapsedMs: 5000, ...body }),
      headers: { "x-real-ip": `203.0.113.${ipCounter % 250}` },
    })
  );
}

const report = (email: string, extra: Record<string, unknown> = {}) => ({
  email,
  source: "detector_report",
  context: { instantScore: 62, deepScore: 71, confidence: "medium", patterns: [{ id: "filler", hits: 3 }, { id: "not-a-pattern", hits: 2 }] },
  ...extra,
});

beforeAll(() => {
  process.env.EMAIL_TOKEN_SECRET = "test-token-secret";
});

beforeEach(() => {
  jest.clearAllMocks();
  limits.clear();
  ipCounter = 0;
  mockDb.contact.findUnique.mockResolvedValue({ emailStatus: "ok", pendingTopics: [] });
  mockDb.emailSuppression.count.mockResolvedValue(0);
});

it("builds the report from catalog labels and drops unknown pattern ids", async () => {
  const res = await post(report("ana@example.com"));
  expect(await res.json()).toEqual({ ok: true, delivery: "email" });
  const props = (sendEmail as jest.Mock).mock.calls[0][0].props;
  expect(props.patterns).toEqual([{ id: "filler", label: "Filler Phrases", hits: 3 }]);
  expect(props).not.toHaveProperty("verdict");
});

it("rejects a free-text verdict", async () => {
  const res = await post(report("ana@example.com", { context: { instantScore: 50, verdict: "Verify at evil.example", patterns: [] } }));
  expect(res.status).toBe(400);
  expect(sendEmail).not.toHaveBeenCalled();
});

it("sends nothing to an address that complained, with the same answer", async () => {
  mockDb.contact.findUnique.mockResolvedValue({ emailStatus: "complained", pendingTopics: [] });
  const res = await post(report("ana@example.com"));
  expect(await res.json()).toEqual({ ok: true, delivery: "email" });
  expect(sendEmail).not.toHaveBeenCalled();
});

it("sends nothing to a suppressed address", async () => {
  mockDb.emailSuppression.count.mockResolvedValue(1);
  await post({ email: "ana@example.com", source: "magnet_page", magnet: "false-ai-flag-appeal-kit" });
  expect(sendEmail).not.toHaveBeenCalled();
});

it("stops sending lead email at the global daily cap and falls back to the link", async () => {
  for (let i = 0; i < 30; i++) await post({ email: `p${i}@example.com`, source: "magnet_page", magnet: "false-ai-flag-appeal-kit" });
  expect(sendEmail).toHaveBeenCalledTimes(30);
  const res = await post({ email: "late@example.com", source: "magnet_page", magnet: "false-ai-flag-appeal-kit" });
  const body = await res.json();
  expect(body.delivery).toBe("link");
  expect(body.downloadUrl).toBeTruthy();
  expect(sendEmail).toHaveBeenCalledTimes(30);
});
