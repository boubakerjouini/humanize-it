// /api/organizations: seats can't be bought yet, and nothing takes a seat back
// when a subscription ends, so creating an organization or adding seats is
// limited to platform admins. A Team plan, paid or comped, doesn't qualify.
// Existing organizations keep working: renaming and removing seats stay open
// to their managers.

jest.mock("@clerk/nextjs/server", () => ({ auth: jest.fn(async () => ({ userId: "clerk_1" })) }));
jest.mock("@/lib/user", () => ({ ensureUser: jest.fn() }));

const mockDb = {
  membership: { findFirst: jest.fn(), findMany: jest.fn(async () => []), count: jest.fn(async () => 1) },
  invitation: { findMany: jest.fn(async () => []), count: jest.fn(async () => 0) },
  organization: {
    findUnique: jest.fn(async () => null),
    create: jest.fn(async ({ data }: { data: { name: string; slug: string; seatsTotal: number } }) => ({ id: "org_1", ...data })),
    update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: "org_1", name: "Acme", seatsTotal: 6, ...data })),
  },
  user: { update: jest.fn(async () => ({})) },
};
jest.mock("@/lib/db", () => ({ db: mockDb }));

import { GET, PATCH, POST } from "@/app/api/organizations/route";
import { maySeatOthers } from "@/lib/organizations";
import { ensureUser } from "@/lib/user";

type TestUser = { id: string; email: string; role: "USER" | "ADMIN"; plan: string; planExpiresAt: Date | null };

const FREE_USER: TestUser = { id: "user_1", email: "owner@example.com", role: "USER", plan: "FREE", planExpiresAt: null };
// A Team plan from a Polar subscription, a redeem code or an admin grant.
const TEAM_USER: Partial<TestUser> = { plan: "TEAM", planExpiresAt: new Date(Date.now() + 200 * 86_400_000) };

function signedIn(user: Partial<TestUser> = {}) {
  (ensureUser as jest.Mock).mockResolvedValue({ ...FREE_USER, ...user });
}

function inOrg(role: "OWNER" | "ADMIN" | "MEMBER", seatsTotal = 6) {
  mockDb.membership.findFirst.mockResolvedValue({
    id: "m_1",
    organizationId: "org_1",
    role,
    organization: { id: "org_1", name: "Acme", slug: "acme", seatsTotal, status: "active", wordsUsed: 0 },
  });
}

const json = (method: string, body: unknown) =>
  new Request("http://localhost/api/organizations", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

const savedAdminEmails = process.env.ADMIN_EMAILS;

beforeEach(() => {
  jest.clearAllMocks();
  process.env.ADMIN_EMAILS = "ops@example.com";
  mockDb.membership.findFirst.mockResolvedValue(null);
});

afterAll(() => {
  if (savedAdminEmails === undefined) delete process.env.ADMIN_EMAILS;
  else process.env.ADMIN_EMAILS = savedAdminEmails;
});

describe("maySeatOthers", () => {
  it("is true only for platform admins", () => {
    expect(maySeatOthers({ email: "someone@example.com", role: "ADMIN" })).toBe(true);
    expect(maySeatOthers({ email: "ops@example.com", role: "USER" })).toBe(true);
    expect(maySeatOthers({ email: "owner@example.com", role: "USER" })).toBe(false);
  });
});

describe("POST /api/organizations", () => {
  it.each([
    ["a Free user", {}],
    ["a Team user, paid or comped", TEAM_USER],
  ])("refuses %s and hands out nothing", async (_who, user) => {
    signedIn(user);

    const res = await POST(json("POST", { name: "Acme", seats: 500 }));

    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("SEATS_ON_REQUEST");
    expect(mockDb.organization.create).not.toHaveBeenCalled();
    expect(mockDb.user.update).not.toHaveBeenCalled();
  });

  it.each([
    ["a platform admin", { role: "ADMIN" as const }],
    ["an allowlisted admin address", { email: "ops@example.com" }],
  ])("lets %s create one", async (_who, user) => {
    signedIn(user);

    const res = await POST(json("POST", { name: "Acme", seats: 3 }));

    expect(res.status).toBe(200);
    expect(mockDb.organization.create).toHaveBeenCalledWith({ data: expect.objectContaining({ name: "Acme", seatsTotal: 3, ownerId: "user_1" }) });
    expect(mockDb.user.update).toHaveBeenCalledWith({ where: { id: "user_1" }, data: { plan: "TEAM", planExpiresAt: null } });
  });
});

describe("PATCH /api/organizations", () => {
  it.each([
    ["a Free owner", {}],
    ["a Team owner, paid or comped", TEAM_USER],
  ])("refuses more seats to %s", async (_who, user) => {
    signedIn(user);
    inOrg("OWNER", 6);

    const res = await PATCH(json("PATCH", { seatsTotal: 7 }));

    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("SEATS_ON_REQUEST");
    expect(mockDb.organization.update).not.toHaveBeenCalled();
  });

  it("still lets that manager remove a seat or rename the organization", async () => {
    signedIn();
    inOrg("OWNER", 6);

    expect((await PATCH(json("PATCH", { seatsTotal: 5 }))).status).toBe(200);
    expect(mockDb.organization.update).toHaveBeenLastCalledWith({ where: { id: "org_1" }, data: { seatsTotal: 5 } });

    expect((await PATCH(json("PATCH", { name: "Acme Studio" }))).status).toBe(200);
    expect(mockDb.organization.update).toHaveBeenLastCalledWith({ where: { id: "org_1" }, data: { name: "Acme Studio" } });
  });

  it("lets a platform admin add seats", async () => {
    signedIn({ role: "ADMIN" });
    inOrg("ADMIN", 6);

    const res = await PATCH(json("PATCH", { seatsTotal: 8 }));

    expect(res.status).toBe(200);
    expect(mockDb.organization.update).toHaveBeenCalledWith({ where: { id: "org_1" }, data: { seatsTotal: 8 } });
  });

  it("rejects a seat count that isn't a whole number", async () => {
    signedIn({ role: "ADMIN" });
    inOrg("OWNER", 6);

    expect((await PATCH(json("PATCH", { seatsTotal: "lots" }))).status).toBe(400);
    expect(mockDb.organization.update).not.toHaveBeenCalled();
  });
});

describe("GET /api/organizations", () => {
  it("tells the page whether this user may start an organization", async () => {
    signedIn();
    expect(await (await GET()).json()).toEqual({ organization: null, canCreate: false });

    signedIn(TEAM_USER);
    expect(await (await GET()).json()).toEqual({ organization: null, canCreate: false });

    signedIn({ role: "ADMIN" });
    expect(await (await GET()).json()).toEqual({ organization: null, canCreate: true });
  });

  it("tells a manager whether they may add seats", async () => {
    signedIn(TEAM_USER);
    inOrg("OWNER", 6);
    const body = await (await GET()).json();
    expect(body.canManage).toBe(true);
    expect(body.canAddSeats).toBe(false);
  });
});
