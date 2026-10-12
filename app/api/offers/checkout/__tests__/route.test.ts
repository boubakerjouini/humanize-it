// POST /api/offers/checkout records an offer_checkout_started event on the
// contact's timeline, only once LemonSqueezy actually opened a checkout. Never
// a checkout_started: the abandoned-checkout task and email read that as a
// subscription checkout, and a paid Founding or Word Pack order never gets a
// subscription, so it would always look abandoned.

jest.mock("@clerk/nextjs/server", () => ({ auth: jest.fn(async () => ({ userId: "clerk_1" })) }));
jest.mock("@lemonsqueezy/lemonsqueezy.js", () => ({ createCheckout: jest.fn() }));
jest.mock("@/lib/lemonsqueezy", () => ({ configureLemonSqueezy: jest.fn() }));
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

import { createCheckout } from "@lemonsqueezy/lemonsqueezy.js";
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
    LEMONSQUEEZY_STORE_ID: "store_1",
    LEMONSQUEEZY_FOUNDING_VARIANT_ID: "111",
    LEMONSQUEEZY_WORDPACK_VARIANT_ID: "222",
  };
  mockDb.user.findUnique.mockResolvedValue({ id: "user_1", email: "buyer@example.com", name: null, plan: "FREE", planExpiresAt: null, subscription: null });
  (createCheckout as jest.Mock).mockResolvedValue({ data: { data: { attributes: { url: "https://store.example/checkout/abc" } } }, error: null });
});

afterAll(() => {
  process.env = savedEnv;
});

it.each(["founding", "wordpack"])("records a %s checkout start as an offer checkout, never a subscription one", async (offer) => {
  const res = await checkout(offer);

  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ url: "https://store.example/checkout/abc" });
  expect(recordEvent).toHaveBeenCalledTimes(1);
  expect(recordEvent).toHaveBeenCalledWith({ userId: "user_1", type: "offer_checkout_started", props: { offer } });
});

it("uses an event type the CRM knows", () => {
  expect(isEventType("offer_checkout_started")).toBe(true);
});

it("records nothing when LemonSqueezy didn't open a checkout", async () => {
  (createCheckout as jest.Mock).mockResolvedValue({ data: null, error: new Error("LS down") });
  const quiet = jest.spyOn(console, "error").mockImplementation(() => {});

  const res = await checkout("founding");

  expect(res.status).toBe(500);
  expect(recordEvent).not.toHaveBeenCalled();
  quiet.mockRestore();
});

it("records nothing when the offer is refused", async () => {
  mockDb.purchase.count.mockResolvedValueOnce(1); // already a founding member

  const res = await checkout("founding");

  expect(res.status).toBe(409);
  expect(createCheckout).not.toHaveBeenCalled();
  expect(recordEvent).not.toHaveBeenCalled();
});
