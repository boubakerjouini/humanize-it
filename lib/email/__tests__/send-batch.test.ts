// deliverBatch: retried rows never join a batch (a batch's idempotency key
// covers its exact message set, so a retry there could deliver twice), and the
// status writes after a send never overwrite what a webhook already recorded.

const mockDb = {
  emailMessage: { updateMany: jest.fn(async () => ({ count: 1 })) },
  contact: { update: jest.fn(async () => ({})) },
};
const resend = {
  emails: { send: jest.fn() },
  batch: { send: jest.fn() },
};

jest.mock("@/lib/db", () => ({ db: mockDb }));
jest.mock("@/lib/email/resend-client", () => ({
  ...jest.requireActual("@/lib/email/resend-client"),
  getResend: () => resend,
}));

import { deliverBatch, type Prepared } from "@/lib/email/send";

function prepared(id: string, retry: boolean): Prepared {
  return {
    messageId: id,
    contactId: `c_${id}`,
    dedupeKey: `seq:enr_${id}:step`,
    template: "welcome",
    stream: "lifecycle",
    pool: "bulk",
    isTest: false,
    retry,
    idempotencyKey: `seq:enr_${id}:step`,
    payload: { from: "a@b.c", to: `${id}@resend.dev`, subject: "s", html: "<p>x</p>", text: "x", tags: [] },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  resend.emails.send.mockResolvedValue({ data: { id: "re_single" }, error: null });
  resend.batch.send.mockImplementation(async (items: unknown[]) => ({
    data: { data: items.map((_, i) => ({ id: `re_batch_${i}` })) },
    error: null,
  }));
});

it("sends retries alone under their own key and batches only first attempts", async () => {
  const out = await deliverBatch([prepared("m1", false), prepared("m2", true), prepared("m3", false)]);
  expect(resend.emails.send).toHaveBeenCalledTimes(1);
  expect(resend.emails.send.mock.calls[0][1]).toEqual({ idempotencyKey: "seq:enr_m2:step" });
  expect(resend.batch.send).toHaveBeenCalledTimes(1);
  expect(resend.batch.send.mock.calls[0][0]).toHaveLength(2);
  expect(out.map((o) => o.status)).toEqual(["sent", "sent", "sent"]);
  expect(out[1]).toMatchObject({ messageId: "m2", resendId: "re_single" });
});

it("only moves rows that are still sending", async () => {
  await deliverBatch([prepared("m1", true)]);
  expect(mockDb.emailMessage.updateMany).toHaveBeenCalledWith(
    expect.objectContaining({ where: { id: "m1", status: "sending" }, data: expect.objectContaining({ status: "sent" }) })
  );
});

it("keeps a webhook-advanced status when the send result comes back late", async () => {
  mockDb.emailMessage.updateMany.mockResolvedValueOnce({ count: 0 });
  await deliverBatch([prepared("m1", true)]);
  expect(mockDb.emailMessage.updateMany).toHaveBeenLastCalledWith({
    where: { id: "m1", resendId: null },
    data: { resendId: "re_single", subject: "s" },
  });
});

it("marks an ambiguous failure failed only while the row is still sending", async () => {
  resend.emails.send.mockRejectedValueOnce(new Error("socket hang up"));
  const [o] = await deliverBatch([prepared("m1", true)]);
  expect(o).toMatchObject({ status: "failed", retryable: true });
  expect(mockDb.emailMessage.updateMany).toHaveBeenCalledWith(
    expect.objectContaining({ where: { id: "m1", status: "sending" }, data: expect.objectContaining({ status: "failed" }) })
  );
});
