// Auto task rules: each rule's conditions, and the guarantee that repeated
// daily runs create at most one task per (ruleKey, contactId, cycle).

jest.mock("@/lib/db", () => {
  const state = {
    rows: [] as unknown[],
    tasks: new Map<string, Record<string, unknown>>(),
    createManyCalls: [] as { skipDuplicates?: boolean }[],
  };
  const db = {
    contact: { findMany: jest.fn(async () => state.rows) },
    crmTask: {
      // Mimics Postgres: the unique dedupeKey plus skipDuplicates drops repeats.
      createMany: jest.fn(async (args: { data: Record<string, unknown>[]; skipDuplicates?: boolean }) => {
        state.createManyCalls.push({ skipDuplicates: args.skipDuplicates });
        let count = 0;
        for (const row of args.data) {
          const key = String(row.dedupeKey);
          if (state.tasks.has(key)) {
            if (!args.skipDuplicates) throw new Error("unique violation");
            continue;
          }
          state.tasks.set(key, row);
          count++;
        }
        return { count };
      }),
    },
  };
  return { db, state };
});

import * as dbModule from "@/lib/db";
import {
  evaluateTaskRules,
  isoWeek,
  quarterOf,
  runAutoTaskRules,
  taskDedupeKey,
  toSnapshot,
  type CandidateRow,
  type TaskRuleSnapshot,
} from "@/lib/crm/task-rules";

const state = (dbModule as unknown as {
  state: { rows: unknown[]; tasks: Map<string, Record<string, unknown>>; createManyCalls: { skipDuplicates?: boolean }[] };
}).state;

const NOW = new Date("2026-10-07T09:00:00Z"); // Wednesday, ISO week 41
const DAY = 24 * 60 * 60 * 1000;
const ago = (days: number) => new Date(NOW.getTime() - days * DAY);
const ahead = (days: number) => new Date(NOW.getTime() + days * DAY);

function snap(over: Partial<TaskRuleSnapshot> = {}, user: Partial<NonNullable<TaskRuleSnapshot["user"]>> | null = null): TaskRuleSnapshot {
  return {
    contactId: "c1",
    stage: "lead",
    score: 0,
    stageChangedAt: null,
    lastActiveAt: null,
    tags: [],
    quotaHits7d: 0,
    lastCheckout: null,
    subscribedAfterCheckout: false,
    user: user
      ? {
          plan: "FREE",
          planExpiresAt: null,
          createdAt: ago(60),
          documentCount: 0,
          subscription: null,
          payingOrgSeat: false,
          ...user,
        }
      : null,
    ...over,
  };
}

const rules = (s: TaskRuleSnapshot, now = NOW) => evaluateTaskRules(s, now).map((t) => t.ruleKey);

describe("cycle helpers", () => {
  it("computes ISO weeks across year boundaries", () => {
    expect(isoWeek(NOW)).toBe("2026-W41");
    expect(isoWeek(new Date("2026-01-01T00:00:00Z"))).toBe("2026-W01");
    expect(isoWeek(new Date("2027-01-01T00:00:00Z"))).toBe("2026-W53");
    expect(isoWeek(new Date("2026-10-05T00:00:00Z"))).toBe(isoWeek(new Date("2026-10-11T23:59:59Z")));
  });

  it("computes quarters", () => {
    expect(quarterOf(NOW)).toBe("2026-Q4");
    expect(quarterOf(new Date("2026-03-31T23:00:00Z"))).toBe("2026-Q1");
  });

  it("builds the dedupe key as ruleKey:contactId:cycle", () => {
    expect(taskDedupeKey("hot_lead", "c1", "2026-W41")).toBe("hot_lead:c1:2026-W41");
  });
});

describe("rules", () => {
  it("comped_expiring: a comped plan ending within 14 days, keyed by the expiry date", () => {
    const s = snap({ stage: "comped" }, { plan: "TEAM", planExpiresAt: ahead(10) });
    const [task] = evaluateTaskRules(s, NOW);
    expect(task.ruleKey).toBe("comped_expiring");
    expect(task.priority).toBe("high");
    expect(task.title).toContain("Team access ends");
    expect(task.title).toContain("Script D");
    expect(task.dedupeKey).toBe(`comped_expiring:c1:${ahead(10).toISOString().slice(0, 10)}`);
    expect(rules(snap({}, { plan: "TEAM", planExpiresAt: ahead(20) }))).not.toContain("comped_expiring");
    expect(rules(snap({}, { plan: "TEAM", planExpiresAt: ago(1) }))).not.toContain("comped_expiring");
    const paying = snap({}, { plan: "PRO", planExpiresAt: ahead(5), subscription: { id: "s", status: "active", lsSubscriptionId: "ls" } });
    expect(rules(paying)).not.toContain("comped_expiring");
  });

  it("paid_inactive: paying and idle for 10+ days (signup date when never active)", () => {
    const sub = { id: "s", status: "active", lsSubscriptionId: "ls" };
    expect(rules(snap({ stage: "customer", lastActiveAt: ago(11) }, { plan: "PRO", subscription: sub }))).toContain("paid_inactive");
    expect(rules(snap({ stage: "customer", lastActiveAt: ago(3) }, { plan: "PRO", subscription: sub }))).not.toContain("paid_inactive");
    expect(rules(snap({ stage: "customer" }, { plan: "TEAM", createdAt: ago(12), payingOrgSeat: true }))).toContain("paid_inactive");
    expect(rules(snap({ lastActiveAt: ago(30) }, { plan: "PRO" }))).not.toContain("paid_inactive");
  });

  it("hot_lead: a lead or engaged lead scoring 60+", () => {
    expect(rules(snap({ stage: "engaged_lead", score: 60 }))).toEqual(["hot_lead"]);
    expect(rules(snap({ stage: "lead", score: 59 }))).toEqual([]);
    expect(rules(snap({ stage: "activated", score: 90 }, {}))).not.toContain("hot_lead");
  });

  it("checkout_abandoned: a checkout 24 to 72 hours ago with no subscription since", () => {
    const checkout = (hours: number) => ({ id: "evt1", at: new Date(NOW.getTime() - hours * 3600_000), plan: "PRO" });
    const [task] = evaluateTaskRules(snap({ lastCheckout: checkout(30) }, {}), NOW);
    expect(task.ruleKey).toBe("checkout_abandoned");
    expect(task.dedupeKey).toBe("checkout_abandoned:c1:evt1");
    expect(task.title).toBe("Follow up on abandoned Pro checkout");
    expect(rules(snap({ lastCheckout: checkout(10) }, {}))).toEqual([]);
    expect(rules(snap({ lastCheckout: checkout(80) }, {}))).toEqual([]);
    expect(rules(snap({ lastCheckout: checkout(30), subscribedAfterCheckout: true }, {}))).toEqual([]);
  });

  it("churned_recent: churned within 3 days, keyed by the subscription", () => {
    const sub = { id: "sub_row", status: "cancelled", lsSubscriptionId: "ls_42" };
    const [task] = evaluateTaskRules(snap({ stage: "churned", stageChangedAt: ago(1) }, { subscription: sub }), NOW);
    expect(task.dedupeKey).toBe("churned_recent:c1:ls_42");
    expect(rules(snap({ stage: "churned", stageChangedAt: ago(4) }, { subscription: sub }))).toEqual([]);
  });

  it("quota_hitter: effective FREE with 3+ quota hits in 7 days", () => {
    expect(rules(snap({ stage: "activated", quotaHits7d: 3 }, {}))).toEqual(["quota_hitter"]);
    expect(rules(snap({ stage: "activated", quotaHits7d: 2 }, {}))).toEqual([]);
    expect(rules(snap({ quotaHits7d: 5 }, { plan: "PRO", planExpiresAt: ahead(60) }))).not.toContain("quota_hitter");
    // A lapsed grant is FREE again.
    expect(rules(snap({ quotaHits7d: 5 }, { plan: "PRO", planExpiresAt: ago(2) }))).toContain("quota_hitter");
  });

  it("testimonial_ask: customer or power user with 20+ documents and no testimonial tag", () => {
    expect(rules(snap({ stage: "power_user" }, { documentCount: 25 }))).toEqual(["testimonial_ask"]);
    expect(rules(snap({ stage: "power_user", tags: ["testimonial"] }, { documentCount: 25 }))).toEqual([]);
    expect(rules(snap({ stage: "power_user" }, { documentCount: 19 }))).toEqual([]);
    const [task] = evaluateTaskRules(snap({ stage: "power_user" }, { documentCount: 25 }), NOW);
    expect(task.dedupeKey).toBe("testimonial_ask:c1:2026-Q4");
    expect(task.priority).toBe("low");
  });
});

function row(over: Partial<CandidateRow> = {}): CandidateRow {
  return {
    id: "c1",
    stage: "engaged_lead",
    score: 72,
    stageChangedAt: null,
    lastActiveAt: null,
    tags: [],
    user: null,
    events: [],
    ...over,
  } as CandidateRow;
}

describe("toSnapshot", () => {
  it("merges tags, counts quota hits and pairs a checkout with a later subscription", () => {
    const s = toSnapshot(
      row({
        tags: [{ tag: { name: "Testimonial " } }],
        events: [
          { id: "e3", type: "subscription_started", occurredAt: ago(1), props: null },
          { id: "e2", type: "checkout_started", occurredAt: ago(2), props: { plan: "TEAM" } },
          { id: "e1", type: "quota_hit", occurredAt: ago(3), props: null },
        ],
      })
    );
    expect(s.tags).toEqual(["testimonial"]);
    expect(s.quotaHits7d).toBe(1);
    expect(s.lastCheckout).toEqual({ id: "e2", at: ago(2), plan: "TEAM" });
    expect(s.subscribedAfterCheckout).toBe(true);
  });
});

describe("runAutoTaskRules", () => {
  beforeEach(() => {
    state.tasks.clear();
    state.createManyCalls.length = 0;
    state.rows = [row(), row({ id: "c2", stage: "lead", score: 10 })];
  });

  it("creates each task once across repeated runs in the same cycle", async () => {
    expect(await runAutoTaskRules(NOW)).toEqual({ created: 1 });
    expect(await runAutoTaskRules(new Date(NOW.getTime() + 3600_000))).toEqual({ created: 0 });
    expect(await runAutoTaskRules(new Date("2026-10-11T22:00:00Z"))).toEqual({ created: 0 }); // Sunday, same ISO week
    expect([...state.tasks.keys()]).toEqual(["hot_lead:c1:2026-W41"]);
    expect(state.createManyCalls.every((c) => c.skipDuplicates === true)).toBe(true);
  });

  it("creates a new task when the cycle moves on", async () => {
    await runAutoTaskRules(NOW);
    expect(await runAutoTaskRules(new Date("2026-10-12T09:00:00Z"))).toEqual({ created: 1 });
    expect([...state.tasks.keys()].sort()).toEqual(["hot_lead:c1:2026-W41", "hot_lead:c1:2026-W42"]);
  });

  it("writes rule tasks with their source, rule key and system author", async () => {
    await runAutoTaskRules(NOW);
    const task = state.tasks.get("hot_lead:c1:2026-W41");
    expect(task).toMatchObject({ contactId: "c1", source: "rule", ruleKey: "hot_lead", status: "open", createdBy: "system", priority: "normal" });
  });

  it("does nothing when no contact matches", async () => {
    state.rows = [];
    expect(await runAutoTaskRules(NOW)).toEqual({ created: 0 });
    expect(state.createManyCalls).toHaveLength(0);
  });
});
