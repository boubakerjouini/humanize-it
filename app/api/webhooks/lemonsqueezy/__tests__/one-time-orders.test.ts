// One-time orders (Founding 100, Word Pack) through the LemonSqueezy webhook:
// the right grant per variant, nothing for subscription first orders or
// unpaid orders, a retried delivery never grants twice, refunds take the
// grant back, and an ended subscription returns a founding member to Pro.

import crypto from "crypto";

const uniqueViolation = Object.assign(new Error("Unique constraint failed"), { code: "P2002" });

const tx = {
  purchase: { create: jest.fn(), count: jest.fn(), findUnique: jest.fn(), updateMany: jest.fn() },
  user: { findUniqueOrThrow: jest.fn(), update: jest.fn() },
  contact: { findUnique: jest.fn(), updateMany: jest.fn() },
  auditLog: { create: jest.fn() },
};
const mockDb = {
  ...tx,
  $transaction: jest.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
  purchase: { ...tx.purchase, findFirst: jest.fn() },
  user: { findUnique: jest.fn(), findUniqueOrThrow: tx.user.findUniqueOrThrow, update: tx.user.update },
  subscription: { findUnique: jest.fn(), update: jest.fn() },
  contactEvent: { findUnique: jest.fn() },
  auditLog: { create: jest.fn(() => Promise.resolve({})), count: jest.fn() },
};

jest.mock("@/lib/db", () => ({ db: mockDb }));
jest.mock("@/lib/crm/hooks", () => ({ trackBillingEvent: jest.fn() }));
jest.mock("@/lib/crm/events", () => ({ recordEvent: jest.fn(async () => null) }));
jest.mock("@/lib/crm/contacts", () => ({ getOrCreateContactForUser: jest.fn(async () => "contact_1") }));
jest.mock("@/lib/crm/bonus", () => ({
  grantBonusWords: jest.fn(async () => true),
  consumeBonusWords: jest.fn(),
  refundBonusWords: jest.fn(),
  hasBonusWords: jest.fn(),
}));
jest.mock("@/lib/growth/safe", () => ({
  runAfter: (_label: string, fn: () => unknown) => void fn(),
  isUniqueViolation: (err: unknown) => (err as { code?: string })?.code === "P2002",
}));

import { POST } from "@/app/api/webhooks/lemonsqueezy/route";
import { grantBonusWords } from "@/lib/crm/bonus";
import { recordEvent } from "@/lib/crm/events";

const SECRET = "ls-webhook-secret-for-tests";
const savedEnv = { ...process.env };

function order(variantId: number, opts: { status?: string; id?: string } = {}) {
  return {
    meta: { event_name: "order_created", custom_data: { clerk_id: "clerk_1", offer: "x" } },
    data: {
      id: opts.id ?? "order_1",
      type: "orders",
      attributes: { status: opts.status ?? "paid", total: 9900, first_order_item: { variant_id: variantId }, updated_at: "2026-10-07T00:00:00Z" },
    },
  };
}

function deliver(payload: unknown) {
  const body = JSON.stringify(payload);
  const signature = crypto.createHmac("sha256", SECRET).update(body).digest("hex");
  return POST(new Request("http://localhost/api/webhooks/lemonsqueezy", { method: "POST", body, headers: { "x-signature": signature } }));
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env = {
    ...savedEnv,
    LEMONSQUEEZY_WEBHOOK_SECRET: SECRET,
    LEMONSQUEEZY_FOUNDING_VARIANT_ID: "111",
    LEMONSQUEEZY_WORDPACK_VARIANT_ID: "222",
  };
  mockDb.user.findUnique.mockResolvedValue({ id: "user_1" });
  tx.user.findUniqueOrThrow.mockResolvedValue({ plan: "FREE", planExpiresAt: null });
  tx.purchase.count.mockResolvedValue(1);
});

afterAll(() => {
  process.env = savedEnv;
});

describe("order_created: Founding 100", () => {
  it("grants Pro for 730 days, records the purchase, the audit entry and the event", async () => {
    const before = Date.now();
    const res = await deliver(order(111));
    expect(res.status).toBe(200);

    expect(tx.purchase.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: "user_1", kind: "founding", lsOrderId: "order_1", lsVariantId: "111", amountCents: 9900 }),
    });
    const update = tx.user.update.mock.calls[0][0];
    expect(update.data.plan).toBe("PRO");
    const days = (update.data.planExpiresAt.getTime() - before) / 86_400_000;
    expect(days).toBeGreaterThan(729.9);
    expect(days).toBeLessThan(730.1);
    expect(update.data.wordsUsed).toBe(0); // fresh monthly meter coming from Free
    expect(tx.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: "offer.founding_purchased", targetId: "user_1" }) });
    expect(recordEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "founding_purchased", dedupeKey: "founding_purchased:order_1" }));
  });

  it("does nothing on a retried delivery of the same order", async () => {
    tx.purchase.create.mockRejectedValueOnce(uniqueViolation);
    const res = await deliver(order(111));
    expect(res.status).toBe(200);
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(recordEvent).not.toHaveBeenCalled();
  });

  it("ignores unpaid orders", async () => {
    await deliver(order(111, { status: "pending" }));
    expect(tx.purchase.create).not.toHaveBeenCalled();
  });
});

describe("order_created: Word Pack", () => {
  it("grants expiring bonus words once, then records the purchase", async () => {
    const res = await deliver(order(222, { id: "order_2" }));
    expect(res.status).toBe(200);
    expect(grantBonusWords).toHaveBeenCalledWith("contact_1", 20_000, "wordpack", "wordpack:order_2", expect.objectContaining({ expiresAt: expect.any(Date) }));
    const expiresAt = (grantBonusWords as jest.Mock).mock.calls[0][4].expiresAt as Date;
    expect(Math.round((expiresAt.getTime() - Date.now()) / 86_400_000)).toBe(60);
    expect(tx.purchase.create).toHaveBeenCalledWith({ data: expect.objectContaining({ kind: "wordpack", lsOrderId: "order_2", words: 20_000 }) });
    expect(recordEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "wordpack_purchased" }));
  });

  it("fails the delivery (so LemonSqueezy retries) when the grant failed without a duplicate", async () => {
    (grantBonusWords as jest.Mock).mockResolvedValueOnce(false);
    mockDb.contactEvent.findUnique.mockResolvedValueOnce(null);
    const res = await deliver(order(222, { id: "order_3" }));
    expect(res.status).toBe(500);
    expect(tx.purchase.create).not.toHaveBeenCalled();
  });

  it("treats an already-granted pack as done on retry", async () => {
    (grantBonusWords as jest.Mock).mockResolvedValueOnce(false);
    mockDb.contactEvent.findUnique.mockResolvedValueOnce({ id: "evt_1" });
    tx.purchase.create.mockRejectedValueOnce(uniqueViolation);
    const res = await deliver(order(222, { id: "order_2" }));
    expect(res.status).toBe(200);
    expect(recordEvent).not.toHaveBeenCalled();
  });
});

describe("order_created: other orders", () => {
  it("leaves a subscription's first order to subscription_created", async () => {
    const res = await deliver(order(1368282));
    expect(res.status).toBe(200);
    expect(tx.purchase.create).not.toHaveBeenCalled();
    expect(grantBonusWords).not.toHaveBeenCalled();
  });
});

describe("order_created: Founding 100 on a lifetime account", () => {
  it("keeps Pro with no end date instead of turning it into two years", async () => {
    tx.user.findUniqueOrThrow.mockResolvedValue({ plan: "PRO", planExpiresAt: null });
    await deliver(order(111, { id: "order_9" }));
    expect(tx.user.update.mock.calls[0][0].data).toMatchObject({ plan: "PRO", planExpiresAt: null });
  });
});

function refund(variantId: number, opts: { status?: string; id?: string } = {}) {
  const p = order(variantId, { id: opts.id, status: opts.status ?? "refunded" });
  return { ...p, meta: { ...p.meta, event_name: "order_refunded" } };
}

describe("order_refunded", () => {
  const DAY = 86_400_000;

  it("takes a Founding 100 buyer back to Free and frees the seat", async () => {
    tx.purchase.findUnique.mockResolvedValue({ userId: "user_1" });
    tx.purchase.updateMany.mockResolvedValue({ count: 1 });
    tx.user.findUniqueOrThrow.mockResolvedValue({ plan: "PRO", planExpiresAt: new Date(Date.now() + 720 * DAY), subscription: null });
    const res = await deliver(refund(111));
    expect(res.status).toBe(200);
    expect(tx.purchase.updateMany).toHaveBeenCalledWith({ where: { lsOrderId: "order_1", kind: "founding" }, data: { kind: "founding_refunded" } });
    expect(tx.user.update).toHaveBeenCalledWith({ where: { id: "user_1" }, data: { plan: "FREE", planExpiresAt: null } });
    expect(tx.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: "offer.founding_refunded" }) });
  });

  it("keeps what is left of an earlier grant", async () => {
    tx.purchase.findUnique.mockResolvedValue({ userId: "user_1" });
    tx.purchase.updateMany.mockResolvedValue({ count: 1 });
    tx.user.findUniqueOrThrow.mockResolvedValue({ plan: "PRO", planExpiresAt: new Date(Date.now() + 760 * DAY), subscription: null });
    await deliver(refund(111));
    const days = (tx.user.update.mock.calls[0][0].data.planExpiresAt.getTime() - Date.now()) / DAY;
    expect(Math.round(days)).toBe(30);
  });

  it("is a no-op on a retried delivery", async () => {
    tx.purchase.findUnique.mockResolvedValue({ userId: "user_1" });
    tx.purchase.updateMany.mockResolvedValue({ count: 0 });
    await deliver(refund(111));
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it("takes back up to the pack's words from the bonus pool", async () => {
    tx.purchase.findUnique.mockResolvedValue({ userId: "user_1", words: 20_000 });
    tx.purchase.updateMany.mockResolvedValue({ count: 1 });
    tx.contact.findUnique.mockResolvedValue({ id: "contact_1", bonusWords: 12_000 });
    tx.contact.updateMany.mockResolvedValue({ count: 1 });
    await deliver(refund(222, { id: "order_2" }));
    expect(tx.contact.updateMany).toHaveBeenCalledWith({ where: { id: "contact_1", bonusWords: 12_000 }, data: { bonusWords: 0 } });
    expect(tx.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: "offer.wordpack_refunded" }) });
  });

  it("leaves a partial refund to the founder", async () => {
    await deliver(refund(111, { status: "partial_refund" }));
    expect(tx.purchase.updateMany).not.toHaveBeenCalled();
  });
});

describe("subscription_cancelled for a founding member", () => {
  function cancelled() {
    return {
      meta: { event_name: "subscription_cancelled", custom_data: {} },
      data: { id: "sub_1", type: "subscriptions", attributes: { customer_id: 1, variant_id: 333, status: "cancelled", renews_at: null, ends_at: null, urls: {} } },
    };
  }

  beforeEach(() => {
    mockDb.subscription.findUnique.mockResolvedValue({ userId: "user_1", lsVariantId: "333" });
  });

  it("goes back to Pro until the founding purchase ends", async () => {
    const bought = new Date(Date.now() - 100 * 86_400_000);
    mockDb.purchase.findFirst.mockResolvedValue({ createdAt: bought });
    await deliver(cancelled());
    const data = tx.user.update.mock.calls[0][0].data;
    expect(data.plan).toBe("PRO");
    expect(data.planExpiresAt.getTime()).toBe(bought.getTime() + 730 * 86_400_000);
  });

  it("goes to Free without one", async () => {
    mockDb.purchase.findFirst.mockResolvedValue(null);
    await deliver(cancelled());
    expect(tx.user.update.mock.calls[0][0].data).toEqual({ plan: "FREE" });
  });
});
