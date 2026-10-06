// ===========================================================
// lib/crm/segments.ts — Contact segments (pure).
//
// A SegmentFilter is a small JSON rule list validated with zod. compileSegment
// turns it into a Prisma ContactWhereInput, so the contacts list, campaign
// targeting and the system segments share one compile path. Only *types* come
// from the generated Prisma client, which keeps this module free of the DB
// client and testable.
// ===========================================================

import { z } from "zod";
import type { Prisma } from "@/app/generated/prisma/client";
import { EMAIL_STATUSES, EVENT_TYPES, PIPELINE_STAGES, TOPICS } from "@/lib/growth/constants";
import { STAGES } from "@/lib/crm/lifecycle";

const DAY_MS = 24 * 60 * 60 * 1000;
export const MAX_SEGMENT_RULES = 20;

const days = z.number().int().min(1).max(3650);
const shortText = z.string().trim().min(1).max(100);
const textList = z.array(shortText).min(1).max(50);

const CONTACT_DATE_FIELDS = ["createdAt", "lastActiveAt", "lastEmailedAt", "firstDocumentAt"] as const;
const DATE_FIELDS = [...CONTACT_DATE_FIELDS, "signedUpAt"] as const;
const TEXT_FIELDS = ["channel", "source", "utmSource", "utmCampaign", "magnet"] as const;

export const segmentRuleSchema = z.union([
  z.object({ field: z.literal("type"), op: z.literal("is"), value: z.enum(["user", "lead", "prospect"]) }),
  z.object({ field: z.literal("stage"), op: z.enum(["in", "not_in"]), value: z.array(z.enum(STAGES)).min(1).max(STAGES.length) }),
  z.object({
    field: z.literal("pipelineStage"),
    op: z.enum(["in", "not_in"]),
    value: z.array(z.enum(PIPELINE_STAGES)).min(1).max(PIPELINE_STAGES.length),
  }),
  z.object({ field: z.literal("pipelineStage"), op: z.enum(["is_null", "not_null"]) }),
  z.object({ field: z.literal("plan"), op: z.literal("in"), value: z.array(z.enum(["FREE", "PRO", "TEAM"])).min(1).max(3) }),
  z.object({ field: z.literal("billing"), op: z.literal("is"), value: z.enum(["paying", "comped", "free"]) }),
  z.object({ field: z.literal("score"), op: z.enum(["gte", "lte"]), value: z.number().int().min(0).max(100) }),
  z.object({ field: z.enum(TEXT_FIELDS), op: z.enum(["in", "not_in"]), value: textList }),
  z.object({ field: z.literal("topic"), op: z.enum(["has", "not_has"]), value: z.enum(TOPICS) }),
  z.object({ field: z.literal("tag"), op: z.enum(["has", "not_has"]), value: z.string().trim().min(1).max(64) }),
  z.object({ field: z.literal("emailStatus"), op: z.literal("in"), value: z.array(z.enum(EMAIL_STATUSES)).min(1).max(EMAIL_STATUSES.length) }),
  z.object({ field: z.enum(DATE_FIELDS), op: z.enum(["within_days", "older_than_days"]), value: days }),
  z.object({ field: z.enum(DATE_FIELDS), op: z.enum(["is_null", "not_null"]) }),
  z.object({ field: z.literal("planExpiresAt"), op: z.literal("within_next_days"), value: days }),
  z.object({
    field: z.literal("event"),
    op: z.enum(["has", "has_not"]),
    value: z.object({ type: z.enum(EVENT_TYPES), withinDays: days.optional() }),
  }),
  z.object({ field: z.literal("search"), op: z.literal("contains"), value: shortText }),
]);

export const segmentFilterSchema = z.object({
  match: z.enum(["all", "any"]),
  rules: z.array(segmentRuleSchema).max(MAX_SEGMENT_RULES),
});

export type SegmentRule = z.infer<typeof segmentRuleSchema>;
export type SegmentFilter = z.infer<typeof segmentFilterSchema>;
export type SegmentField = SegmentRule["field"];

export function parseSegmentFilter(input: unknown): { ok: true; filter: SegmentFilter } | { ok: false; error: string } {
  const parsed = segmentFilterSchema.safeParse(input);
  if (parsed.success) return { ok: true, filter: parsed.data };
  const issue = parsed.error.issues[0];
  const where = issue?.path.length ? ` at ${issue.path.join(".")}` : "";
  return { ok: false, error: `Invalid segment filter${where}: ${issue?.message ?? "unknown error"}` };
}

// ── Compile ─────────────────────────────────────────────────────────────────

/** Statuses that count as a paying subscription (past_due is still a customer). */
const PAYING_STATUSES = ["active", "on_trial", "past_due"];

const ago = (now: Date, n: number) => new Date(now.getTime() - n * DAY_MS);
const ahead = (now: Date, n: number) => new Date(now.getTime() + n * DAY_MS);

/** Effective FREE: stored FREE, or a non-FREE grant that has already expired. */
function effectiveFree(now: Date): Prisma.UserWhereInput {
  return { OR: [{ plan: "FREE" }, { plan: { not: "FREE" }, planExpiresAt: { lt: now } }] };
}

function effectivePlan(plan: "PRO" | "TEAM", now: Date): Prisma.UserWhereInput {
  return { plan, OR: [{ planExpiresAt: null }, { planExpiresAt: { gte: now } }] };
}

function effectiveNotFree(now: Date): Prisma.UserWhereInput {
  return { plan: { not: "FREE" }, OR: [{ planExpiresAt: null }, { planExpiresAt: { gte: now } }] };
}

/** A paying subscription, or a seat in a paying organization (matches the lifecycle "customer" rule). */
function payingUser(): Prisma.UserWhereInput {
  return {
    OR: [
      { subscription: { is: { status: { in: PAYING_STATUSES } } } },
      {
        memberships: {
          some: { seatActive: true, organization: { is: { lsSubscriptionId: { not: null }, status: { in: PAYING_STATUSES } } } },
        },
      },
    ],
  };
}

type DateField = (typeof DATE_FIELDS)[number];
type NullableDateField = Exclude<(typeof CONTACT_DATE_FIELDS)[number], "createdAt">;
type DateOp = "within_days" | "older_than_days" | "is_null" | "not_null";

function onNullableDate(field: NullableDateField, filter: Prisma.DateTimeNullableFilter | null): Prisma.ContactWhereInput {
  switch (field) {
    case "lastActiveAt":
      return { lastActiveAt: filter };
    case "lastEmailedAt":
      return { lastEmailedAt: filter };
    case "firstDocumentAt":
      return { firstDocumentAt: filter };
  }
}

function compileDate(field: DateField, op: DateOp, value: number | undefined, now: Date): Prisma.ContactWhereInput {
  const cutoff = ago(now, value ?? 0);
  if (field === "signedUpAt") {
    // signedUpAt is the user's createdAt; contacts without an account never signed up.
    if (op === "is_null") return { userId: null };
    if (op === "not_null") return { userId: { not: null } };
    return { user: { is: { createdAt: op === "within_days" ? { gte: cutoff } : { lt: cutoff } } } };
  }
  if (field === "createdAt") {
    // Never null: "is null" matches nothing, "not null" matches everyone.
    if (op === "is_null") return { id: { in: [] } };
    if (op === "not_null") return {};
    return { createdAt: op === "within_days" ? { gte: cutoff } : { lt: cutoff } };
  }
  if (op === "is_null") return onNullableDate(field, null);
  if (op === "not_null") return onNullableDate(field, { not: null });
  if (op === "within_days") return onNullableDate(field, { gte: cutoff });
  // "Inactive 14 days" must include people who were never active at all.
  return { OR: [onNullableDate(field, { lt: cutoff }), onNullableDate(field, null)] };
}

type NullableTextField = "channel" | "utmSource" | "utmCampaign";

function onNullableText(field: NullableTextField, filter: Prisma.StringNullableFilter | null): Prisma.ContactWhereInput {
  switch (field) {
    case "channel":
      return { channel: filter };
    case "utmSource":
      return { utmSource: filter };
    case "utmCampaign":
      return { utmCampaign: filter };
  }
}

function compileText(field: (typeof TEXT_FIELDS)[number], op: "in" | "not_in", value: string[]): Prisma.ContactWhereInput {
  if (field === "magnet") {
    return op === "in" ? { magnets: { hasSome: value } } : { NOT: { magnets: { hasSome: value } } };
  }
  if (field === "source") {
    return op === "in" ? { source: { in: value } } : { source: { notIn: value } };
  }
  if (op === "in") return onNullableText(field, { in: value });
  // Nullable columns: "not in [x]" keeps contacts that have no value at all.
  return { OR: [onNullableText(field, { notIn: value }), onNullableText(field, null)] };
}

function hasTag(tagId: string): Prisma.ContactWhereInput {
  return { OR: [{ tags: { some: { tagId } } }, { user: { is: { tags: { some: { tagId } } } } }] };
}

function lacksTag(tagId: string): Prisma.ContactWhereInput {
  return {
    AND: [{ tags: { none: { tagId } } }, { OR: [{ userId: null }, { user: { is: { tags: { none: { tagId } } } } }] }],
  };
}

export function compileRule(rule: SegmentRule, now: Date): Prisma.ContactWhereInput {
  switch (rule.field) {
    case "type":
      if (rule.value === "user") return { userId: { not: null } };
      if (rule.value === "lead") return { userId: null, email: { not: null } };
      return { userId: null, email: null };
    case "stage":
      return rule.op === "in" ? { stage: { in: rule.value } } : { stage: { notIn: rule.value } };
    case "pipelineStage":
      if (!("value" in rule)) return rule.op === "is_null" ? { pipelineStage: null } : { pipelineStage: { not: null } };
      return rule.op === "in"
        ? { pipelineStage: { in: rule.value } }
        : { OR: [{ pipelineStage: { notIn: rule.value } }, { pipelineStage: null }] };
    case "plan":
      return {
        user: { is: { OR: rule.value.map((p) => (p === "FREE" ? effectiveFree(now) : effectivePlan(p, now))) } },
      };
    case "billing":
      if (rule.value === "paying") return { user: { is: payingUser() } };
      if (rule.value === "comped") return { user: { is: { AND: [effectiveNotFree(now), { NOT: payingUser() }] } } };
      return { user: { is: { AND: [effectiveFree(now), { NOT: payingUser() }] } } };
    case "score":
      return { score: rule.op === "gte" ? { gte: rule.value } : { lte: rule.value } };
    case "channel":
    case "source":
    case "utmSource":
    case "utmCampaign":
    case "magnet":
      return compileText(rule.field, rule.op, rule.value);
    case "topic":
      return rule.op === "has"
        ? { subscribedTopics: { has: rule.value } }
        : { NOT: { subscribedTopics: { has: rule.value } } };
    case "tag":
      return rule.op === "has" ? hasTag(rule.value) : lacksTag(rule.value);
    case "emailStatus":
      return { emailStatus: { in: rule.value } };
    case "createdAt":
    case "lastActiveAt":
    case "lastEmailedAt":
    case "firstDocumentAt":
    case "signedUpAt":
      return compileDate(rule.field, rule.op, "value" in rule ? rule.value : undefined, now);
    case "planExpiresAt":
      return { user: { is: { planExpiresAt: { gte: now, lte: ahead(now, rule.value) } } } };
    case "event": {
      const where: Prisma.ContactEventWhereInput = { type: rule.value.type };
      if (rule.value.withinDays) where.occurredAt = { gte: ago(now, rule.value.withinDays) };
      return rule.op === "has" ? { events: { some: where } } : { events: { none: where } };
    }
    case "search": {
      const contains = { contains: rule.value, mode: "insensitive" as const };
      return { OR: [{ email: contains }, { name: contains }, { company: contains }, { handle: contains }] };
    }
  }
}

/** Compile a validated filter. An empty rule list matches every contact. */
export function compileSegment(filter: SegmentFilter, now: Date): Prisma.ContactWhereInput {
  if (filter.rules.length === 0) return {};
  const parts = filter.rules.map((rule) => compileRule(rule, now));
  return filter.match === "all" ? { AND: parts } : { OR: parts };
}

// ── System segments ─────────────────────────────────────────────────────────

export const SYSTEM_SEGMENT_PREFIX = "sys:";

const pastUsersInactive: SegmentRule[] = [
  { field: "type", op: "is", value: "user" },
  { field: "lastActiveAt", op: "older_than_days", value: 14 },
  { field: "billing", op: "is", value: "free" },
];

const SYSTEM_SEGMENT_DEFS = {
  past_users_inactive: {
    name: "Past users, inactive 14d",
    description: "Free users with no activity for 14 days (or never active).",
    filter: { match: "all", rules: pastUsersInactive },
  },
  past_users_tips: {
    name: "Past users who want tips",
    description: "Inactive free users who opted in to tips.",
    filter: { match: "all", rules: [...pastUsersInactive, { field: "topic", op: "has", value: "tips" }] },
  },
  comped: {
    name: "Comped",
    description: "A paid plan through a code or grant, without a paying subscription.",
    filter: { match: "all", rules: [{ field: "billing", op: "is", value: "comped" }] },
  },
  comped_expiring_30d: {
    name: "Comped, expiring in 30 days",
    description: "Comped plans that end within the next 30 days.",
    filter: {
      match: "all",
      rules: [
        { field: "billing", op: "is", value: "comped" },
        { field: "planExpiresAt", op: "within_next_days", value: 30 },
      ],
    },
  },
  hot_leads: {
    name: "Hot leads",
    description: "Leads without an account scoring 60 or more.",
    filter: {
      match: "all",
      rules: [
        { field: "type", op: "is", value: "lead" },
        { field: "score", op: "gte", value: 60 },
      ],
    },
  },
  leads_not_converted: {
    name: "Leads not converted",
    description: "Leads captured more than 7 days ago who have not signed up.",
    filter: {
      match: "all",
      rules: [
        { field: "type", op: "is", value: "lead" },
        { field: "createdAt", op: "older_than_days", value: 7 },
      ],
    },
  },
  tips_subscribers: {
    name: "Tips subscribers",
    description: "Everyone subscribed to tips.",
    filter: { match: "all", rules: [{ field: "topic", op: "has", value: "tips" }] },
  },
  extension_waitlist: {
    name: "Extension waitlist",
    description: "Everyone subscribed to extension launch updates.",
    filter: { match: "all", rules: [{ field: "topic", op: "has", value: "extension_launch" }] },
  },
  quota_hitters_7d: {
    name: "Hit a limit in 7 days",
    description: "Contacts with a quota_hit event in the last 7 days.",
    filter: { match: "all", rules: [{ field: "event", op: "has", value: { type: "quota_hit", withinDays: 7 } }] },
  },
  churned: {
    name: "Churned",
    description: "Former paying customers now on Free.",
    filter: { match: "all", rules: [{ field: "stage", op: "in", value: ["churned"] }] },
  },
  never_activated: {
    name: "Never activated",
    description: "Users who never ran a first document.",
    filter: {
      match: "all",
      rules: [
        { field: "type", op: "is", value: "user" },
        { field: "firstDocumentAt", op: "is_null" },
      ],
    },
  },
  outreach_open: {
    name: "Open outreach",
    description: "Prospects still in play on the outreach pipeline.",
    filter: {
      match: "all",
      rules: [{ field: "pipelineStage", op: "in", value: ["to_contact", "contacted", "replied", "trial_offered"] }],
    },
  },
} satisfies Record<string, { name: string; description: string; filter: SegmentFilter }>;

export type SystemSegmentKey = keyof typeof SYSTEM_SEGMENT_DEFS;
export type SystemSegment = { id: string; key: SystemSegmentKey; name: string; description: string; filter: SegmentFilter };

export const SYSTEM_SEGMENTS: Record<SystemSegmentKey, SystemSegment> = Object.fromEntries(
  (Object.keys(SYSTEM_SEGMENT_DEFS) as SystemSegmentKey[]).map((key) => [
    key,
    { id: `${SYSTEM_SEGMENT_PREFIX}${key}`, key, ...SYSTEM_SEGMENT_DEFS[key] },
  ])
) as Record<SystemSegmentKey, SystemSegment>;

export function isSystemSegmentRef(ref: string): boolean {
  return ref.startsWith(SYSTEM_SEGMENT_PREFIX);
}

export function getSystemSegment(ref: string): SystemSegment | null {
  if (!isSystemSegmentRef(ref)) return null;
  const key = ref.slice(SYSTEM_SEGMENT_PREFIX.length);
  return Object.prototype.hasOwnProperty.call(SYSTEM_SEGMENTS, key) ? SYSTEM_SEGMENTS[key as SystemSegmentKey] : null;
}
