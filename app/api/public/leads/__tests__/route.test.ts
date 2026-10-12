// POST /api/public/leads: what an anonymous capture may send. No visitor
// string reaches the report email, an address that complained or opted out
// gets nothing (with the same answer), and a global daily cap protects the
// budget the rest of the product's email needs. Past that cap or the budget,
// the email is held for the daily job instead of dropped, the founder gets one
// task a day, and a visitor without attribution cookies is attributed from the
// touch the page sent.

const mockDb = {
  contact: { findUnique: jest.fn() },
  emailSuppression: { count: jest.fn() },
  emailMessage: { create: jest.fn() },
  crmTask: { create: jest.fn() },
};
const limits = new Map<string, number>();

jest.mock("@/lib/db", () => ({ db: mockDb }));
jest.mock("@/lib/email/send", () => ({
  canSendInline: jest.fn(async () => true),
  checkSendable: jest.fn(async () => ({ ok: true })),
  sendEmail: jest.fn(async () => ({ status: "sent" })),
}));
jest.mock("@/lib/email/budget", () => ({ remainingBudget: jest.fn(async () => 0) }));
jest.mock("@/lib/crm/consent", () => ({ grantTopics: jest.fn(async () => ({ ok: true, granted: [] })) }));
jest.mock("@/lib/crm/contacts", () => ({ upsertLeadContact: jest.fn(async () => ({ contactId: "c_1", created: true })) }));
jest.mock("@/lib/crm/events", () => ({ recordEvent: jest.fn(async () => null) }));
jest.mock("@/lib/crm/recompute", () => ({ recomputeContact: jest.fn() }));
jest.mock("@/lib/growth/attribution-server", () => ({
  ...jest.requireActual("@/lib/growth/attribution-server"),
  readAttribution: jest.fn(async () => null),
}));
jest.mock("@/lib/growth/daily-metrics", () => ({ bumpDailyMetric: jest.fn(), utcDay: (d: Date) => d }));
jest.mock("@/lib/growth/safe", () => ({
  ...jest.requireActual("@/lib/growth/safe"),
  runAfter: (_l: string, fn: () => unknown) => void fn(),
  logGrowthError: jest.fn(),
}));
jest.mock("@/lib/growth/lead-validation", () => ({
  ...jest.requireActual("@/lib/growth/lead-validation"),
  checkMailDomain: jest.fn(async () => "ok"),
}));
jest.mock("@/lib/posthog", () => ({ trackServer: jest.fn() }));
jest.mock("@/lib/rate-limit", () => {
  const hit = async (key: string, limit: number) => {
    const n = (limits.get(key) ?? 0) + 1;
    limits.set(key, n);
    return { ok: n <= limit, limit, remaining: Math.max(0, limit - n), retryAfterSeconds: 60 };
  };
  return { checkRateLimit: hit, checkDailyLimit: hit, rateLimitHeaders: () => ({}) };
});

import { POST } from "@/app/api/public/leads/route";
import { canSendInline, checkSendable, sendEmail } from "@/lib/email/send";
import { upsertLeadContact } from "@/lib/crm/contacts";
import { recordEvent } from "@/lib/crm/events";
import { buildTouch, encodeTouch } from "@/lib/growth/attribution";
import { readAttribution } from "@/lib/growth/attribution-server";
import { logGrowthError } from "@/lib/growth/safe";
import { trackServer } from "@/lib/posthog";

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
const magnet = (email: string, extra: Record<string, unknown> = {}) => ({
  email,
  source: "magnet_page",
  magnet: "false-ai-flag-appeal-kit",
  ...extra,
});

/** The visit's touch as attribution-capture.tsx keeps it in memory. */
const pageTouch = (path: string, referrer = "") => buildTouch({ href: `https://humanizeit.app${path}`, referrer, now: Date.now() - 60_000 });

/** Let the work runAfter started (awaits included) finish. */
const settle = () => new Promise((resolve) => setImmediate(resolve));

beforeAll(() => {
  process.env.EMAIL_TOKEN_SECRET = "test-token-secret";
});

beforeEach(() => {
  jest.clearAllMocks();
  limits.clear();
  ipCounter = 0;
  mockDb.contact.findUnique.mockResolvedValue({ emailStatus: "ok", pendingTopics: [] });
  mockDb.emailSuppression.count.mockResolvedValue(0);
  mockDb.emailMessage.create.mockResolvedValue({ id: "m_1" });
  mockDb.crmTask.create.mockResolvedValue({ id: "t_1" });
  (canSendInline as jest.Mock).mockResolvedValue(true);
  (checkSendable as jest.Mock).mockResolvedValue({ ok: true });
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
  await post(magnet("ana@example.com"));
  expect(sendEmail).not.toHaveBeenCalled();
});

describe("past a daily limit the email is held, not dropped", () => {
  it("queues lead email past the global cap, keeps the download and opens one task for the day", async () => {
    for (let i = 0; i < 30; i++) await post(magnet(`p${i}@example.com`));
    expect(sendEmail).toHaveBeenCalledTimes(30);
    expect(mockDb.emailMessage.create).not.toHaveBeenCalled();

    const res = await post(magnet("late@example.com", { topics: ["tips"] }));
    const body = await res.json();
    expect(body.delivery).toBe("queued");
    expect(body.downloadUrl).toBeTruthy();
    expect(sendEmail).toHaveBeenCalledTimes(30);

    const row = mockDb.emailMessage.create.mock.calls[0][0].data;
    expect(row).toMatchObject({
      contactId: "c_1",
      template: "magnet_delivery",
      stream: "transactional",
      status: "queued",
      error: "held_lead_cap",
    });
    expect(row.dedupeKey).toMatch(/^magnet:c_1:false-ai-flag-appeal-kit:\d{4}-\d{2}-\d{2}$/);
    expect(row.props).toMatchObject({ magnet: "false-ai-flag-appeal-kit", consentPending: false });
    expect(row.toEmailHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(row)).not.toContain("late@example.com");

    const task = mockDb.crmTask.create.mock.calls[0][0].data;
    expect(task).toMatchObject({ priority: "high", contactId: null, ruleKey: "lead_email_held" });
    expect(task.dedupeKey).toMatch(/^lead_email_held:\d{4}-\d{2}-\d{2}$/);

    // A second held email reuses the day's task key; the unique key keeps it to one task.
    const duplicate = Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
    mockDb.crmTask.create.mockRejectedValueOnce(duplicate);
    expect((await (await post(report("later@example.com"))).json()).delivery).toBe("queued");
    await settle();
    expect(mockDb.crmTask.create.mock.calls[1][0].data.dedupeKey).toBe(task.dedupeKey);
    expect(mockDb.emailMessage.create.mock.calls[1][0].data).toMatchObject({ template: "detector_report", error: "held_lead_cap" });
    expect(logGrowthError).not.toHaveBeenCalled();
  });

  it("queues the email when the day's send budget is the only thing in the way", async () => {
    (canSendInline as jest.Mock).mockResolvedValue(false);
    // grantTopics is mocked, so the pending topics come from the contact row.
    mockDb.contact.findUnique.mockResolvedValue({ emailStatus: "ok", pendingTopics: ["extension_launch"] });
    const held = await post({ email: "ana@example.com", source: "extension_waitlist", topics: ["extension_launch"] });
    expect((await held.json()).delivery).toBe("queued");
    expect(sendEmail).not.toHaveBeenCalled();
    expect(mockDb.emailMessage.create.mock.calls[0][0].data).toMatchObject({
      template: "waitlist_confirm",
      dedupeKey: "waitlist:c_1",
      status: "queued",
      error: "held_budget",
    });
    expect(limits.has("lead:send:global")).toBe(false);
  });

  it("holds nothing when sending or the flow is switched off, and answers as today", async () => {
    (canSendInline as jest.Mock).mockResolvedValue(false);
    (checkSendable as jest.Mock).mockResolvedValue({ ok: false, outcome: { status: "deferred", reason: "flow_off" } });
    const res = await post(magnet("ana@example.com"));
    const body = await res.json();
    expect(body.delivery).toBe("link");
    expect(body.downloadUrl).toBeTruthy();
    expect(mockDb.emailMessage.create).not.toHaveBeenCalled();
    expect(mockDb.crmTask.create).not.toHaveBeenCalled();
  });

  it("gives a blocked address the queued answer everyone gets, without holding anything", async () => {
    (canSendInline as jest.Mock).mockResolvedValue(false);
    mockDb.contact.findUnique.mockResolvedValue({ emailStatus: "complained", pendingTopics: [] });
    expect((await (await post(report("ana@example.com"))).json()).delivery).toBe("queued");
    expect(mockDb.emailMessage.create).not.toHaveBeenCalled();
  });

  it("falls back to the plain answer when the held email can't be written", async () => {
    (canSendInline as jest.Mock).mockResolvedValue(false);
    mockDb.emailMessage.create.mockRejectedValueOnce(new Error("connection reset"));
    const body = await (await post(magnet("ana@example.com"))).json();
    expect(body.delivery).toBe("link");
    expect(body.downloadUrl).toBeTruthy();
    expect(mockDb.crmTask.create).not.toHaveBeenCalled();
  });
});

describe("attribution without cookies", () => {
  it("records the touch the page sent when no attribution cookie exists", async () => {
    const touch = pageTouch("/free/false-ai-flag-appeal-kit?utm_source=email&utm_medium=dm&utm_campaign=warm-seg-1");
    const res = await post(magnet("ana@example.com", { touch: encodeTouch(touch) }));
    expect(res.status).toBe(200);
    const { attribution } = (upsertLeadContact as jest.Mock).mock.calls[0][0];
    expect(attribution.first).toMatchObject({ ch: "outreach", us: "email", um: "dm", uc: "warm-seg-1", lp: "/free/false-ai-flag-appeal-kit" });
    expect(attribution.last).toEqual(attribution.first);
  });

  it("prefers the attribution cookies over the page's touch", async () => {
    const fromCookies = { first: pageTouch("/?utm_source=reddit"), last: null };
    (readAttribution as jest.Mock).mockResolvedValueOnce(fromCookies);
    await post(magnet("ana@example.com", { touch: encodeTouch(pageTouch("/?utm_source=linkedin")) }));
    expect((upsertLeadContact as jest.Mock).mock.calls[0][0].attribution).toBe(fromCookies);
  });

  it("ignores a malformed touch without failing the lead", async () => {
    const malformed: unknown[] = ["not-base64-json", 42, { ch: "paid" }];
    for (const [i, touch] of malformed.entries()) {
      const res = await post(magnet(`t${i}@example.com`, { touch }));
      expect(res.status).toBe(200);
    }
    expect(upsertLeadContact).toHaveBeenCalledTimes(malformed.length);
    for (const call of (upsertLeadContact as jest.Mock).mock.calls) expect(call[0].attribution).toBeNull();
  });

  it("still rejects any other unknown field", async () => {
    const res = await post(magnet("ana@example.com", { touchpoint: "x" }));
    expect(res.status).toBe(400);
  });
});

describe("analytics", () => {
  it("sends lead_captured to PostHog under the contact id, with the channel and no address", async () => {
    (recordEvent as jest.Mock).mockResolvedValueOnce({ id: "e_1", contactId: "c_1" });
    const touch = pageTouch("/free/false-ai-flag-appeal-kit?utm_source=linkedin&utm_medium=social&utm_campaign=launch-day");
    await post(magnet("ana@example.com", { topics: ["tips"], touch: encodeTouch(touch) }));
    await settle();
    expect(trackServer).toHaveBeenCalledTimes(1);
    const [distinctId, event, props] = (trackServer as jest.Mock).mock.calls[0];
    expect(distinctId).toBe("c_1");
    expect(event).toBe("lead_captured");
    expect(props).toEqual({
      source: "magnet_page",
      magnet: "false-ai-flag-appeal-kit",
      topics: ["tips"],
      channel: "social",
      utm_source: "linkedin",
      utm_campaign: "launch-day",
      $process_person_profile: false,
    });
    expect(JSON.stringify(props)).not.toContain("ana@example.com");
  });

  it("counts a capture once, like the daily metric: a deduplicated event sends nothing", async () => {
    await post(magnet("ana@example.com"));
    await settle();
    expect(recordEvent).toHaveBeenCalled();
    expect(trackServer).not.toHaveBeenCalled();
  });
});
