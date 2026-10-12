// POST /api/admin/email/personal and ./test: a personal email goes to a
// contact only after the admin sent the exact same content to their own inbox.

const mockDb = {
  contact: { findUnique: jest.fn() },
  emailMessage: { findFirst: jest.fn() },
};

jest.mock("@/lib/db", () => ({ db: mockDb }));
jest.mock("@/lib/admin", () => ({ requireAdmin: jest.fn(async () => ({ id: "admin_1", email: "founder@example.com" })) }));
jest.mock("@/lib/audit", () => ({ logAudit: jest.fn(async () => {}) }));
jest.mock("@/lib/crm/contacts", () => ({ getOrCreateContactForUser: jest.fn(async () => "contact_admin") }));
jest.mock("@/lib/rate-limit", () => ({ checkDailyLimit: jest.fn(async () => ({ ok: true })) }));
jest.mock("@/lib/email/send", () => ({ sendEmail: jest.fn() }));
jest.mock("@/lib/growth/safe", () => ({ logGrowthError: jest.fn() }));
jest.mock("@/lib/email/campaigns", () => ({ CampaignError: class CampaignError extends Error {} }));

import { POST as send } from "@/app/api/admin/email/personal/route";
import { POST as sendTest } from "@/app/api/admin/email/personal/test/route";
import { personalDigest } from "@/lib/email/personal";
import { sendEmail } from "@/lib/email/send";

const mockSend = sendEmail as jest.Mock;
const EMAIL = { subject: "Your Pro trial", bodyMd: "Hi Abbie,\n\nYou're on Pro for 30 days." };

function post(url: string, body: unknown) {
  return new Request(`http://localhost${url}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockDb.contact.findUnique.mockResolvedValue({ id: "contact_user" });
  mockSend.mockResolvedValue({ status: "sent", messageId: "m1", resendId: "r1" });
});

describe("test send", () => {
  it("sends the content as a [TEST] to the admin's own contact under a per-digest test key", async () => {
    const res = await sendTest(post("/api/admin/email/personal/test", EMAIL));

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, to: "founder@example.com" });
    const input = mockSend.mock.calls[0][0];
    expect(input).toMatchObject({ contactId: "contact_admin", template: "personal_note", isTest: true, props: EMAIL });
    expect(input.dedupeKey).toMatch(new RegExp(`^test:personal:${personalDigest(EMAIL.subject, EMAIL.bodyMd)}:\\d+$`));
  });

  it("reports a held-back test as not sent", async () => {
    mockSend.mockResolvedValue({ status: "deferred", reason: "disabled" });

    const res = await sendTest(post("/api/admin/email/personal/test", EMAIL));

    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ ok: false, message: "Email sending is switched off." });
  });
});

describe("real send", () => {
  it("is refused without a recent test of this exact content, and sends nothing", async () => {
    mockDb.emailMessage.findFirst.mockResolvedValue(null);

    const res = await send(post("/api/admin/email/personal", { contactId: "contact_user", ...EMAIL }));

    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("TEST_REQUIRED");
    expect(mockSend).not.toHaveBeenCalled();
    const where = mockDb.emailMessage.findFirst.mock.calls[0][0].where;
    expect(where).toMatchObject({
      contactId: "contact_admin",
      dedupeKey: { startsWith: `test:personal:${personalDigest(EMAIL.subject, EMAIL.bodyMd)}:` },
      status: { in: ["sent", "delivered"] },
    });
  });

  it("sends to the contact once a test of the same content went out", async () => {
    mockDb.emailMessage.findFirst.mockResolvedValue({ id: "test_row" });

    const res = await send(post("/api/admin/email/personal", { contactId: "contact_user", ...EMAIL }));

    expect(res.status).toBe(200);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ contactId: "contact_user", template: "personal_note", dedupeKey: `personal:contact_user:${personalDigest(EMAIL.subject, EMAIL.bodyMd)}` })
    );
    expect(mockSend.mock.calls[0][0].isTest).toBeUndefined();
  });

  it("ties the test to the content: an edited body has another digest", () => {
    expect(personalDigest(EMAIL.subject, `${EMAIL.bodyMd} Thanks!`)).not.toBe(personalDigest(EMAIL.subject, EMAIL.bodyMd));
  });
});
