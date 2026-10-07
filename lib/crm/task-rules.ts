// ===========================================================
// lib/crm/task-rules.ts — Auto task rules (spec §9.2), run by the daily job.
//
// Each rule is a pure function from a contact snapshot to at most one task
// suggestion. The task's dedupeKey is `${ruleKey}:${contactId}:${cycle}` and
// CrmTask.dedupeKey is unique, so repeated runs (or two overlapping ones)
// create a task at most once per cycle, and a task the founder dismissed stays
// dismissed until the next cycle. Rules ignore marketing consent on purpose:
// a task is a personal follow-up the founder decides on, not an email.
// ===========================================================

import { db } from "@/lib/db";
import type { Prisma } from "@/app/generated/prisma/client";
import { PLANS, type PlanId } from "@/lib/plans";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
/** Statuses that count as paying (past_due is still a customer, at risk). */
const PAYING_STATUSES = ["active", "on_trial", "past_due"];
const MAX_CANDIDATES = 2000;

export const TASK_RULE_KEYS = [
  "comped_expiring",
  "paid_inactive",
  "hot_lead",
  "checkout_abandoned",
  "churned_recent",
  "quota_hitter",
  "testimonial_ask",
] as const;
export type TaskRuleKey = (typeof TASK_RULE_KEYS)[number];

export const TASK_RULE_LABELS: Record<TaskRuleKey, string> = {
  comped_expiring: "Comped plan ending",
  paid_inactive: "Paying, inactive",
  hot_lead: "Hot lead",
  checkout_abandoned: "Abandoned checkout",
  churned_recent: "Just churned",
  quota_hitter: "Keeps hitting the limit",
  testimonial_ask: "Testimonial ask",
};

export type TaskPriority = "low" | "normal" | "high";

export type TaskRuleSnapshot = {
  contactId: string;
  stage: string;
  score: number;
  stageChangedAt: Date | null;
  lastActiveAt: Date | null;
  /** Lower-cased tag names from both ContactTag and UserTag. */
  tags: string[];
  user: {
    plan: string;
    planExpiresAt: Date | null;
    createdAt: Date;
    documentCount: number;
    subscription: { id: string; status: string; lsSubscriptionId: string | null } | null;
    /** Holds an active seat in a paying organization. */
    payingOrgSeat: boolean;
  } | null;
  quotaHits7d: number;
  /** The most recent checkout_started event. */
  lastCheckout: { id: string; at: Date; plan: string | null } | null;
  /** A subscription_started event happened after lastCheckout. */
  subscribedAfterCheckout: boolean;
};

export type TaskSuggestion = {
  ruleKey: TaskRuleKey;
  contactId: string;
  cycle: string;
  dedupeKey: string;
  title: string;
  kind: "follow_up" | "outreach" | "email";
  priority: TaskPriority;
};

export function taskDedupeKey(ruleKey: string, contactId: string, cycle: string): string {
  return `${ruleKey}:${contactId}:${cycle}`;
}

/** ISO 8601 week, e.g. "2026-W41" (weeks start on Monday, UTC). */
export function isoWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const weekday = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - weekday); // Thursday decides the year
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart) / DAY_MS + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Calendar quarter, e.g. "2026-Q4" (UTC). */
export function quarterOf(date: Date): string {
  return `${date.getUTCFullYear()}-Q${Math.floor(date.getUTCMonth() / 3) + 1}`;
}

const isoDay = (date: Date) => date.toISOString().slice(0, 10);
const shortDate = (date: Date) => date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const planName = (plan: string | null | undefined) => (plan && plan in PLANS ? PLANS[plan as PlanId].name : (plan ?? "plan"));

function isPaying(s: TaskRuleSnapshot): boolean {
  const status = s.user?.subscription?.status;
  return (!!status && PAYING_STATUSES.includes(status)) || !!s.user?.payingOrgSeat;
}

/** A plan that is not FREE and has not lapsed (lapsed grants are FREE). */
function effectivePaidPlan(s: TaskRuleSnapshot, now: Date): boolean {
  const u = s.user;
  if (!u || u.plan === "FREE") return false;
  return !u.planExpiresAt || u.planExpiresAt.getTime() >= now.getTime();
}

function daysSince(at: Date | null, now: Date): number | null {
  return at ? Math.floor((now.getTime() - at.getTime()) / DAY_MS) : null;
}

type Rule = (s: TaskRuleSnapshot, now: Date) => Omit<TaskSuggestion, "ruleKey" | "contactId" | "dedupeKey"> | null;

export const TASK_RULES: Record<TaskRuleKey, Rule> = {
  comped_expiring: (s, now) => {
    const u = s.user;
    if (!u?.planExpiresAt || !effectivePaidPlan(s, now) || isPaying(s)) return null;
    if (u.planExpiresAt.getTime() - now.getTime() > 14 * DAY_MS) return null;
    return {
      cycle: isoDay(u.planExpiresAt),
      title: `Personal email: ${planName(u.plan)} access ends ${shortDate(u.planExpiresAt)} (Script D)`,
      kind: "email",
      priority: "high",
    };
  },
  paid_inactive: (s, now) => {
    if (!s.user || !isPaying(s)) return null;
    const idle = daysSince(s.lastActiveAt ?? s.user.createdAt, now);
    if (idle === null || idle < 10) return null;
    return { cycle: isoWeek(now), title: `Check in personally: paying user inactive ${idle} days`, kind: "follow_up", priority: "high" };
  },
  hot_lead: (s, now) => {
    if (s.user || (s.stage !== "lead" && s.stage !== "engaged_lead") || s.score < 60) return null;
    return { cycle: isoWeek(now), title: `Reach out: hot lead (${s.score})`, kind: "outreach", priority: "normal" };
  },
  checkout_abandoned: (s, now) => {
    const c = s.lastCheckout;
    if (!c || s.subscribedAfterCheckout || isPaying(s)) return null;
    const age = now.getTime() - c.at.getTime();
    if (age < 24 * HOUR_MS || age > 72 * HOUR_MS) return null;
    return { cycle: c.id, title: `Follow up on abandoned ${planName(c.plan)} checkout`, kind: "follow_up", priority: "high" };
  },
  churned_recent: (s, now) => {
    if (s.stage !== "churned" || !s.stageChangedAt) return null;
    if (now.getTime() - s.stageChangedAt.getTime() > 3 * DAY_MS) return null;
    const sub = s.user?.subscription;
    return {
      cycle: sub?.lsSubscriptionId ?? sub?.id ?? isoDay(s.stageChangedAt),
      title: "Ask why they cancelled (1:1)",
      kind: "email",
      priority: "high",
    };
  },
  quota_hitter: (s, now) => {
    if (!s.user || effectivePaidPlan(s, now) || isPaying(s) || s.quotaHits7d < 3) return null;
    return { cycle: isoWeek(now), title: "Offer a 7-day Pro pass personally", kind: "outreach", priority: "normal" };
  },
  testimonial_ask: (s, now) => {
    if (!s.user || !(isPaying(s) || s.stage === "power_user")) return null;
    if (s.user.documentCount < 20 || s.tags.includes("testimonial")) return null;
    return { cycle: quarterOf(now), title: "Ask for a 2-sentence testimonial (Script E)", kind: "email", priority: "low" };
  },
};

/** Every task the rules would create for this contact right now. */
export function evaluateTaskRules(s: TaskRuleSnapshot, now: Date): TaskSuggestion[] {
  const out: TaskSuggestion[] = [];
  for (const ruleKey of TASK_RULE_KEYS) {
    const hit = TASK_RULES[ruleKey](s, now);
    if (hit) out.push({ ...hit, ruleKey, contactId: s.contactId, dedupeKey: taskDedupeKey(ruleKey, s.contactId, hit.cycle) });
  }
  return out;
}

// ── Loading ─────────────────────────────────────────────────────────────────

function candidateSelect(now: Date) {
  return {
    id: true,
    stage: true,
    score: true,
    stageChangedAt: true,
    lastActiveAt: true,
    tags: { select: { tag: { select: { name: true } } } },
    user: {
      select: {
        plan: true,
        planExpiresAt: true,
        createdAt: true,
        subscription: { select: { id: true, status: true, lsSubscriptionId: true } },
        memberships: { where: { seatActive: true }, select: { organization: { select: { lsSubscriptionId: true, status: true } } } },
        tags: { select: { tag: { select: { name: true } } } },
        _count: { select: { documents: true } },
      },
    },
    events: {
      where: { type: { in: ["checkout_started", "subscription_started", "quota_hit"] }, occurredAt: { gte: new Date(now.getTime() - 7 * DAY_MS) } },
      select: { id: true, type: true, occurredAt: true, props: true },
      orderBy: { occurredAt: "desc" as const },
      take: 100,
    },
  } satisfies Prisma.ContactSelect;
}

export type CandidateRow = Prisma.ContactGetPayload<{ select: ReturnType<typeof candidateSelect> }>;

/** Contacts that could match at least one rule; the rules make the final call. */
function candidateWhere(now: Date): Prisma.ContactWhereInput {
  const paying = { in: PAYING_STATUSES };
  return {
    OR: [
      { user: { is: { plan: { not: "FREE" }, planExpiresAt: { gte: now, lte: new Date(now.getTime() + 14 * DAY_MS) } } } },
      { user: { is: { subscription: { is: { status: paying } } } } },
      {
        user: {
          is: { memberships: { some: { seatActive: true, organization: { is: { lsSubscriptionId: { not: null }, status: paying } } } } },
        },
      },
      { userId: null, stage: { in: ["lead", "engaged_lead"] }, score: { gte: 60 } },
      {
        events: {
          some: {
            type: "checkout_started",
            occurredAt: { gte: new Date(now.getTime() - 72 * HOUR_MS), lte: new Date(now.getTime() - 24 * HOUR_MS) },
          },
        },
      },
      { stage: "churned", stageChangedAt: { gte: new Date(now.getTime() - 3 * DAY_MS) } },
      { events: { some: { type: "quota_hit", occurredAt: { gte: new Date(now.getTime() - 7 * DAY_MS) } } } },
      { stage: "power_user" },
    ],
  };
}

function propString(props: unknown, key: string): string | null {
  if (!props || typeof props !== "object" || Array.isArray(props)) return null;
  const value = (props as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
}

export function toSnapshot(row: CandidateRow): TaskRuleSnapshot {
  const user = row.user;
  const tags = [...row.tags, ...(user?.tags ?? [])].map((t) => t.tag.name.trim().toLowerCase());
  const checkout = row.events.find((e) => e.type === "checkout_started") ?? null;
  return {
    contactId: row.id,
    stage: row.stage,
    score: row.score,
    stageChangedAt: row.stageChangedAt,
    lastActiveAt: row.lastActiveAt,
    tags: [...new Set(tags)],
    user: user
      ? {
          plan: user.plan,
          planExpiresAt: user.planExpiresAt,
          createdAt: user.createdAt,
          documentCount: user._count.documents,
          subscription: user.subscription,
          payingOrgSeat: user.memberships.some(
            (m) => !!m.organization.lsSubscriptionId && PAYING_STATUSES.includes(m.organization.status)
          ),
        }
      : null,
    quotaHits7d: row.events.filter((e) => e.type === "quota_hit").length,
    lastCheckout: checkout ? { id: checkout.id, at: checkout.occurredAt, plan: propString(checkout.props, "plan") } : null,
    subscribedAfterCheckout: !!checkout && row.events.some((e) => e.type === "subscription_started" && e.occurredAt > checkout.occurredAt),
  };
}

/** Create the rule-generated CRM tasks that are due. Returns how many were created. */
export async function runAutoTaskRules(now: Date): Promise<{ created: number }> {
  const rows = await db.contact.findMany({
    where: candidateWhere(now),
    select: candidateSelect(now),
    orderBy: { id: "asc" },
    take: MAX_CANDIDATES,
  });
  const suggestions = rows.flatMap((row) => evaluateTaskRules(toSnapshot(row), now));
  if (suggestions.length === 0) return { created: 0 };
  // skipDuplicates + the unique dedupeKey make this idempotent across runs.
  const res = await db.crmTask.createMany({
    data: suggestions.map((t) => ({
      contactId: t.contactId,
      title: t.title,
      kind: t.kind,
      priority: t.priority,
      status: "open",
      dueAt: now,
      source: "rule",
      ruleKey: t.ruleKey,
      dedupeKey: t.dedupeKey,
      createdBy: "system",
    })),
    skipDuplicates: true,
  });
  return { created: res.count };
}
