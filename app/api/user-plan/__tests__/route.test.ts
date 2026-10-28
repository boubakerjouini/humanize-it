// GET /api/user-plan: the editor's plan. A gift that has ended reads as Free
// right away; a running gift, a subscription or an org seat keep their plan.

const mockFindUnique = jest.fn();
jest.mock("@clerk/nextjs/server", () => ({ auth: jest.fn(async () => ({ userId: "clerk_1" })) }));
jest.mock("@/lib/db", () => ({ db: { user: { findUnique: (...args: unknown[]) => mockFindUnique(...args) } } }));
jest.mock("@/lib/admin", () => ({ isAdminUser: () => false }));

import { GET } from "@/app/api/user-plan/route";

const DAY = 86_400_000;
const user = (over: Record<string, unknown>) => ({ plan: "PRO", planExpiresAt: null, subscription: null, email: "a@b.c", name: null, role: "USER", memberships: [], ...over });

it.each([
  ["an ended gift", user({ planExpiresAt: new Date(Date.now() - DAY) }), "FREE"],
  ["a running gift", user({ planExpiresAt: new Date(Date.now() + 10 * DAY) }), "PRO"],
  ["a subscription", user({ subscription: { status: "active" } }), "PRO"],
  ["an org seat (no end date)", user({ plan: "TEAM" }), "TEAM"],
  ["Free", user({ plan: "FREE" }), "FREE"],
])("reports %s as %s", async (_label, row, plan) => {
  mockFindUnique.mockResolvedValueOnce(row);
  expect((await (await GET()).json()).plan).toBe(plan);
});
