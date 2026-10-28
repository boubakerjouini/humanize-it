// GET /api/usage feeds the settings plan section and the shell's plan label:
// it must say how the plan is held (grant end date, billing interval) and
// never show a lapsed grant as still running.

const mockAuth = jest.fn(async () => ({ userId: "clerk_1" as string | null }));
jest.mock("@clerk/nextjs/server", () => ({ auth: () => mockAuth() }));
jest.mock("@/lib/user", () => ({ ensureUser: jest.fn(async () => ({ id: "user_1" })) }));
jest.mock("@/lib/crm/bonus", () => ({ bonusBalance: jest.fn(async () => ({ words: 0 })) }));
jest.mock("@/lib/plans", () => {
  const base = { rewriteLimit: -1 };
  return {
    PLANS: {
      FREE: { ...base, id: "FREE", wordsLimit: 500, rewriteLimit: 1, polarProductId: null },
      PRO: { ...base, id: "PRO", wordsLimit: 50_000, polarProductId: "prod_pro_m", polarProductIdAnnual: "prod_pro_y" },
      TEAM: { ...base, id: "TEAM", wordsLimit: 200_000, polarProductId: "prod_team_m", polarProductIdAnnual: "prod_team_y" },
    },
  };
});
const mockDb = { user: { findUnique: jest.fn() } };
jest.mock("@/lib/db", () => ({ db: mockDb }));

import { GET } from "@/app/api/usage/route";

const DAY = 86_400_000;
const row = (over: Record<string, unknown> = {}) => ({
  id: "user_1",
  plan: "FREE",
  planExpiresAt: null,
  wordsUsed: 120,
  rewriteCount: 0,
  quotaResetAt: new Date("2026-10-27T00:00:00Z"),
  subscription: null,
  ...over,
});

async function usage() {
  const res = await GET();
  return { status: res.status, body: await res.json() };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.mockResolvedValue({ userId: "clerk_1" });
});

describe("GET /api/usage", () => {
  it("401s without a session", async () => {
    mockAuth.mockResolvedValueOnce({ userId: null });
    expect((await usage()).status).toBe(401);
  });

  it("keeps the existing fields for a Free user and adds the new ones as null", async () => {
    mockDb.user.findUnique.mockResolvedValue(row());
    const { status, body } = await usage();
    expect(status).toBe(200);
    expect(body).toMatchObject({
      plan: "FREE", effectivePlan: "FREE", wordsUsed: 120, wordsLimit: 500, rewriteLimit: 1,
      subscriptionStatus: null, currentPeriodEnd: null, billingInterval: null, planExpiresAt: null, bonusWords: 0,
    });
  });

  it("returns the end date of a gifted plan (no subscription)", async () => {
    const until = new Date(Date.now() + 30 * DAY);
    mockDb.user.findUnique.mockResolvedValue(row({ plan: "PRO", planExpiresAt: until, wordsUsed: 900 }));
    const { body } = await usage();
    expect(body).toMatchObject({ plan: "PRO", effectivePlan: "PRO", wordsUsed: 900, wordsLimit: 50_000, planExpiresAt: until.toISOString(), subscriptionStatus: null });
  });

  it("reports a lapsed grant as Free with a fresh meter, keeping the end date", async () => {
    const ended = new Date(Date.now() - 2 * DAY);
    mockDb.user.findUnique.mockResolvedValue(row({ plan: "PRO", planExpiresAt: ended, wordsUsed: 900, rewriteCount: 4 }));
    const { body } = await usage();
    expect(body).toMatchObject({ plan: "PRO", effectivePlan: "FREE", wordsUsed: 0, rewriteCount: 0, wordsLimit: 500, rewriteLimit: 1, planExpiresAt: ended.toISOString() });
  });

  it.each([
    ["prod_pro_y", "year"],
    ["prod_pro_m", "month"],
    ["prod_unknown", null],
  ])("reads the billing interval from the subscription product %s", async (product, interval) => {
    const end = new Date("2026-11-27T00:00:00Z");
    mockDb.user.findUnique.mockResolvedValue(row({ plan: "PRO", subscription: { status: "active", currentPeriodEnd: end, polarProductId: product } }));
    const { body } = await usage();
    expect(body).toMatchObject({ subscriptionStatus: "active", currentPeriodEnd: end.toISOString(), billingInterval: interval });
  });
});
