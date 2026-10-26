// POST /api/billing/portal opens Polar's customer portal by our own user id,
// so it can only ever show the signed-in user's billing, and says so plainly
// when the account has nothing billed through Polar.

import { errors } from "@polar-sh/sdk/2026-10";

jest.mock("@clerk/nextjs/server", () => ({ auth: jest.fn(async () => ({ userId: "clerk_1" })) }));
const mockPolar = {};
const mockPortalUrl = jest.fn();
jest.mock("@/lib/polar", () => ({
  getPolar: () => mockPolar,
  customerPortalUrl: (...args: unknown[]) => mockPortalUrl(...args),
  POLAR_CALLS_PER_MINUTE: 5,
}));
const mockRateLimit = jest.fn();
jest.mock("@/lib/rate-limit", () => ({ checkRateLimit: (...args: unknown[]) => mockRateLimit(...args), rateLimitHeaders: () => ({}) }));
const mockDb = { user: { findUnique: jest.fn() } };
jest.mock("@/lib/db", () => ({ db: mockDb }));

import { POST } from "@/app/api/billing/portal/route";

beforeEach(() => {
  jest.clearAllMocks();
  mockDb.user.findUnique.mockResolvedValue({ id: "user_1" });
  mockRateLimit.mockResolvedValue({ ok: true, retryAfterSeconds: 0 });
});

it("opens the portal of the signed-in user's own Polar customer", async () => {
  mockPortalUrl.mockResolvedValue("https://polar.example/portal/xyz");

  const res = await POST();

  expect(await res.json()).toEqual({ url: "https://polar.example/portal/xyz" });
  expect(mockPortalUrl).toHaveBeenCalledWith(mockPolar, "user_1");
});

it("explains that a comped plan has no billing to manage", async () => {
  mockPortalUrl.mockRejectedValue(new errors.ResourceNotFound(404, { error: "ResourceNotFound", detail: "Not found" }));

  const res = await POST();

  expect(res.status).toBe(400);
  expect((await res.json()).error.code).toBe("NO_SUBSCRIPTION");
});

it("stops an account that calls it too often before it reaches Polar", async () => {
  mockRateLimit.mockResolvedValue({ ok: false, retryAfterSeconds: 30 });

  const res = await POST();

  expect(res.status).toBe(429);
  expect(mockPortalUrl).not.toHaveBeenCalled();
});
