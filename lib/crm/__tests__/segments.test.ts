import {
  MAX_SEGMENT_RULES,
  SYSTEM_SEGMENTS,
  compileRule,
  compileSegment,
  getSystemSegment,
  isSystemSegmentRef,
  parseSegmentFilter,
  segmentFilterSchema,
  type SegmentRule,
} from "@/lib/crm/segments";

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-10-06T12:00:00Z");
const ago = (n: number) => new Date(NOW.getTime() - n * DAY);
const ahead = (n: number) => new Date(NOW.getTime() + n * DAY);
const compile = (rule: SegmentRule) => compileRule(rule, NOW);

const PAYING = {
  OR: [
    { subscription: { is: { status: { in: ["active", "on_trial", "past_due"] } } } },
    {
      memberships: {
        some: {
          seatActive: true,
          organization: { is: { lsSubscriptionId: { not: null }, status: { in: ["active", "on_trial", "past_due"] } } },
        },
      },
    },
  ],
};
const EFFECTIVE_FREE = { OR: [{ plan: "FREE" }, { plan: { not: "FREE" }, planExpiresAt: { lt: NOW } }] };
const EFFECTIVE_NOT_FREE = { plan: { not: "FREE" }, OR: [{ planExpiresAt: null }, { planExpiresAt: { gte: NOW } }] };

describe("compileRule", () => {
  it("type", () => {
    expect(compile({ field: "type", op: "is", value: "user" })).toEqual({ userId: { not: null } });
    expect(compile({ field: "type", op: "is", value: "lead" })).toEqual({ userId: null, email: { not: null } });
    expect(compile({ field: "type", op: "is", value: "prospect" })).toEqual({ userId: null, email: null });
  });

  it("stage", () => {
    expect(compile({ field: "stage", op: "in", value: ["churned", "dormant"] })).toEqual({ stage: { in: ["churned", "dormant"] } });
    expect(compile({ field: "stage", op: "not_in", value: ["customer"] })).toEqual({ stage: { notIn: ["customer"] } });
  });

  it("pipelineStage, with not_in keeping contacts outside the pipeline", () => {
    expect(compile({ field: "pipelineStage", op: "in", value: ["contacted"] })).toEqual({ pipelineStage: { in: ["contacted"] } });
    expect(compile({ field: "pipelineStage", op: "not_in", value: ["won", "lost"] })).toEqual({
      OR: [{ pipelineStage: { notIn: ["won", "lost"] } }, { pipelineStage: null }],
    });
    expect(compile({ field: "pipelineStage", op: "is_null" })).toEqual({ pipelineStage: null });
    expect(compile({ field: "pipelineStage", op: "not_null" })).toEqual({ pipelineStage: { not: null } });
  });

  it("plan uses the effective plan at `now`", () => {
    expect(compile({ field: "plan", op: "in", value: ["FREE"] })).toEqual({ user: { is: { OR: [EFFECTIVE_FREE] } } });
    expect(compile({ field: "plan", op: "in", value: ["PRO", "TEAM"] })).toEqual({
      user: {
        is: {
          OR: [
            { plan: "PRO", OR: [{ planExpiresAt: null }, { planExpiresAt: { gte: NOW } }] },
            { plan: "TEAM", OR: [{ planExpiresAt: null }, { planExpiresAt: { gte: NOW } }] },
          ],
        },
      },
    });
  });

  it("billing", () => {
    expect(compile({ field: "billing", op: "is", value: "paying" })).toEqual({ user: { is: PAYING } });
    expect(compile({ field: "billing", op: "is", value: "comped" })).toEqual({ user: { is: { AND: [EFFECTIVE_NOT_FREE, { NOT: PAYING }] } } });
    expect(compile({ field: "billing", op: "is", value: "free" })).toEqual({ user: { is: { AND: [EFFECTIVE_FREE, { NOT: PAYING }] } } });
  });

  it("score", () => {
    expect(compile({ field: "score", op: "gte", value: 60 })).toEqual({ score: { gte: 60 } });
    expect(compile({ field: "score", op: "lte", value: 10 })).toEqual({ score: { lte: 10 } });
  });

  it("text fields, with not_in keeping nulls on nullable columns", () => {
    expect(compile({ field: "channel", op: "in", value: ["social"] })).toEqual({ channel: { in: ["social"] } });
    expect(compile({ field: "channel", op: "not_in", value: ["paid"] })).toEqual({ OR: [{ channel: { notIn: ["paid"] } }, { channel: null }] });
    expect(compile({ field: "utmSource", op: "in", value: ["reddit"] })).toEqual({ utmSource: { in: ["reddit"] } });
    expect(compile({ field: "utmCampaign", op: "not_in", value: ["x"] })).toEqual({
      OR: [{ utmCampaign: { notIn: ["x"] } }, { utmCampaign: null }],
    });
    expect(compile({ field: "source", op: "in", value: ["signup"] })).toEqual({ source: { in: ["signup"] } });
    expect(compile({ field: "source", op: "not_in", value: ["manual"] })).toEqual({ source: { notIn: ["manual"] } });
  });

  it("magnet", () => {
    expect(compile({ field: "magnet", op: "in", value: ["ai-detection-field-guide"] })).toEqual({
      magnets: { hasSome: ["ai-detection-field-guide"] },
    });
    expect(compile({ field: "magnet", op: "not_in", value: ["false-ai-flag-appeal-kit"] })).toEqual({
      NOT: { magnets: { hasSome: ["false-ai-flag-appeal-kit"] } },
    });
  });

  it("topic", () => {
    expect(compile({ field: "topic", op: "has", value: "tips" })).toEqual({ subscribedTopics: { has: "tips" } });
    expect(compile({ field: "topic", op: "not_has", value: "extension_launch" })).toEqual({
      NOT: { subscribedTopics: { has: "extension_launch" } },
    });
  });

  it("tag matches a ContactTag OR the linked user's UserTag", () => {
    expect(compile({ field: "tag", op: "has", value: "tag1" })).toEqual({
      OR: [{ tags: { some: { tagId: "tag1" } } }, { user: { is: { tags: { some: { tagId: "tag1" } } } } }],
    });
    expect(compile({ field: "tag", op: "not_has", value: "tag1" })).toEqual({
      AND: [{ tags: { none: { tagId: "tag1" } } }, { OR: [{ userId: null }, { user: { is: { tags: { none: { tagId: "tag1" } } } } }] }],
    });
  });

  it("emailStatus", () => {
    expect(compile({ field: "emailStatus", op: "in", value: ["bounced", "complained"] })).toEqual({
      emailStatus: { in: ["bounced", "complained"] },
    });
  });

  it("nullable activity dates: older_than includes contacts never active", () => {
    expect(compile({ field: "lastActiveAt", op: "within_days", value: 7 })).toEqual({ lastActiveAt: { gte: ago(7) } });
    expect(compile({ field: "lastActiveAt", op: "older_than_days", value: 14 })).toEqual({
      OR: [{ lastActiveAt: { lt: ago(14) } }, { lastActiveAt: null }],
    });
    expect(compile({ field: "lastEmailedAt", op: "older_than_days", value: 3 })).toEqual({
      OR: [{ lastEmailedAt: { lt: ago(3) } }, { lastEmailedAt: null }],
    });
    expect(compile({ field: "firstDocumentAt", op: "is_null" })).toEqual({ firstDocumentAt: null });
    expect(compile({ field: "firstDocumentAt", op: "not_null" })).toEqual({ firstDocumentAt: { not: null } });
  });

  it("createdAt is never null", () => {
    expect(compile({ field: "createdAt", op: "within_days", value: 30 })).toEqual({ createdAt: { gte: ago(30) } });
    expect(compile({ field: "createdAt", op: "older_than_days", value: 7 })).toEqual({ createdAt: { lt: ago(7) } });
    expect(compile({ field: "createdAt", op: "is_null" })).toEqual({ id: { in: [] } });
    expect(compile({ field: "createdAt", op: "not_null" })).toEqual({});
  });

  it("signedUpAt maps to user.createdAt", () => {
    expect(compile({ field: "signedUpAt", op: "within_days", value: 7 })).toEqual({ user: { is: { createdAt: { gte: ago(7) } } } });
    expect(compile({ field: "signedUpAt", op: "older_than_days", value: 30 })).toEqual({ user: { is: { createdAt: { lt: ago(30) } } } });
    expect(compile({ field: "signedUpAt", op: "is_null" })).toEqual({ userId: null });
    expect(compile({ field: "signedUpAt", op: "not_null" })).toEqual({ userId: { not: null } });
  });

  it("planExpiresAt within the next N days", () => {
    expect(compile({ field: "planExpiresAt", op: "within_next_days", value: 30 })).toEqual({
      user: { is: { planExpiresAt: { gte: NOW, lte: ahead(30) } } },
    });
  });

  it("event some / none, with an optional window", () => {
    expect(compile({ field: "event", op: "has", value: { type: "quota_hit", withinDays: 7 } })).toEqual({
      events: { some: { type: "quota_hit", occurredAt: { gte: ago(7) } } },
    });
    expect(compile({ field: "event", op: "has_not", value: { type: "checkout_started" } })).toEqual({
      events: { none: { type: "checkout_started" } },
    });
  });

  it("search is case-insensitive over email, name, company and handle", () => {
    const contains = { contains: "acme", mode: "insensitive" };
    expect(compile({ field: "search", op: "contains", value: "acme" })).toEqual({
      OR: [{ email: contains }, { name: contains }, { company: contains }, { handle: contains }],
    });
  });
});

describe("compileSegment", () => {
  const a: SegmentRule = { field: "type", op: "is", value: "user" };
  const b: SegmentRule = { field: "score", op: "gte", value: 30 };

  it("ANDs rules for match=all and ORs them for match=any", () => {
    expect(compileSegment({ match: "all", rules: [a, b] }, NOW)).toEqual({ AND: [{ userId: { not: null } }, { score: { gte: 30 } }] });
    expect(compileSegment({ match: "any", rules: [a, b] }, NOW)).toEqual({ OR: [{ userId: { not: null } }, { score: { gte: 30 } }] });
  });

  it("matches everyone with no rules", () => {
    expect(compileSegment({ match: "all", rules: [] }, NOW)).toEqual({});
    expect(compileSegment({ match: "any", rules: [] }, NOW)).toEqual({});
  });
});

describe("validation", () => {
  const ok = (input: unknown) => parseSegmentFilter(input).ok;

  it("accepts a valid filter and trims text", () => {
    const parsed = parseSegmentFilter({ match: "all", rules: [{ field: "search", op: "contains", value: "  acme  " }] });
    expect(parsed).toEqual({ ok: true, filter: { match: "all", rules: [{ field: "search", op: "contains", value: "acme" }] } });
  });

  it("rejects bad rules", () => {
    const bad: unknown[] = [
      { field: "nope", op: "is", value: "x" },
      { field: "type", op: "in", value: "user" },
      { field: "type", op: "is", value: "admin" },
      { field: "stage", op: "in", value: [] },
      { field: "stage", op: "in", value: ["vip"] },
      { field: "score", op: "gte", value: 101 },
      { field: "score", op: "gte", value: "60" },
      { field: "lastActiveAt", op: "older_than_days", value: 1.5 },
      { field: "lastActiveAt", op: "older_than_days", value: 0 },
      { field: "lastActiveAt", op: "within_next_days", value: 3 },
      { field: "planExpiresAt", op: "older_than_days", value: 3 },
      { field: "event", op: "has", value: { type: "made_up_event" } },
      { field: "topic", op: "has", value: "lifecycle" },
      { field: "search", op: "contains", value: "   " },
      { field: "channel", op: "in", value: ["x".repeat(101)] },
    ];
    for (const rule of bad) expect(ok({ match: "all", rules: [rule] })).toBe(false);
  });

  it("rejects a bad match and more than 20 rules", () => {
    const rule = { field: "score", op: "gte", value: 1 };
    expect(ok({ match: "some", rules: [] })).toBe(false);
    expect(ok({ rules: [] })).toBe(false);
    expect(ok({ match: "all", rules: Array(MAX_SEGMENT_RULES).fill(rule) })).toBe(true);
    expect(ok({ match: "all", rules: Array(MAX_SEGMENT_RULES + 1).fill(rule) })).toBe(false);
  });

  it("reports where the problem is", () => {
    const parsed = parseSegmentFilter({ match: "all", rules: [{ field: "score", op: "gte", value: 1 }, { field: "x" }] });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error).toContain("rules.1");
  });
});

describe("system segments", () => {
  it("are valid filters that compile", () => {
    for (const segment of Object.values(SYSTEM_SEGMENTS)) {
      expect(segment.id).toBe(`sys:${segment.key}`);
      expect(segmentFilterSchema.safeParse(segment.filter).success).toBe(true);
      expect(compileSegment(segment.filter, NOW)).toHaveProperty("AND");
    }
  });

  it("include the documented keys", () => {
    expect(Object.keys(SYSTEM_SEGMENTS).sort()).toEqual(
      [
        "churned",
        "comped",
        "comped_expiring_30d",
        "extension_waitlist",
        "hot_leads",
        "leads_not_converted",
        "never_activated",
        "outreach_open",
        "past_users_inactive",
        "past_users_tips",
        "quota_hitters_7d",
        "tips_subscribers",
      ].sort()
    );
  });

  it("compile past_users_tips to the inactive-free-users filter plus the tips topic", () => {
    expect(compileSegment(SYSTEM_SEGMENTS.past_users_tips.filter, NOW)).toEqual({
      AND: [
        { userId: { not: null } },
        { OR: [{ lastActiveAt: { lt: ago(14) } }, { lastActiveAt: null }] },
        { user: { is: { AND: [EFFECTIVE_FREE, { NOT: PAYING }] } } },
        { subscribedTopics: { has: "tips" } },
      ],
    });
  });

  it("resolve refs safely", () => {
    expect(isSystemSegmentRef("sys:hot_leads")).toBe(true);
    expect(isSystemSegmentRef("ckxyz")).toBe(false);
    expect(getSystemSegment("sys:hot_leads")?.name).toBe("Hot leads");
    expect(getSystemSegment("sys:nope")).toBeNull();
    expect(getSystemSegment("sys:__proto__")).toBeNull();
    expect(getSystemSegment("hot_leads")).toBeNull();
  });
});
