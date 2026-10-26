// The Polar webhook: signatures are checked (Standard Webhooks, through the
// SDK), a handled delivery is never applied twice, a payment is only credited
// to the account our checkout put in its metadata, one-time orders grant the
// right offer once (even after the offer is switched off) and refunds take it
// back, renewals reset the meter, and subscription events keep the plan in
// step with Polar's state: paused or ended takes it away, a founding member
// goes back to Pro, an org seat keeps Team, and a failed attempt is retried
// in full.

import crypto from "crypto";

const uniqueViolation = Object.assign(new Error("Unique constraint failed"), { code: "P2002" });

const tx = {
  purchase: { create: jest.fn(), count: jest.fn(), findUnique: jest.fn(), updateMany: jest.fn() },
  user: { findUniqueOrThrow: jest.fn(), update: jest.fn() },
  subscription: { upsert: jest.fn() },
  contact: { findUnique: jest.fn(), updateMany: jest.fn() },
  auditLog: { create: jest.fn() },
};
const mockDb = {
  ...tx,
  $transaction: jest.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
  purchase: { ...tx.purchase, findFirst: jest.fn() },
  user: { findUnique: jest.fn(), findUniqueOrThrow: tx.user.findUniqueOrThrow, update: tx.user.update, updateMany: jest.fn() },
  subscription: { findUnique: jest.fn(), upsert: tx.subscription.upsert },
  membership: { findFirst: jest.fn() },
  contactEvent: { findUnique: jest.fn() },
  auditLog: { create: jest.fn(() => Promise.resolve({})), count: jest.fn() },
  webhookEvent: { findUnique: jest.fn(), create: jest.fn(() => Promise.resolve({})) },
};

jest.mock("@/lib/db", () => ({ db: mockDb }));
jest.mock("@/lib/polar", () => ({ getPolar: jest.fn(() => null) }));
jest.mock("@/lib/plans", () => {
  // lib/plans reads the plan product ids when it is first imported.
  process.env.POLAR_PRO_PRODUCT_ID = "prod_pro";
  process.env.POLAR_TEAM_PRODUCT_ID = "prod_team";
  process.env.POLAR_TEAM_ANNUAL_PRODUCT_ID = "prod_team_annual";
  return jest.requireActual("@/lib/plans");
});
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

import { POST } from "@/app/api/webhooks/polar/route";
import { getPolar } from "@/lib/polar";
import { grantBonusWords } from "@/lib/crm/bonus";
import { recordEvent } from "@/lib/crm/events";
import { trackBillingEvent } from "@/lib/crm/hooks";

const SECRET = "whsec_polar-webhook-secret-for-tests";
const DAY = 86_400_000;
const savedEnv = { ...process.env };
let deliveries = 0;

function sign(id: string, timestamp: number, body: string, secret = SECRET) {
  return crypto.createHmac("sha256", Buffer.from(secret, "utf8")).update(`${id}.${timestamp}.${body}`).digest("base64");
}

function deliver(payload: unknown, opts: { id?: string; secret?: string } = {}) {
  const body = JSON.stringify(payload);
  const id = opts.id ?? `msg_${++deliveries}`;
  const timestamp = Math.floor(Date.now() / 1000);
  return POST(
    new Request("http://localhost/api/webhooks/polar", {
      method: "POST",
      body,
      headers: {
        "webhook-id": id,
        "webhook-timestamp": String(timestamp),
        "webhook-signature": `v1,${sign(id, timestamp, body, opts.secret)}`,
      },
    })
  );
}

type Owner = { externalId?: string | null; metadata?: Record<string, string> };

function order(
  type: "order.paid" | "order.refunded",
  productId: string,
  opts: { id?: string; status?: string; billingReason?: string; subscriptionId?: string | null } & Owner = {}
) {
  return {
    type,
    timestamp: new Date().toISOString(),
    data: {
      id: opts.id ?? "order_1",
      status: opts.status ?? (type === "order.paid" ? "paid" : "refunded"),
      billing_reason: opts.billingReason ?? "purchase",
      product_id: productId,
      subscription_id: opts.subscriptionId ?? null,
      net_amount: 9900,
      total_amount: 9900,
      customer: { id: "cus_1", external_id: opts.externalId === undefined ? "user_1" : opts.externalId },
      metadata: opts.metadata ?? { user_id: "user_1" },
    },
  };
}

function subscription(
  type: string,
  opts: { id?: string; status?: string; cancelAtPeriodEnd?: boolean; productId?: string; modifiedAt?: string } & Owner = {}
) {
  return {
    type,
    timestamp: new Date().toISOString(),
    data: {
      id: opts.id ?? "sub_1",
      status: opts.status ?? "active",
      cancel_at_period_end: opts.cancelAtPeriodEnd ?? false,
      customer_id: "cus_1",
      product_id: opts.productId ?? "prod_team",
      current_period_end: "2026-11-25T00:00:00Z",
      modified_at: opts.modifiedAt ?? "2026-10-25T10:00:00Z",
      customer: { id: "cus_1", external_id: opts.externalId === undefined ? "user_1" : opts.externalId },
      metadata: opts.metadata ?? { user_id: "user_1" },
    },
  };
}

/** The local row of the user's subscription, as it was before the delivery. */
function storedRow(status: string, opts: { id?: string; productId?: string } = {}) {
  return { userId: "user_1", polarSubscriptionId: opts.id ?? "sub_1", polarProductId: opts.productId ?? "prod_team", status };
}

const tracked = () => (trackBillingEvent as jest.Mock).mock.calls.map((c) => c[1]);
const dedupeKeys = () => (trackBillingEvent as jest.Mock).mock.calls.map((c) => c[3]);
const flagged = () =>
  (mockDb.auditLog.create.mock.calls as unknown as [{ data: { action: string } }][]).filter((c) => c[0].data.action === "polar.needs_attention");

beforeEach(() => {
  jest.clearAllMocks();
  process.env = {
    ...savedEnv,
    POLAR_WEBHOOK_SECRET: SECRET,
    POLAR_FOUNDING_PRODUCT_ID: "prod_founding",
    POLAR_WORDPACK_PRODUCT_ID: "prod_wordpack",
  };
  (getPolar as jest.Mock).mockReturnValue(null);
  mockDb.webhookEvent.findUnique.mockResolvedValue(null);
  mockDb.user.findUnique.mockResolvedValue({ id: "user_1" });
  mockDb.user.updateMany.mockResolvedValue({ count: 1 });
  mockDb.subscription.findUnique.mockResolvedValue(null);
  mockDb.membership.findFirst.mockResolvedValue(null);
  tx.purchase.findUnique.mockResolvedValue(null);
  tx.user.findUniqueOrThrow.mockResolvedValue({ plan: "FREE", planExpiresAt: null });
  tx.purchase.count.mockResolvedValue(1);
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

afterAll(() => {
  process.env = savedEnv;
});

describe("delivery checks", () => {
  it("refuses a delivery signed with another secret", async () => {
    const res = await deliver(order("order.paid", "prod_founding"), { secret: "whsec_someone-else" });
    expect(res.status).toBe(403);
    expect(tx.purchase.create).not.toHaveBeenCalled();
  });

  it("acknowledges a signed event type it doesn't know, so Polar stops retrying", async () => {
    const res = await deliver({ type: "something.new", timestamp: new Date().toISOString(), data: {} });
    expect(res.status).toBe(202);
  });

  it("records a handled delivery and skips it when Polar sends it again", async () => {
    await deliver(order("order.paid", "prod_founding"), { id: "msg_fixed" });
    expect(mockDb.webhookEvent.create).toHaveBeenCalledWith({ data: { eventId: "polar:msg_fixed", source: "polar" } });

    jest.clearAllMocks();
    mockDb.webhookEvent.findUnique.mockResolvedValue({ id: "row_1" });
    const res = await deliver(order("order.paid", "prod_founding"), { id: "msg_fixed" });
    expect(res.status).toBe(200);
    expect(tx.purchase.create).not.toHaveBeenCalled();
  });

  it("leaves a failed delivery unrecorded so the retry runs it", async () => {
    (grantBonusWords as jest.Mock).mockResolvedValueOnce(false);
    mockDb.contactEvent.findUnique.mockResolvedValueOnce(null);
    const res = await deliver(order("order.paid", "prod_wordpack", { id: "order_3" }));
    expect(res.status).toBe(500);
    expect(mockDb.webhookEvent.create).not.toHaveBeenCalled();
  });
});

describe("whose payment it is", () => {
  it("credits nobody when the subscription sits on another account's Polar customer", async () => {
    // Polar matched the buyer (user_1, in our metadata) to user_2's customer by email.
    const res = await deliver(subscription("subscription.active", { externalId: "user_2" }));
    expect(res.status).toBe(200);
    expect(mockDb.subscription.upsert).not.toHaveBeenCalled();
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(flagged()).toHaveLength(1);
    // Unrecorded, so a redelivery can apply it once the account is sorted out.
    expect(mockDb.webhookEvent.create).not.toHaveBeenCalled();
  });

  it("credits nobody for a one-time order on another account's Polar customer", async () => {
    await deliver(order("order.paid", "prod_founding", { externalId: "user_2" }));
    expect(tx.purchase.create).not.toHaveBeenCalled();
    expect(flagged()).toHaveLength(1);
    expect(mockDb.webhookEvent.create).not.toHaveBeenCalled();
  });

  it("flags a paying subscription whose user no longer exists", async () => {
    mockDb.user.findUnique.mockResolvedValue(null);
    const res = await deliver(subscription("subscription.active"));
    expect(res.status).toBe(200);
    expect(mockDb.subscription.upsert).not.toHaveBeenCalled();
    expect(flagged()).toHaveLength(1);
    expect(mockDb.webhookEvent.create).not.toHaveBeenCalled();
  });

  it("lets a deleted account's subscription end quietly", async () => {
    mockDb.user.findUnique.mockResolvedValue(null);
    await deliver(subscription("subscription.revoked", { status: "canceled" }));
    expect(flagged()).toHaveLength(0);
    expect(mockDb.webhookEvent.create).toHaveBeenCalled();
  });

  it("flags a renewal payment for a user who no longer exists", async () => {
    mockDb.user.findUnique.mockResolvedValue(null);
    await deliver(order("order.paid", "prod_team", { billingReason: "subscription_cycle", subscriptionId: "sub_1" }));
    expect(mockDb.user.updateMany).not.toHaveBeenCalled();
    expect(flagged()).toHaveLength(1);
  });

  it("finds the buyer from the metadata when the customer has no external id", async () => {
    await deliver(order("order.paid", "prod_founding", { externalId: null }));
    expect(tx.purchase.create).toHaveBeenCalledWith({ data: expect.objectContaining({ userId: "user_1" }) });
  });
});

describe("order.paid: Founding 100", () => {
  it("grants Pro for 730 days, records the purchase, the audit entry and the event", async () => {
    const before = Date.now();
    const res = await deliver(order("order.paid", "prod_founding"));
    expect(res.status).toBe(200);

    expect(tx.purchase.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: "user_1", kind: "founding", polarOrderId: "order_1", polarProductId: "prod_founding", amountCents: 9900 }),
    });
    const update = tx.user.update.mock.calls[0][0];
    expect(update.data.plan).toBe("PRO");
    const days = (update.data.planExpiresAt.getTime() - before) / DAY;
    expect(days).toBeGreaterThan(729.9);
    expect(days).toBeLessThan(730.1);
    expect(update.data.wordsUsed).toBe(0); // fresh monthly meter coming from Free
    expect(tx.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: "offer.founding_purchased", targetId: "user_1" }) });
    expect(recordEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "founding_purchased", dedupeKey: "founding_purchased:order_1" }));
  });

  it("does nothing on a second delivery of the same order", async () => {
    tx.purchase.create.mockRejectedValueOnce(uniqueViolation);
    const res = await deliver(order("order.paid", "prod_founding"));
    expect(res.status).toBe(200);
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(recordEvent).not.toHaveBeenCalled();
  });

  it("keeps Pro with no end date on a lifetime account instead of turning it into two years", async () => {
    tx.user.findUniqueOrThrow.mockResolvedValue({ plan: "PRO", planExpiresAt: null });
    await deliver(order("order.paid", "prod_founding", { id: "order_9" }));
    expect(tx.user.update.mock.calls[0][0].data).toMatchObject({ plan: "PRO", planExpiresAt: null });
  });

  it("keeps a Team subscriber on Team instead of turning them into Pro with an end date", async () => {
    tx.user.findUniqueOrThrow.mockResolvedValue({ plan: "TEAM", planExpiresAt: null });
    await deliver(order("order.paid", "prod_founding", { id: "order_10" }));
    expect(tx.user.update.mock.calls[0][0].data).toMatchObject({ plan: "TEAM", planExpiresAt: null });
  });

  it("still grants an order paid after the offer was switched off, from its metadata", async () => {
    delete process.env.POLAR_FOUNDING_PRODUCT_ID;
    await deliver(order("order.paid", "prod_founding", { metadata: { user_id: "user_1", offer: "founding" } }));
    expect(tx.purchase.create).toHaveBeenCalledWith({ data: expect.objectContaining({ kind: "founding", polarOrderId: "order_1" }) });
  });

  it("grants nothing for an order that was refunded before its payment was applied", async () => {
    tx.purchase.findUnique.mockResolvedValue({ id: "purchase_1" });
    await deliver(order("order.paid", "prod_founding"));
    expect(tx.purchase.create).not.toHaveBeenCalled();
    expect(tx.user.update).not.toHaveBeenCalled();
  });
});

describe("order.paid: Word Pack", () => {
  it("grants expiring bonus words once, then records the purchase", async () => {
    const res = await deliver(order("order.paid", "prod_wordpack", { id: "order_2" }));
    expect(res.status).toBe(200);
    expect(grantBonusWords).toHaveBeenCalledWith("contact_1", 20_000, "wordpack", "wordpack:order_2", expect.objectContaining({ expiresAt: expect.any(Date) }));
    const expiresAt = (grantBonusWords as jest.Mock).mock.calls[0][4].expiresAt as Date;
    expect(Math.round((expiresAt.getTime() - Date.now()) / DAY)).toBe(60);
    expect(tx.purchase.create).toHaveBeenCalledWith({ data: expect.objectContaining({ kind: "wordpack", polarOrderId: "order_2", words: 20_000 }) });
    expect(recordEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "wordpack_purchased" }));
  });

  it("treats an already-granted pack as done on retry", async () => {
    (grantBonusWords as jest.Mock).mockResolvedValueOnce(false);
    mockDb.contactEvent.findUnique.mockResolvedValueOnce({ id: "evt_1" });
    tx.purchase.create.mockRejectedValueOnce(uniqueViolation);
    const res = await deliver(order("order.paid", "prod_wordpack", { id: "order_2" }));
    expect(res.status).toBe(200);
    expect(recordEvent).not.toHaveBeenCalled();
  });

  it("still fulfils a pack sold before the offer was switched off", async () => {
    delete process.env.POLAR_WORDPACK_PRODUCT_ID;
    await deliver(order("order.paid", "prod_wordpack", { id: "order_4", metadata: { user_id: "user_1", offer: "wordpack" } }));
    expect(grantBonusWords).toHaveBeenCalledWith("contact_1", 20_000, "wordpack", "wordpack:order_4", expect.anything());
  });
});

describe("order.paid: subscription invoices", () => {
  it.each(["subscription_create", "subscription_cycle"])("resets the usage meter on a %s order", async (billingReason) => {
    mockDb.subscription.findUnique.mockResolvedValue({ userId: "user_1" });
    await deliver(order("order.paid", "prod_team", { billingReason, subscriptionId: "sub_1" }));
    expect(mockDb.user.updateMany).toHaveBeenCalledWith({
      where: { id: "user_1" },
      data: { wordsUsed: 0, rewriteCount: 0, quotaResetAt: expect.any(Date) },
    });
    expect(tx.purchase.create).not.toHaveBeenCalled();
  });

  it("leaves a plan-change proration alone", async () => {
    await deliver(order("order.paid", "prod_team", { billingReason: "subscription_update", subscriptionId: "sub_1" }));
    expect(mockDb.user.updateMany).not.toHaveBeenCalled();
    expect(tx.purchase.create).not.toHaveBeenCalled();
  });

  it("grants nothing for a one-time product that is no offer, and flags the payment", async () => {
    await deliver(order("order.paid", "prod_unknown"));
    expect(tx.purchase.create).not.toHaveBeenCalled();
    expect(grantBonusWords).not.toHaveBeenCalled();
    expect(flagged()).toHaveLength(1);
  });
});

describe("order.refunded", () => {
  it("takes a Founding 100 buyer back to Free and frees the seat", async () => {
    tx.purchase.findUnique.mockResolvedValue({ userId: "user_1", kind: "founding" });
    tx.purchase.updateMany.mockResolvedValue({ count: 1 });
    tx.user.findUniqueOrThrow.mockResolvedValue({ plan: "PRO", planExpiresAt: new Date(Date.now() + 720 * DAY), subscription: null });
    const res = await deliver(order("order.refunded", "prod_founding"));
    expect(res.status).toBe(200);
    expect(tx.purchase.updateMany).toHaveBeenCalledWith({ where: { polarOrderId: "order_1", kind: "founding" }, data: { kind: "founding_refunded" } });
    expect(tx.user.update).toHaveBeenCalledWith({ where: { id: "user_1" }, data: { plan: "FREE", planExpiresAt: null } });
    expect(tx.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: "offer.founding_refunded" }) });
  });

  it("keeps what is left of an earlier grant", async () => {
    tx.purchase.findUnique.mockResolvedValue({ userId: "user_1", kind: "founding" });
    tx.purchase.updateMany.mockResolvedValue({ count: 1 });
    tx.user.findUniqueOrThrow.mockResolvedValue({ plan: "PRO", planExpiresAt: new Date(Date.now() + 760 * DAY), subscription: null });
    await deliver(order("order.refunded", "prod_founding"));
    const days = (tx.user.update.mock.calls[0][0].data.planExpiresAt.getTime() - Date.now()) / DAY;
    expect(Math.round(days)).toBe(30);
  });

  it("is a no-op when the refund was already applied", async () => {
    tx.purchase.findUnique.mockResolvedValue({ userId: "user_1", kind: "founding_refunded" });
    await deliver(order("order.refunded", "prod_founding"));
    expect(tx.purchase.updateMany).not.toHaveBeenCalled();
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it("takes back up to the pack's words from the bonus pool", async () => {
    tx.purchase.findUnique.mockResolvedValue({ userId: "user_1", kind: "wordpack", words: 20_000 });
    tx.purchase.updateMany.mockResolvedValue({ count: 1 });
    tx.contact.findUnique.mockResolvedValue({ id: "contact_1", bonusWords: 12_000 });
    tx.contact.updateMany.mockResolvedValue({ count: 1 });
    await deliver(order("order.refunded", "prod_wordpack", { id: "order_2" }));
    expect(tx.contact.updateMany).toHaveBeenCalledWith({ where: { id: "contact_1", bonusWords: 12_000 }, data: { bonusWords: 0 } });
    expect(tx.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: "offer.wordpack_refunded" }) });
  });

  it("refunds a pack sold before the offer was switched off, from what was sold", async () => {
    delete process.env.POLAR_WORDPACK_PRODUCT_ID;
    tx.purchase.findUnique.mockResolvedValue({ userId: "user_1", kind: "wordpack", words: 20_000 });
    tx.purchase.updateMany.mockResolvedValue({ count: 1 });
    tx.contact.findUnique.mockResolvedValue({ id: "contact_1", bonusWords: 20_000 });
    tx.contact.updateMany.mockResolvedValue({ count: 1 });
    await deliver(order("order.refunded", "prod_wordpack", { id: "order_2" }));
    expect(tx.purchase.updateMany).toHaveBeenCalledWith({ where: { polarOrderId: "order_2", kind: "wordpack" }, data: { kind: "wordpack_refunded" } });
    expect(tx.contact.updateMany).toHaveBeenCalled();
  });

  it("marks an order refunded before its payment was applied, so the retried payment grants nothing", async () => {
    await deliver(order("order.refunded", "prod_wordpack", { id: "order_5" }));
    expect(tx.purchase.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: "user_1", kind: "wordpack_refunded", polarOrderId: "order_5" }),
    });
  });

  it("leaves a partial refund to the founder", async () => {
    await deliver(order("order.refunded", "prod_founding", { status: "partially_refunded" }));
    expect(tx.purchase.updateMany).not.toHaveBeenCalled();
    expect(tx.purchase.create).not.toHaveBeenCalled();
  });
});

describe("subscriptions", () => {
  it("provisions a new subscription: stores it, sets the plan and records the start", async () => {
    const res = await deliver(subscription("subscription.active"));
    expect(res.status).toBe(200);
    expect(mockDb.subscription.upsert).toHaveBeenCalledWith({
      where: { userId: "user_1" },
      create: expect.objectContaining({ userId: "user_1", polarCustomerId: "cus_1", polarSubscriptionId: "sub_1", polarProductId: "prod_team", status: "active" }),
      update: expect.objectContaining({ polarSubscriptionId: "sub_1", status: "active" }),
    });
    expect(tx.user.update).toHaveBeenCalledWith({ where: { id: "user_1" }, data: { plan: "TEAM", planExpiresAt: null } });
    expect(tracked()).toEqual(["subscription_started"]);
    expect(dedupeKeys()).toEqual(["polar:sub_1:started"]);
  });

  it("records the start once, whichever delivery shows it first", async () => {
    // subscription.updated already stored the active state; subscription.active follows.
    mockDb.subscription.findUnique.mockResolvedValue(storedRow("active"));
    await deliver(subscription("subscription.active"));
    expect(tracked()).toEqual([]);
  });

  it("starts a subscription that was incomplete when first seen", async () => {
    mockDb.subscription.findUnique.mockResolvedValue(storedRow("incomplete"));
    await deliver(subscription("subscription.active"));
    expect(tracked()).toEqual(["subscription_started"]);
  });

  it("gives the twin deliveries of one change the same dedupe key", async () => {
    mockDb.subscription.findUnique.mockResolvedValue(storedRow("active"));
    await deliver(subscription("subscription.canceled", { cancelAtPeriodEnd: true }));
    await deliver(subscription("subscription.updated", { cancelAtPeriodEnd: true }));
    expect(tracked()).toEqual(["subscription_cancelled", "subscription_cancelled"]);
    expect(new Set(dedupeKeys())).toEqual(new Set(["polar:sub_1:subscription_cancelled:2026-10-25T10:00:00Z"]));
  });

  it("leaves a comped plan alone when an abandoned checkout's subscription expires", async () => {
    mockDb.subscription.findUnique.mockResolvedValue(storedRow("incomplete"));
    await deliver(subscription("subscription.updated", { status: "incomplete_expired" }));
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tracked()).toEqual([]);
  });

  it("records a recovered payment, not a new start", async () => {
    mockDb.subscription.findUnique.mockResolvedValue(storedRow("past_due"));
    await deliver(subscription("subscription.active"));
    expect(tracked()).toEqual(["payment_recovered"]);
  });

  it("keeps the plan through a cancellation at period end", async () => {
    mockDb.subscription.findUnique.mockResolvedValue(storedRow("active"));
    await deliver(subscription("subscription.canceled", { cancelAtPeriodEnd: true }));
    expect(mockDb.subscription.upsert.mock.calls[0][0].update.status).toBe("cancelled");
    expect(tx.user.update).toHaveBeenCalledWith({ where: { id: "user_1" }, data: { plan: "TEAM", planExpiresAt: null } });
    expect(tracked()).toEqual(["subscription_cancelled"]);
  });

  it("records a plan switch when the product changes", async () => {
    mockDb.subscription.findUnique.mockResolvedValue(storedRow("active", { productId: "prod_pro" }));
    await deliver(subscription("subscription.updated", { productId: "prod_team_annual" }));
    expect(tx.user.update).toHaveBeenCalledWith({ where: { id: "user_1" }, data: { plan: "TEAM", planExpiresAt: null } });
    expect(tracked()).toEqual(["subscription_plan_changed"]);
    expect((trackBillingEvent as jest.Mock).mock.calls[0][2]).toMatchObject({ previousProductId: "prod_pro", productId: "prod_team_annual" });
  });

  it("marks a failed renewal past_due and keeps the plan", async () => {
    mockDb.subscription.findUnique.mockResolvedValue(storedRow("active"));
    await deliver(subscription("subscription.past_due", { status: "past_due" }));
    expect(mockDb.subscription.upsert.mock.calls[0][0].update.status).toBe("past_due");
    expect(tx.user.update.mock.calls[0][0].data.plan).toBe("TEAM");
    expect(tracked()).toEqual(["payment_failed"]);
  });

  it("takes the plan away while paused and gives it back on resume", async () => {
    mockDb.subscription.findUnique.mockResolvedValue(storedRow("active"));
    await deliver(subscription("subscription.paused", { status: "paused" }));
    expect(tx.user.update).toHaveBeenCalledWith({ where: { id: "user_1" }, data: { plan: "FREE", planExpiresAt: null } });
    expect(tracked()).toEqual(["subscription_paused"]);

    jest.clearAllMocks();
    mockDb.subscription.findUnique.mockResolvedValue(storedRow("paused"));
    await deliver(subscription("subscription.resumed", { modifiedAt: "2026-10-26T10:00:00Z" }));
    expect(tx.user.update).toHaveBeenCalledWith({ where: { id: "user_1" }, data: { plan: "TEAM", planExpiresAt: null } });
    expect(tracked()).toEqual(["subscription_resumed"]);
  });

  it("takes nothing more on later deliveries for a paused subscription, so a grant made during the pause stays", async () => {
    mockDb.subscription.findUnique.mockResolvedValue(storedRow("paused"));
    await deliver(subscription("subscription.updated", { status: "paused", modifiedAt: "2026-10-27T10:00:00Z" }));
    await deliver(subscription("subscription.revoked", { status: "canceled", modifiedAt: "2026-10-28T10:00:00Z" }));
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(mockDb.subscription.upsert.mock.calls[1][0].update.status).toBe("expired");
  });

  it("records the start of a subscription first seen already cancelled at period end", async () => {
    await deliver(subscription("subscription.active", { cancelAtPeriodEnd: true }));
    expect(tx.user.update).toHaveBeenCalledWith({ where: { id: "user_1" }, data: { plan: "TEAM", planExpiresAt: null } });
    expect(tracked()).toEqual(["subscription_started", "subscription_cancelled"]);
  });

  it("ends a subscription Polar gave up collecting (unpaid)", async () => {
    mockDb.subscription.findUnique.mockResolvedValue(storedRow("past_due"));
    await deliver(subscription("subscription.revoked", { status: "unpaid" }));
    expect(mockDb.subscription.upsert.mock.calls[0][0].update.status).toBe("expired");
    expect(tx.user.update).toHaveBeenCalledWith({ where: { id: "user_1" }, data: { plan: "FREE", planExpiresAt: null } });
    expect(tracked()).toEqual(["subscription_expired"]);
  });

  it("keeps the Team an org seat gives, while subscribed and after", async () => {
    mockDb.membership.findFirst.mockResolvedValue({ id: "membership_1" });
    await deliver(subscription("subscription.active", { productId: "prod_pro" }));
    expect(tx.user.update).toHaveBeenCalledWith({ where: { id: "user_1" }, data: { plan: "TEAM", planExpiresAt: null } });

    jest.clearAllMocks();
    mockDb.subscription.findUnique.mockResolvedValue(storedRow("cancelled", { productId: "prod_pro" }));
    await deliver(subscription("subscription.revoked", { status: "canceled", productId: "prod_pro" }));
    expect(tx.user.update).toHaveBeenCalledWith({ where: { id: "user_1" }, data: { plan: "TEAM", planExpiresAt: null } });
  });

  it("grants nothing for a product that matches no plan, and flags it", async () => {
    await deliver(subscription("subscription.active", { productId: "prod_other" }));
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(flagged()).toHaveLength(1);
  });

  it("takes the plan away when a subscriber switches to a product that matches no plan", async () => {
    mockDb.subscription.findUnique.mockResolvedValue(storedRow("active"));
    await deliver(subscription("subscription.updated", { productId: "prod_other" }));
    expect(tx.user.update).toHaveBeenCalledWith({ where: { id: "user_1" }, data: { plan: "FREE", planExpiresAt: null } });
    expect(flagged()).toHaveLength(1);
  });

  it("writes the row and the plan together, so a failed attempt is retried in full", async () => {
    mockDb.subscription.findUnique.mockResolvedValue(storedRow("cancelled"));
    let inTransaction = false;
    const seen: boolean[] = [];
    mockDb.$transaction.mockImplementationOnce(async (fn: (t: typeof tx) => unknown) => {
      inTransaction = true;
      try {
        return await fn(tx);
      } finally {
        inTransaction = false;
      }
    });
    tx.subscription.upsert.mockImplementationOnce(async () => void seen.push(inTransaction));
    tx.user.update.mockImplementationOnce(async () => {
      seen.push(inTransaction);
      throw new Error("connection reset");
    });

    const res = await deliver(subscription("subscription.revoked", { status: "canceled" }));
    expect(res.status).toBe(500);
    expect(seen).toEqual([true, true]);
    expect(mockDb.webhookEvent.create).not.toHaveBeenCalled();
  });

  describe("when access ends", () => {
    beforeEach(() => {
      mockDb.subscription.findUnique.mockResolvedValue(storedRow("cancelled"));
    });

    it("goes back to Pro until a founding purchase ends", async () => {
      const bought = new Date(Date.now() - 100 * DAY);
      mockDb.purchase.findFirst.mockResolvedValue({ createdAt: bought });
      await deliver(subscription("subscription.revoked", { status: "canceled" }));
      const data = tx.user.update.mock.calls[0][0].data;
      expect(data.plan).toBe("PRO");
      expect(data.planExpiresAt.getTime()).toBe(bought.getTime() + 730 * DAY);
      expect(mockDb.subscription.upsert.mock.calls[0][0].update.status).toBe("expired");
      expect(tracked()).toEqual(["subscription_expired"]);
    });

    it("goes to Free without one", async () => {
      mockDb.purchase.findFirst.mockResolvedValue(null);
      await deliver(subscription("subscription.revoked", { status: "canceled" }));
      expect(tx.user.update.mock.calls[0][0].data).toEqual({ plan: "FREE", planExpiresAt: null });
    });
  });

  it("ignores a late 'active' state of a subscription that already ended", async () => {
    mockDb.subscription.findUnique.mockResolvedValue(storedRow("expired"));
    await deliver(subscription("subscription.updated"));
    expect(mockDb.subscription.upsert).not.toHaveBeenCalled();
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it("never lets an older subscription's end touch the current one", async () => {
    // The user's row tracks sub_2; sub_1 is an older subscription ending late.
    mockDb.subscription.findUnique.mockImplementation(async ({ where }: { where: Record<string, string> }) =>
      where.userId ? storedRow("active", { id: "sub_2", productId: "prod_pro" }) : null
    );
    await deliver(subscription("subscription.revoked", { id: "sub_1", status: "canceled" }));
    expect(mockDb.subscription.upsert).not.toHaveBeenCalled();
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  describe("state read back from Polar", () => {
    it("syncs from the subscription as it is now, not a stale retried payload", async () => {
      // A retried delivery still says Pro; the user has switched to Team since.
      const get = jest.fn(async () => subscription("subscription.updated", { productId: "prod_team", modifiedAt: "2026-10-26T09:00:00Z" }).data);
      (getPolar as jest.Mock).mockReturnValue({ subscriptions: { get } });
      mockDb.subscription.findUnique.mockResolvedValue(storedRow("active"));
      await deliver(subscription("subscription.active", { productId: "prod_pro" }));
      expect(get).toHaveBeenCalledWith("sub_1");
      expect(tx.user.update).toHaveBeenCalledWith({ where: { id: "user_1" }, data: { plan: "TEAM", planExpiresAt: null } });
    });

    it("keeps the delivery when Polar's copy is older (a lagging read replica)", async () => {
      // The delivery reports the upgrade to Team; the API still serves the Pro version.
      const get = jest.fn(async () => subscription("subscription.updated", { productId: "prod_pro", modifiedAt: "2026-10-25T09:59:58Z" }).data);
      (getPolar as jest.Mock).mockReturnValue({ subscriptions: { get } });
      mockDb.subscription.findUnique.mockResolvedValue(storedRow("active", { productId: "prod_pro" }));
      await deliver(subscription("subscription.updated", { productId: "prod_team", modifiedAt: "2026-10-25T10:00:00Z" }));
      expect(tx.user.update).toHaveBeenCalledWith({ where: { id: "user_1" }, data: { plan: "TEAM", planExpiresAt: null } });
      expect(tracked()).toEqual(["subscription_plan_changed"]);
    });

    it("uses the delivery's copy when Polar can't be reached", async () => {
      (getPolar as jest.Mock).mockReturnValue({ subscriptions: { get: jest.fn(async () => Promise.reject(new Error("Polar down"))) } });
      await deliver(subscription("subscription.active", { productId: "prod_pro" }));
      expect(tx.user.update).toHaveBeenCalledWith({ where: { id: "user_1" }, data: { plan: "PRO", planExpiresAt: null } });
    });
  });
});
