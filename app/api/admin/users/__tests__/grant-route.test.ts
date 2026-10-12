// PATCH /api/admin/users/[id] with action "grant": the update writes what
// planAfterGrant computed (higher plan kept, days added to the current end),
// a grant that would take access away changes nothing, and bad day counts are
// rejected instead of turning into a lifetime grant.

const mockDb = {
  user: { findUnique: jest.fn(), update: jest.fn(async () => ({})) },
};

jest.mock("@/lib/db", () => ({ db: mockDb }));
jest.mock("@/lib/admin", () => ({
  requireAdmin: jest.fn(async () => ({ id: "admin_1", email: "admin@example.com" })),
  isAdminEmail: jest.fn(() => false),
}));
jest.mock("@/lib/clerk-identity", () => ({ resolveIdentities: jest.fn(async () => new Map()) }));
jest.mock("@/lib/audit", () => ({ logAudit: jest.fn(async () => {}) }));
jest.mock("@/lib/growth/safe", () => ({ runAfter: (_label: string, fn: () => unknown) => void fn() }));
jest.mock("@/lib/crm/hooks", () => ({ onUserDeleted: jest.fn(), trackAdminPlanChange: jest.fn(async () => {}) }));
jest.mock("@/lib/crm/contact-360", () => ({ loadCustomerCrm: jest.fn() }));

import { PATCH } from "@/app/api/admin/users/[id]/route";
import { logAudit } from "@/lib/audit";
import { trackAdminPlanChange } from "@/lib/crm/hooks";

const DAY = 86_400_000;

function grant(body: Record<string, unknown>) {
  const req = new Request("http://localhost/api/admin/users/user_1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "grant", ...body }),
  });
  return PATCH(req, { params: Promise.resolve({ id: "user_1" }) });
}

function account(plan: string, planExpiresAt: Date | null) {
  mockDb.user.findUnique.mockResolvedValue({ email: "member@example.com", plan, role: "USER", planExpiresAt });
}

beforeEach(() => jest.clearAllMocks());

it("extends a comped Team account from its end date and keeps Team, with the form's Pro default", async () => {
  const end = new Date(Date.now() + 240 * DAY);
  account("TEAM", end);

  const res = await grant({ plan: "PRO", days: 30 });

  expect(res.status).toBe(200);
  expect(mockDb.user.update).toHaveBeenCalledWith({
    where: { id: "user_1" },
    data: { plan: "TEAM", planExpiresAt: new Date(end.getTime() + 30 * DAY) },
  });
  expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "user.grant", summary: expect.stringMatching(/^Granted PRO \+30d → TEAM until .+ \(was TEAM until .+\)$/) }));
  expect(trackAdminPlanChange).toHaveBeenCalledWith("user_1", expect.objectContaining({ action: "grant", plan: "TEAM", days: 30 }));
});

it("starts a Free account's grant today", async () => {
  account("FREE", null);
  const before = Date.now();

  await grant({ plan: "PRO", days: 7 });

  const data = (mockDb.user.update.mock.calls[0] as unknown as [{ data: { plan: string; planExpiresAt: Date } }])[0].data;
  expect(data.plan).toBe("PRO");
  const days = (data.planExpiresAt.getTime() - before) / DAY;
  expect(days).toBeGreaterThan(6.99);
  expect(days).toBeLessThan(7.01);
});

it("changes nothing when the grant would end a no-end-date plan on Free", async () => {
  account("PRO", null);

  const res = await grant({ plan: "TEAM", days: 30 });

  expect(res.status).toBe(409);
  expect((await res.json()).error.message).toMatch(/would end on Free/);
  expect(mockDb.user.update).not.toHaveBeenCalled();
  expect(logAudit).not.toHaveBeenCalled();
});

it.each([0, -3, 1.5, "30", 99_999])("rejects %p days instead of granting forever", async (days) => {
  account("FREE", null);

  const res = await grant({ plan: "PRO", days });

  expect(res.status).toBe(400);
  expect(mockDb.user.update).not.toHaveBeenCalled();
});
