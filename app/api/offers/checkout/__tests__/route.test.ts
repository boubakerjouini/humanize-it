// POST /api/offers/checkout records an offer_checkout_started event on the
// contact's timeline, only once Polar actually opened a checkout. Never
// a checkout_started: the abandoned-checkout task and email read that as a
// subscription checkout, and a paid Founding or Word Pack order never gets a
// subscription, so it would always look abandoned.

jest.mock("@clerk/nextjs/server", () => ({ auth: jest.fn(async () => ({ userId: "clerk_1" })) }));
const mockPolar = { checkouts: { create: jest.fn() } };
const mockEnsureCustomer = jest.fn();
jest.mock("@/lib/polar", () => ({
  getPolar: () => mockPolar,
  ensureCustomer: (...args: unknown[]) => mockEnsureCustomer(...args),
  BillingAccountError: class BillingAccountError extends Error {
    constructor(readonly code: string, message: string) {
      super(message);
    }
  },
  POLAR_CALLS_PER_MINUTE: 5,
  appUrl: () => "http://localhost:3000",
}));
const mockRateLimit = jest.fn();
jest.mock("@/lib/rate-limit", () => ({ checkRateLimit: (...args: unknown[]) => mockRateLimit(...args), rateLimitHeaders: () => ({}) }));
jest.mock("@/lib/quota", () => ({ effectivePlanId: (u: { plan: string }) => u.plan }));
jest.mock("@/lib/posthog", () => ({ trackServer: jest.fn() }));
jest.mock("@/lib/crm/events", () => ({ recordEvent: jest.fn(async () => null) }));
jest.mock("@/lib/growth/safe", () => ({ runAfter: (_label: string, fn: () => unknown) => void fn() }));
jest.mock("@/app/api/offers/shared", () => ({ foundingStatus: jest.fn(async () => ({ open: true })) }));

const mockDb = {
  user: { findUnique: jest.fn() },
  purchase: { count: jest.fn(async () => 0) },
};
jest.mock("@/lib/db", () => ({ db: mockDb }));

import { POST } from "@/app/api/offers/checkout/route";
import { recordEvent } from "@/lib/crm/events";
import { isEventType } from "@/lib/growth/constants";

const savedEnv = { ...process.env };

const checkout = (offer: string) =>
  POST(new Request("http://localhost/api/offers/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ offer }) }));

beforeEach(() => {
  jest.clearAllMocks();
  process.env = {
    ...savedEnv,
    POLAR_FOUNDING_PRODUCT_ID: "prod_founding",
    POLAR_WORDPACK_PRODUCT_ID: "prod_wordpack",
  };
  mockDb.user.findUnique.mockResolvedValue({ id: "user_1", email: "buyer@example.com", name: null, plan: "FREE", planExpiresAt: null, subscription: null });
  mockPolar.checkouts.create.mockResolvedValue({ url: "https://polar.example/checkout/abc" });
  mockEnsureCustomer.mockResolvedValue("cus_1");
  mockRateLimit.mockResolvedValue({ ok: true, retryAfterSeconds: 0 });
});

afterAll(() => {
  process.env = savedEnv;
});

it.each(["founding", "wordpack"])("records a %s checkout start as an offer checkout, never a subscription one", async (offer) => {
  const res = await checkout(offer);

  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ url: "https://polar.example/checkout/abc" });
  // Opened on the buyer's own Polar customer, so the email can't be swapped for another account's.
  expect(mockEnsureCustomer).toHaveBeenCalledWith(mockPolar, expect.objectContaining({ id: "user_1" }));
  expect(mockPolar.checkouts.create).toHaveBeenCalledWith(
    expect.objectContaining({
      products: [offer === "founding" ? "prod_founding" : "prod_wordpack"],
      customer_id: "cus_1",
      metadata: { user_id: "user_1", offer },
    })
  );
  expect(mockPolar.checkouts.create.mock.calls[0][0]).not.toHaveProperty("customer_email");
  expect(recordEvent).toHaveBeenCalledTimes(1);
  expect(recordEvent).toHaveBeenCalledWith({ userId: "user_1", type: "offer_checkout_started", props: { offer } });
});

it("uses an event type the CRM knows", () => {
  expect(isEventType("offer_checkout_started")).toBe(true);
});

it("records nothing when Polar didn't open a checkout", async () => {
  mockPolar.checkouts.create.mockRejectedValue(new Error("Polar down"));
  const quiet = jest.spyOn(console, "error").mockImplementation(() => {});

  const res = await checkout("founding");

  expect(res.status).toBe(500);
  expect(recordEvent).not.toHaveBeenCalled();
  quiet.mockRestore();
});

it("refuses with support's address when another billing account holds the email", async () => {
  const { BillingAccountError } = jest.requireMock("@/lib/polar");
  mockEnsureCustomer.mockRejectedValue(new BillingAccountError("EMAIL_TAKEN", "Your email is already linked to another billing account."));
  const quiet = jest.spyOn(console, "error").mockImplementation(() => {});

  const res = await checkout("wordpack");

  expect(res.status).toBe(409);
  expect((await res.json()).error.code).toBe("EMAIL_TAKEN");
  expect(mockPolar.checkouts.create).not.toHaveBeenCalled();
  expect(recordEvent).not.toHaveBeenCalled();
  quiet.mockRestore();
});

it("stops an account that calls it too often before it reaches Polar", async () => {
  mockRateLimit.mockResolvedValue({ ok: false, retryAfterSeconds: 30 });

  const res = await checkout("wordpack");

  expect(res.status).toBe(429);
  expect(mockEnsureCustomer).not.toHaveBeenCalled();
  expect(mockPolar.checkouts.create).not.toHaveBeenCalled();
});

it("records nothing when the offer is refused", async () => {
  mockDb.purchase.count.mockResolvedValueOnce(1); // already a founding member

  const res = await checkout("founding");

  expect(res.status).toBe(409);
  expect(mockPolar.checkouts.create).not.toHaveBeenCalled();
  expect(recordEvent).not.toHaveBeenCalled();
});
