// retryFailedMessages (daily step 7): besides failed one-off sends, it picks up
// the lead emails app/api/public/leads held as "queued" past a daily limit, and
// sends them with the props they were held with, from the bulk pool.

const mockDb = { emailMessage: { findMany: jest.fn() } };

jest.mock("@/lib/db", () => ({ db: mockDb }));
jest.mock("@/lib/email/budget", () => ({ remainingBudget: jest.fn(async () => 50) }));
jest.mock("@/lib/email/campaigns", () => ({}));
jest.mock("@/lib/email/circuit-breaker", () => ({}));
jest.mock("@/lib/email/engine", () => ({}));
jest.mock("@/lib/email/sweeps", () => ({}));
jest.mock("@/lib/crm/recompute", () => ({}));
jest.mock("@/lib/crm/task-rules", () => ({}));
jest.mock("@/lib/growth/locks", () => ({}));
jest.mock("@/lib/growth/flags", () => ({ ...jest.requireActual("@/lib/growth/flags"), emailSendingMode: jest.fn(() => "live") }));
jest.mock("@/lib/email/send", () => ({
  ...jest.requireActual("@/lib/email/send"),
  prepareEmail: jest.fn(),
  deliverBatch: jest.fn(),
}));

import { retryFailedMessages } from "@/lib/growth/daily-job";
import { deliverBatch, prepareEmail } from "@/lib/email/send";
import { emailSendingMode } from "@/lib/growth/flags";

const NOW = new Date(Date.UTC(2026, 9, 9, 8, 0, 0));

const heldMagnet = {
  contactId: "c_1",
  template: "magnet_delivery",
  props: { magnet: "false-ai-flag-appeal-kit", confirmUrl: "https://humanizeit.app/free/x/thanks?t=tok", downloadUrl: "https://humanizeit.app/lead-magnets/x.pdf", consentPending: true },
  dedupeKey: "magnet:c_1:false-ai-flag-appeal-kit:2026-10-08",
  topic: null,
  sequenceKey: null,
  stepKey: null,
  enrollmentId: null,
  campaignId: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  (emailSendingMode as jest.Mock).mockReturnValue("live");
  mockDb.emailMessage.findMany.mockResolvedValue([heldMagnet]);
  (prepareEmail as jest.Mock).mockImplementation(async (input: { dedupeKey: string }) => ({ ok: true, prepared: { messageId: "m_1", dedupeKey: input.dedupeKey } }));
  (deliverBatch as jest.Mock).mockImplementation(async (ps: unknown[]) => ps.map(() => ({ status: "sent" })));
});

it("retries failed rows and held (queued) one-off rows, never campaign or sequence rows", async () => {
  await retryFailedMessages(NOW);
  const { where } = mockDb.emailMessage.findMany.mock.calls[0][0];
  expect(where).toMatchObject({ status: { in: ["failed", "queued"] }, enrollmentId: null, campaignId: null });
  expect(where.attempts).toEqual({ lt: 3 });
  expect(where.queuedAt.gte.getTime()).toBe(NOW.getTime() - 72 * 3_600_000);
});

it("sends a held lead email with its stored props under the same dedupe key, from the bulk pool", async () => {
  const out = await retryFailedMessages(NOW);
  expect(prepareEmail).toHaveBeenCalledWith(
    expect.objectContaining({
      contactId: "c_1",
      template: "magnet_delivery",
      props: heldMagnet.props,
      dedupeKey: heldMagnet.dedupeKey,
      pool: "bulk",
    })
  );
  expect(deliverBatch).toHaveBeenCalledTimes(1);
  expect(out).toEqual({ retried: 1, sent: 1, skipped: 0 });
});

it("does nothing while sending is off", async () => {
  (emailSendingMode as jest.Mock).mockReturnValue("off");
  expect(await retryFailedMessages(NOW)).toEqual({ retried: 0, sent: 0, skipped: 0 });
  expect(mockDb.emailMessage.findMany).not.toHaveBeenCalled();
});
