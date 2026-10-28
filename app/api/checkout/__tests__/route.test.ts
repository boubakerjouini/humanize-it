// POST /api/checkout opens a Polar checkout on the buyer's own Polar customer
// (never by email, which Polar could match to another account), sends a user
// who already subscribes to the portal instead (Polar refuses a second
// subscription checkout), and stops an account that calls it too often
// before it reaches Polar.

jest.mock("@clerk/nextjs/server", () => ({ auth: jest.fn(async () => ({ userId: "clerk_1" })) }));
const mockPolar = { checkouts: { create: jest.fn() } };
const mockEnsureCustomer = jest.fn();
const mockPortalUrl = jest.fn();
const mockPaymentsEnabled = jest.fn();
jest.mock("@/lib/polar", () => ({
  getPolar: () => mockPolar,
  ensureCustomer: (...args: unknown[]) => mockEnsureCustomer(...args),
  customerPortalUrl: (...args: unknown[]) => mockPortalUrl(...args),
  checkoutPaymentsEnabled: () => mockPaymentsEnabled(),
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
jest.mock("@/lib/plans", () => {
  // lib/plans reads the plan product ids when it is first imported.
  process.env.POLAR_PRO_PRODUCT_ID = "prod_pro";
  process.env.POLAR_PRO_ANNUAL_PRODUCT_ID = "prod_pro_annual";
  process.env.POLAR_TEAM_PRODUCT_ID = "prod_team";
  return jest.requireActual("@/lib/plans");
});
jest.mock("@/lib/crm/hooks", () => ({ trackCheckoutStarted: jest.fn(), trackCheckoutPaused: jest.fn() }));
jest.mock("@/lib/growth/safe", () => ({ runAfter: (_label: string, fn: () => unknown) => void fn() }));

const mockDb = { user: { findUnique: jest.fn() } };
jest.mock("@/lib/db", () => ({ db: mockDb }));

import { POST } from "@/app/api/checkout/route";
import { trackCheckoutPaused, trackCheckoutStarted } from "@/lib/crm/hooks";

const DAY = 86_400_000;
const buyer = { id: "user_1", email: "buyer@example.org", name: "Buyer", plan: "FREE", subscription: null };

const checkout = (body: unknown) =>
  POST(new Request("http://localhost/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));

beforeEach(() => {
  jest.clearAllMocks();
  mockDb.user.findUnique.mockResolvedValue(buyer);
  mockRateLimit.mockResolvedValue({ ok: true, retryAfterSeconds: 0 });
  mockEnsureCustomer.mockResolvedValue("cus_1");
  mockPortalUrl.mockResolvedValue("https://polar.example/portal/xyz");
  mockPolar.checkouts.create.mockResolvedValue({ url: "https://polar.example/checkout/abc" });
  mockPaymentsEnabled.mockResolvedValue(true);
});

it("opens the checkout on the buyer's own Polar customer, with our user id in the metadata", async () => {
  const res = await checkout({ plan: "PRO", annual: true });

  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ url: "https://polar.example/checkout/abc" });
  expect(mockEnsureCustomer).toHaveBeenCalledWith(mockPolar, buyer);
  const body = mockPolar.checkouts.create.mock.calls[0][0];
  expect(body).toMatchObject({
    products: ["prod_pro_annual"],
    customer_id: "cus_1",
    metadata: { user_id: "user_1", plan_id: "PRO", annual: true },
  });
  // Never by email or external id: Polar could attach those to another account's customer.
  expect(body).not.toHaveProperty("customer_email");
  expect(body).not.toHaveProperty("external_customer_id");
  expect(trackCheckoutStarted).toHaveBeenCalledWith("user_1", "PRO", true);
});

it.each([
  ["active", null],
  ["past_due", null],
  ["cancelled", 10 * DAY],
])("sends a %s subscriber to the portal to change plan", async (status, endsIn) => {
  mockDb.user.findUnique.mockResolvedValue({
    ...buyer,
    plan: "PRO",
    subscription: { polarSubscriptionId: "sub_1", status, currentPeriodEnd: endsIn ? new Date(Date.now() + endsIn) : null },
  });

  const res = await checkout({ plan: "TEAM" });

  expect(await res.json()).toEqual({ url: "https://polar.example/portal/xyz" });
  expect(mockPortalUrl).toHaveBeenCalledWith(mockPolar, "user_1");
  expect(mockPolar.checkouts.create).not.toHaveBeenCalled();
  expect(trackCheckoutStarted).not.toHaveBeenCalled();
});

it("sends a paused subscriber to support: the portal can't resume, and a second subscription would double-bill", async () => {
  mockDb.user.findUnique.mockResolvedValue({ ...buyer, subscription: { polarSubscriptionId: "sub_1", status: "paused", currentPeriodEnd: null } });

  const res = await checkout({ plan: "PRO" });

  expect(res.status).toBe(409);
  expect((await res.json()).error.code).toBe("SUBSCRIPTION_PAUSED");
  expect(mockPortalUrl).not.toHaveBeenCalled();
  expect(mockPolar.checkouts.create).not.toHaveBeenCalled();
});

it("falls back to a checkout when Polar has no customer behind the stored subscription", async () => {
  mockDb.user.findUnique.mockResolvedValue({ ...buyer, subscription: { polarSubscriptionId: "sub_1", status: "active", currentPeriodEnd: null } });
  mockPortalUrl.mockResolvedValue(null);

  await checkout({ plan: "PRO" });

  expect(mockPolar.checkouts.create).toHaveBeenCalled();
});

it("opens a new checkout once a cancelled subscription's period is over", async () => {
  mockDb.user.findUnique.mockResolvedValue({
    ...buyer,
    subscription: { polarSubscriptionId: "sub_1", status: "cancelled", currentPeriodEnd: new Date(Date.now() - DAY) },
  });

  await checkout({ plan: "PRO" });

  expect(mockPortalUrl).not.toHaveBeenCalled();
  expect(mockPolar.checkouts.create).toHaveBeenCalled();
});

it("refuses with support's address when another billing account holds the email", async () => {
  const { BillingAccountError } = jest.requireMock("@/lib/polar");
  mockEnsureCustomer.mockRejectedValue(new BillingAccountError("EMAIL_TAKEN", "Your email is already linked to another billing account."));
  const quiet = jest.spyOn(console, "error").mockImplementation(() => {});

  const res = await checkout({ plan: "PRO" });

  expect(res.status).toBe(409);
  expect((await res.json()).error.code).toBe("EMAIL_TAKEN");
  expect(mockPolar.checkouts.create).not.toHaveBeenCalled();
  expect(trackCheckoutStarted).not.toHaveBeenCalled();
  quiet.mockRestore();
});

it("stops an account that calls it too often before it reaches Polar", async () => {
  mockRateLimit.mockResolvedValue({ ok: false, retryAfterSeconds: 30 });

  const res = await checkout({ plan: "PRO" });

  expect(res.status).toBe(429);
  expect(mockRateLimit).toHaveBeenCalledWith("polar:user_1", 5);
  expect(mockEnsureCustomer).not.toHaveBeenCalled();
  expect(mockPolar.checkouts.create).not.toHaveBeenCalled();
  expect(trackCheckoutStarted).not.toHaveBeenCalled();
});

describe("while Polar can't take payments yet", () => {
  it("pauses a new checkout instead of opening a page that can't be paid, and records the attempt", async () => {
    mockPaymentsEnabled.mockResolvedValue(false);

    const res = await checkout({ plan: "PRO", annual: true });

    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error.code).toBe("CHECKOUT_PAUSED");
    expect(json.error.message).toMatch(/email you/);
    expect(mockPolar.checkouts.create).not.toHaveBeenCalled();
    expect(mockEnsureCustomer).not.toHaveBeenCalled();
    expect(trackCheckoutPaused).toHaveBeenCalledWith("user_1", "PRO", true);
    expect(trackCheckoutStarted).not.toHaveBeenCalled();
  });

  it("still sends a live subscriber to the portal", async () => {
    mockPaymentsEnabled.mockResolvedValue(false);
    mockDb.user.findUnique.mockResolvedValue({ ...buyer, plan: "PRO", subscription: { polarSubscriptionId: "sub_1", status: "active", currentPeriodEnd: null } });

    expect(await (await checkout({ plan: "TEAM" })).json()).toEqual({ url: "https://polar.example/portal/xyz" });
  });

  it("goes to checkout as before when the capability can't be read", async () => {
    mockPaymentsEnabled.mockResolvedValue(null);

    const res = await checkout({ plan: "PRO" });

    expect(res.status).toBe(200);
    expect(mockPolar.checkouts.create).toHaveBeenCalled();
    expect(trackCheckoutPaused).not.toHaveBeenCalled();
  });
});
