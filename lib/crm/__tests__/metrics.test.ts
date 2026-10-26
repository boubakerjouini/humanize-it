// /admin/funnel numbers: "leads" has one definition (a new contact a lead form
// created, test and internal contacts left out) shared by the KPI and the
// attribution tables, and the UTM tables list tagged people only.

jest.mock("@/lib/admin", () => ({ adminEmails: () => new Set(["founder.name@gmail.com", "ops@example.com"]) }));

type Row = {
  source: string;
  createdAt: Date;
  email: string | null;
  emailVerifiedAt: Date | null;
  channel: string | null;
  utmSource: string | null;
  utmCampaign: string | null;
  firstDocumentAt: Date | null;
  tags?: { tag: { name: string } }[];
  user: {
    role: string;
    tags?: { tag: { name: string } }[];
    createdAt: Date;
    subscription: { status: string } | null;
    memberships: { organization: { polarSubscriptionId: string | null; status: string } }[];
  } | null;
};

type DateWindow = { gte: Date; lt?: Date };
type Where = {
  source?: { in: string[] };
  createdAt?: DateWindow;
  firstDocumentAt?: unknown;
  OR?: [unknown, { user: { is: { createdAt: { gte: Date } } } }];
};

const mockState = { contacts: [] as Row[] };

jest.mock("@/lib/db", () => ({
  db: {
    // Mimics the three contact queries the funnel runs: leads, the cohort and the activation check.
    contact: {
      findMany: jest.fn(async ({ where }: { where: Where }) => {
        if (where.firstDocumentAt) return [];
        return mockState.contacts.filter((c) => {
          if (where.source && !where.source.in.includes(c.source)) return false;
          const w = where.createdAt!;
          if (c.createdAt < w.gte || (w.lt && c.createdAt >= w.lt)) return false;
          if (where.OR && c.user && c.user.createdAt < where.OR[1].user.is.createdAt.gte) return false;
          return true;
        });
      }),
    },
    user: { count: jest.fn(async () => 0) },
    contactEvent: { findMany: jest.fn(async () => []) },
  },
}));

import { getAttributionTables, getFunnel, groupAttribution, isTestOrInternalContact, type CohortContact } from "@/lib/crm/metrics";

const DAY = 86_400_000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);
const INTERNAL = new Set(["foundername@gmail.com", "ops@example.com"]);

function contact(over: Partial<Row>): Row {
  return {
    source: "magnet_page",
    createdAt: daysAgo(2),
    email: "reader@school.edu",
    emailVerifiedAt: null,
    channel: "organic_search",
    utmSource: null,
    utmCampaign: null,
    firstDocumentAt: null,
    user: null,
    ...over,
  };
}

const account = (over: Partial<NonNullable<Row["user"]>> = {}): NonNullable<Row["user"]> => ({
  role: "USER",
  createdAt: daysAgo(1),
  subscription: null,
  memberships: [],
  ...over,
});

describe("isTestOrInternalContact", () => {
  it("flags Resend test inboxes and admin accounts", () => {
    expect(isTestOrInternalContact({ email: "delivered@resend.dev", user: null }, INTERNAL)).toBe(true);
    expect(isTestOrInternalContact({ email: " Bounced@Resend.dev ", user: null }, INTERNAL)).toBe(true);
    expect(isTestOrInternalContact({ email: "someone@school.edu", user: { role: "ADMIN" } }, INTERNAL)).toBe(true);
  });

  it("flags contacts the founder tagged test, on the contact or its account", () => {
    expect(isTestOrInternalContact({ email: "qa@school.edu", tags: [{ tag: { name: " Test " } }], user: null }, INTERNAL)).toBe(true);
    expect(isTestOrInternalContact({ email: "qa@school.edu", user: { role: "USER", tags: [{ tag: { name: "test" } }] } }, INTERNAL)).toBe(true);
    expect(isTestOrInternalContact({ email: "qa@school.edu", tags: [{ tag: { name: "testimonial" } }], user: null }, INTERNAL)).toBe(false);
  });

  it("flags an allowlisted admin address under a +tag or Gmail dots", () => {
    expect(isTestOrInternalContact({ email: "ops@example.com", user: null }, INTERNAL)).toBe(true);
    expect(isTestOrInternalContact({ email: "ops+qa@example.com", user: null }, INTERNAL)).toBe(true);
    expect(isTestOrInternalContact({ email: "Founder.Name+lead@gmail.com", user: null }, INTERNAL)).toBe(true);
  });

  it("keeps everyone else", () => {
    expect(isTestOrInternalContact({ email: "reader@school.edu", user: { role: "USER" } }, INTERNAL)).toBe(false);
    expect(isTestOrInternalContact({ email: "opsx@example.com", user: null }, INTERNAL)).toBe(false);
    expect(isTestOrInternalContact({ email: null, user: null }, INTERNAL)).toBe(false);
  });
});

describe("groupAttribution", () => {
  const cohort = [
    contact({ utmSource: "producthunt", utmCampaign: "launch" }),
    contact({ utmSource: "producthunt", utmCampaign: "launch", source: "signup", user: account({ subscription: { status: "active" } }) }),
    contact({ utmSource: "reddit", utmCampaign: null, channel: "social" }),
    contact({ channel: "direct", source: "signup", user: account() }),
  ] as unknown as CohortContact[];

  it("counts everyone by channel, untagged people included", () => {
    const rows = groupAttribution(cohort, "channel");
    expect(rows.reduce((n, r) => n + r.people, 0)).toBe(4);
    expect(rows.find((r) => r.key === "organic_search")).toEqual({ key: "organic_search", people: 2, leads: 1, signups: 1, activated: 0, paying: 1 });
  });

  it("lists tagged people only in the UTM tables", () => {
    expect(groupAttribution(cohort, "utmSource")).toEqual([
      { key: "producthunt", people: 2, leads: 1, signups: 1, activated: 0, paying: 1 },
      { key: "reddit", people: 1, leads: 1, signups: 0, activated: 0, paying: 0 },
    ]);
    expect(groupAttribution(cohort, "utmCampaign")).toEqual([{ key: "launch", people: 2, leads: 1, signups: 1, activated: 0, paying: 1 }]);
  });
});

describe("leads on /admin/funnel", () => {
  beforeEach(() => {
    mockState.contacts = [
      contact({ email: "a@school.edu", emailVerifiedAt: daysAgo(1) }),
      contact({ email: "b@school.edu", source: "exit_intent", utmSource: "bing" }),
      // Converted later: still a lead for its source.
      contact({ email: "c@school.edu", user: account(), emailVerifiedAt: daysAgo(1) }),
      // Never leads: QA, internal, a direct signup, an old account the backfill linked, and last period's lead.
      contact({ email: "delivered@resend.dev" }),
      contact({ email: "verify@school.edu", utmSource: "claude-verify", tags: [{ tag: { name: "test" } }] }),
      contact({ email: "founder.name+qa@gmail.com" }),
      contact({ email: "staff@school.edu", user: account({ role: "ADMIN" }) }),
      contact({ email: "d@school.edu", source: "signup", user: account() }),
      contact({ email: "e@school.edu", user: account({ createdAt: daysAgo(400) }) }),
      contact({ email: "f@school.edu", createdAt: daysAgo(45) }),
    ];
  });

  it("counts new lead-form contacts and leaves test and internal ones out", async () => {
    const { current, previous } = await getFunnel(30);
    expect(current.leads).toBe(3);
    expect(current.leadsConfirmed).toBe(2);
    expect(previous.leads).toBe(1);
  });

  it("gives the attribution tables the same number of leads as the KPI", async () => {
    const [{ current }, tables] = await Promise.all([getFunnel(30), getAttributionTables(30)]);
    for (const dim of ["channel", "source"] as const) {
      expect(tables[dim].reduce((n, r) => n + r.leads, 0)).toBe(current.leads);
    }
    // QA and internal contacts aren't people either; the direct signup is.
    expect(tables.channel.reduce((n, r) => n + r.people, 0)).toBe(4);
    expect(tables.utmSource).toEqual([{ key: "bing", people: 1, leads: 1, signups: 0, activated: 0, paying: 0 }]);
  });
});
