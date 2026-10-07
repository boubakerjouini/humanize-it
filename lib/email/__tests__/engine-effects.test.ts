// A step's side effect (the quota_upgrade trial pass) runs only when its email
// can actually go out: a contact without the tips topic gets neither a PASS-
// code nor a trial_code_issued event, and the step is skipped and advanced.

const H = 3_600_000;
const now = Date.now();

const mockDb = {
  sequenceEnrollment: { findUnique: jest.fn(), updateMany: jest.fn(async () => ({ count: 1 })), update: jest.fn() },
  contact: { findUnique: jest.fn() },
  contactEvent: { findFirst: jest.fn(async () => null), findUnique: jest.fn() },
  discountCode: { count: jest.fn(async () => 0), create: jest.fn() },
  emailMessage: { create: jest.fn(), updateMany: jest.fn() },
};

jest.mock("@/lib/db", () => ({ db: mockDb }));
jest.mock("@/lib/email/enroll", () => ({ isFlowEnabled: jest.fn(async () => true) }));
jest.mock("@/lib/email/budget", () => ({ remainingBudget: jest.fn(async () => 50) }));
jest.mock("@/lib/email/send", () => ({
  checkSendable: jest.fn(),
  prepareEmail: jest.fn(),
  deliverOne: jest.fn(),
  deliverBatch: jest.fn(),
}));
jest.mock("@/lib/crm/events", () => ({ recordEvent: jest.fn() }));
jest.mock("@/lib/crm/bonus", () => ({ grantBonusWords: jest.fn() }));
jest.mock("@/lib/growth/flags", () => ({ emailSendingMode: () => "allowlist", trialPassesPerMonth: () => 20 }));

import { processEnrollmentNow } from "@/lib/email/engine";
import { checkSendable, prepareEmail } from "@/lib/email/send";
import { recordEvent } from "@/lib/crm/events";

function enrollmentAtTrialOffer() {
  const anchorAt = new Date(now - 72 * H);
  return {
    id: "enr_1",
    contactId: "c_1",
    sequenceKey: "quota_upgrade",
    cycle: 1,
    status: "active",
    stepIndex: 1,
    anchorAt,
    enrolledAt: anchorAt,
    nextRunAt: new Date(now),
    context: {},
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockDb.sequenceEnrollment.findUnique.mockResolvedValue(enrollmentAtTrialOffer());
  mockDb.contact.findUnique.mockResolvedValue({
    id: "c_1",
    email: "sam@example.com",
    userId: "u_1",
    subscribedTopics: [],
    lifecycleEmails: true,
    magnets: [],
    firstDocumentAt: null,
    lastActiveAt: null,
    user: { plan: "FREE", planExpiresAt: null, createdAt: new Date(now - 10 * 24 * H), subscription: null },
  });
});

it("issues no trial pass when the offer email would be skipped for consent", async () => {
  (checkSendable as jest.Mock).mockResolvedValue({ ok: false, outcome: { status: "skipped", reason: "no_consent" } });
  const stats = await processEnrollmentNow("enr_1");
  expect(mockDb.discountCode.create).not.toHaveBeenCalled();
  expect(recordEvent).not.toHaveBeenCalled();
  expect(prepareEmail).not.toHaveBeenCalled();
  expect(mockDb.emailMessage.create).toHaveBeenCalledWith({ data: expect.objectContaining({ status: "skipped", skipReason: "no_consent", stepKey: "trial_offer" }) });
  expect(stats.skipped).toEqual({ no_consent: 1 });
  expect(stats.advanced).toBe(1);
});

it("holds the step without a pass while the inbox is outside the allowlist", async () => {
  (checkSendable as jest.Mock).mockResolvedValue({ ok: false, outcome: { status: "deferred", reason: "allowlist" } });
  const stats = await processEnrollmentNow("enr_1");
  expect(mockDb.discountCode.create).not.toHaveBeenCalled();
  expect(stats.advanced).toBe(0);
  expect(stats.deferred).toEqual({ allowlist: 1 });
});

it("issues the pass and prepares the email when it can go out", async () => {
  (checkSendable as jest.Mock).mockResolvedValue({ ok: true });
  (prepareEmail as jest.Mock).mockResolvedValue({ ok: false, outcome: { status: "deferred", reason: "budget" } });
  await processEnrollmentNow("enr_1");
  expect(mockDb.discountCode.create).toHaveBeenCalledTimes(1);
  expect(recordEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "trial_code_issued" }));
  expect(prepareEmail).toHaveBeenCalledWith(expect.objectContaining({ template: "trial_offer" }));
});
