// POST /api/admin/sequences/[key]/test and PATCH { enabled }: a sequence only
// switches on once every step's current content went to an admin's inbox as a
// test. Sending is mocked; nothing here reaches Resend.

const mockDb = {
  emailMessage: { findMany: jest.fn() },
  emailFlowSetting: { upsert: jest.fn() },
};

// The template copy each step renders; a test edits it to change a digest.
const mockCopy: Record<string, string> = {};

jest.mock("@/lib/db", () => ({ db: mockDb }));
jest.mock("@/lib/admin", () => ({ requireAdmin: jest.fn(async () => ({ id: "admin_1", email: "founder@example.com" })) }));
jest.mock("@/lib/audit", () => ({ logAudit: jest.fn(async () => {}) }));
jest.mock("@/lib/crm/contacts", () => ({ getOrCreateContactForUser: jest.fn(async () => "contact_admin") }));
jest.mock("@/lib/rate-limit", () => ({ checkDailyLimit: jest.fn(async () => ({ ok: true })) }));
jest.mock("@/lib/email/send", () => ({ sendEmail: jest.fn() }));
jest.mock("@/lib/email/enroll", () => ({ invalidateFlowCache: jest.fn() }));
jest.mock("@/lib/email/sweeps", () => ({ SWEPT_SEQUENCES: [] }));
jest.mock("@/lib/growth/safe", () => ({ logGrowthError: jest.fn() }));
jest.mock("@/lib/email/campaigns", () => ({ CampaignError: class CampaignError extends Error {} }));
jest.mock("@/lib/email/render", () => ({
  ...jest.requireActual("@/lib/email/render"),
  buildRenderCtx: () => ({}),
  renderEmail: async (template: string) => ({ subject: template, html: "<p></p>", text: mockCopy[template] ?? `copy of ${template}` }),
}));

import { PATCH } from "@/app/api/admin/sequences/[key]/route";
import { POST as sendTest } from "@/app/api/admin/sequences/[key]/test/route";
import { requireAdmin } from "@/lib/admin";
import { logAudit } from "@/lib/audit";
import { checkDailyLimit } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email/send";
import { stepDigest, stepTestPrefix } from "@/lib/email/sequence-test";
import { getSequence } from "@/lib/email/sequences";

const mockSend = sendEmail as jest.Mock;
const GRANT_STEPS = getSequence("grant_expiry")!.steps;

function req(method: string, body: unknown) {
  return new Request("http://localhost/api/admin/sequences/x", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
const ctx = (key: string) => ({ params: Promise.resolve({ key }) });

/** Test rows for every grant_expiry step's current content. */
async function testRowsForAllSteps() {
  return Promise.all(
    GRANT_STEPS.map(async (s) => ({ dedupeKey: `${stepTestPrefix("grant_expiry", s.key, (await stepDigest("grant_expiry", s))!)}1`, queuedAt: new Date() }))
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  for (const k of Object.keys(mockCopy)) delete mockCopy[k];
  mockSend.mockResolvedValue({ status: "sent", messageId: "m1", resendId: "r1" });
  mockDb.emailMessage.findMany.mockResolvedValue([]);
  mockDb.emailFlowSetting.upsert.mockImplementation(async (args: { create: { enabled: boolean } }) => ({ enabled: args.create.enabled }));
});

describe("POST /test", () => {
  it("sends the step as a [TEST] to the admin's own contact under a per-digest test key", async () => {
    const res = await sendTest(req("POST", { stepKey: "grant_ends_tomorrow" }), ctx("grant_expiry"));

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, to: "founder@example.com" });
    const input = mockSend.mock.calls[0][0];
    const step = GRANT_STEPS.find((s) => s.key === "grant_ends_tomorrow")!;
    expect(input).toMatchObject({ contactId: "contact_admin", template: "grant_ends_tomorrow", isTest: true, pool: "inline" });
    expect(input.dedupeKey).toMatch(new RegExp(`^test:seq:grant_expiry:grant_ends_tomorrow:${await stepDigest("grant_expiry", step)}:\\d+$`));
    // Kept out of the step's stats.
    expect(input.sequenceKey).toBeUndefined();
    expect(input.stepKey).toBeUndefined();
    expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "sequence.test_send", targetId: "grant_expiry" }));
  });

  it("shares the personal test cap", async () => {
    (checkDailyLimit as jest.Mock).mockResolvedValueOnce({ ok: false });

    const res = await sendTest(req("POST", { stepKey: "grant_ended" }), ctx("grant_expiry"));

    expect(res.status).toBe(429);
    expect(checkDailyLimit).toHaveBeenCalledWith("admin:personal-test", 40);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("rejects an unknown step or sequence", async () => {
    expect((await sendTest(req("POST", { stepKey: "nope" }), ctx("grant_expiry"))).status).toBe(404);
    expect((await sendTest(req("POST", { stepKey: "x" }), ctx("detector_report"))).status).toBe(404);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("refuses without an admin session", async () => {
    (requireAdmin as jest.Mock).mockRejectedValueOnce(Object.assign(new Error("no"), { status: 403 }));

    const res = await sendTest(req("POST", { stepKey: "grant_ended" }), ctx("grant_expiry"));

    expect(res.status).toBe(403);
    expect(mockSend).not.toHaveBeenCalled();
  });
});

describe("PATCH enabled", () => {
  it("refuses to turn a sequence on while a step has no test of its current content", async () => {
    const rows = await testRowsForAllSteps();
    mockDb.emailMessage.findMany.mockResolvedValue(rows.slice(1));

    const res = await PATCH(req("PATCH", { enabled: true }), ctx("grant_expiry"));

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("TEST_REQUIRED");
    expect(body.error.message).toContain(GRANT_STEPS[0].key);
    expect(mockDb.emailFlowSetting.upsert).not.toHaveBeenCalled();
  });

  it("turns it on once every step was tested", async () => {
    mockDb.emailMessage.findMany.mockResolvedValue(await testRowsForAllSteps());

    const res = await PATCH(req("PATCH", { enabled: true }), ctx("grant_expiry"));

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, enabled: true });
    const where = mockDb.emailMessage.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ dedupeKey: { startsWith: "test:seq:grant_expiry:" }, status: { in: ["sent", "delivered"] } });
  });

  it("reads a step as untested again once its copy changed after the test", async () => {
    mockDb.emailMessage.findMany.mockResolvedValue(await testRowsForAllSteps());
    mockCopy.grant_ended = "edited copy";

    const res = await PATCH(req("PATCH", { enabled: true }), ctx("grant_expiry"));

    expect(res.status).toBe(409);
    expect((await res.json()).error.message).toContain("grant_ended");
  });

  it("always lets a sequence turn off", async () => {
    const res = await PATCH(req("PATCH", { enabled: false }), ctx("grant_expiry"));

    expect(res.status).toBe(200);
    expect(mockDb.emailMessage.findMany).not.toHaveBeenCalled();
  });

  it("does not gate one-off transactional flows", async () => {
    const res = await PATCH(req("PATCH", { enabled: true }), ctx("detector_report"));

    expect(res.status).toBe(200);
    expect(mockDb.emailMessage.findMany).not.toHaveBeenCalled();
  });
});
