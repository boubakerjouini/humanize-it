// ===========================================================
// lib/crm/metrics.ts — Numbers for /admin/funnel.
//
// The funnel is lead → signup → activated → paying, cut by first-touch channel
// and by lead source. "Activated" means a first document within 7 days of
// signup. Cohorts are by when a contact was first created, so a lead captured
// in the window who signed up later still counts for its source. Every query
// on a growth table falls back to empty, so the page renders on a database
// that lacks them. Signup series and `since` come from lib/admin-metrics.ts.
// ===========================================================

import { db } from "@/lib/db";
import { since, type DayPoint } from "@/lib/admin-metrics";
import { MAGNET_SLUGS, PUBLIC_LEAD_SOURCES } from "@/lib/growth/constants";
import { outreachDailyGoal } from "@/lib/growth/flags";
import { FOUNDER_SERVICE_KINDS, monthStartUtc, type FounderService } from "@/lib/plans";
import { foundingSold as countFoundingSold } from "@/app/api/offers/shared";

const DAY_MS = 86_400_000;
const ACTIVATION_DAYS = 7;
const PAYING_STATUSES = ["active", "on_trial", "past_due"];
const LEAD_SOURCES = [...PUBLIC_LEAD_SOURCES] as string[];
/** Bounds for the per-contact scans; far above today's volume. */
const MAX_ROWS = 5000;

export const FOUNDING_CAP = 100;

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Zero-filled daily series ending today (UTC), oldest first. */
function zeroFill(counts: Map<string, number>, days: number): DayPoint[] {
  const out: DayPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = dayKey(since(i));
    out.push({ day, count: counts.get(day) ?? 0 });
  }
  return out;
}

function countByDay(dates: Date[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const d of dates) map.set(dayKey(d), (map.get(dayKey(d)) ?? 0) + 1);
  return map;
}

const activatedWithin = (firstDocumentAt: Date | null, signedUpAt: Date | null | undefined) =>
  !!firstDocumentAt && !!signedUpAt && firstDocumentAt.getTime() - signedUpAt.getTime() <= ACTIVATION_DAYS * DAY_MS;

// ── Funnel KPIs ─────────────────────────────────────────────────────────────

export type FunnelCounts = {
  leads: number;
  leadsConfirmed: number;
  signups: number;
  activated: number;
  newPaying: number;
};

async function funnelBetween(from: Date, to: Date): Promise<FunnelCounts> {
  const window = { gte: from, lt: to };
  const [leads, leadsConfirmed, signups, signupContacts, payingEvents] = await Promise.all([
    db.contact.count({ where: { source: { in: LEAD_SOURCES }, createdAt: window } }).catch(() => 0),
    db.contact.count({ where: { source: { in: LEAD_SOURCES }, createdAt: window, emailVerifiedAt: { not: null } } }).catch(() => 0),
    db.user.count({ where: { createdAt: window } }),
    db.contact
      .findMany({
        where: { user: { is: { createdAt: window } }, firstDocumentAt: { not: null } },
        select: { firstDocumentAt: true, user: { select: { createdAt: true } } },
        take: MAX_ROWS,
      })
      .catch(() => []),
    db.contactEvent
      .findMany({ where: { type: "subscription_started", occurredAt: window }, select: { contactId: true }, distinct: ["contactId"] })
      .catch(() => []),
  ]);
  return {
    leads,
    leadsConfirmed,
    signups,
    activated: signupContacts.filter((c) => activatedWithin(c.firstDocumentAt, c.user?.createdAt)).length,
    newPaying: payingEvents.length,
  };
}

/** This period and the one before it, for the KPI deltas. */
export async function getFunnel(days: number): Promise<{ current: FunnelCounts; previous: FunnelCounts }> {
  const [current, previous] = await Promise.all([funnelBetween(since(days), new Date()), funnelBetween(since(days * 2), since(days))]);
  return { current, previous };
}

// ── Attribution tables ──────────────────────────────────────────────────────

export type AttributionRow = {
  key: string;
  people: number;
  leads: number;
  signups: number;
  activated: number;
  paying: number;
};

/**
 * People who first showed up in the window, grouped by first-touch channel or
 * by lead source: how many came in as leads, signed up, activated and pay now.
 * "First showed up" is the earlier of the contact's and the account's creation,
 * so an old account whose contact the backfill created today isn't counted as new.
 */
export async function getAttributionTable(days: number, by: "channel" | "source"): Promise<AttributionRow[]> {
  const from = since(days);
  const rows = await db.contact
    .findMany({
      where: { createdAt: { gte: from }, OR: [{ userId: null }, { user: { is: { createdAt: { gte: from } } } }] },
      select: {
        source: true,
        channel: true,
        firstDocumentAt: true,
        user: {
          select: {
            createdAt: true,
            subscription: { select: { status: true } },
            memberships: { where: { seatActive: true }, select: { organization: { select: { lsSubscriptionId: true, status: true } } } },
          },
        },
      },
      take: MAX_ROWS,
    })
    .catch(() => []);

  const table = new Map<string, AttributionRow>();
  for (const c of rows) {
    const key = (by === "channel" ? c.channel : c.source) ?? "unknown";
    const row = table.get(key) ?? { key, people: 0, leads: 0, signups: 0, activated: 0, paying: 0 };
    row.people++;
    if (LEAD_SOURCES.includes(c.source)) row.leads++;
    if (c.user) {
      row.signups++;
      if (activatedWithin(c.firstDocumentAt, c.user.createdAt)) row.activated++;
      const subPaying = !!c.user.subscription && PAYING_STATUSES.includes(c.user.subscription.status);
      const seatPaying = c.user.memberships.some((m) => !!m.organization.lsSubscriptionId && PAYING_STATUSES.includes(m.organization.status));
      if (subPaying || seatPaying) row.paying++;
    }
    table.set(key, row);
  }
  return [...table.values()].sort((a, b) => b.people - a.people || a.key.localeCompare(b.key));
}

/** Column totals of an attribution table: the period's cohort funnel. */
export function cohortTotals(rows: readonly AttributionRow[]): Omit<AttributionRow, "key"> {
  return rows.reduce(
    (t, r) => ({ people: t.people + r.people, leads: t.leads + r.leads, signups: t.signups + r.signups, activated: t.activated + r.activated, paying: t.paying + r.paying }),
    { people: 0, leads: 0, signups: 0, activated: 0, paying: 0 }
  );
}

// ── Magnets ─────────────────────────────────────────────────────────────────

export type MagnetRow = { slug: string; captures: number; confirmed: number; signups: number };

/** Per lead magnet: people who asked for it in the window, how many confirmed, how many signed up. */
export async function getMagnetTable(days: number): Promise<MagnetRow[]> {
  const from = since(days);
  const [events, contacts] = await Promise.all([
    db.contactEvent
      .findMany({
        where: { type: "lead_captured", occurredAt: { gte: from } },
        select: { contactId: true, props: true, contact: { select: { emailVerifiedAt: true, userId: true } } },
        take: MAX_ROWS,
      })
      .catch(() => []),
    // Fallback for captures recorded without a magnet prop: the magnets array on new contacts.
    db.contact
      .findMany({
        where: { createdAt: { gte: from }, magnets: { isEmpty: false } },
        select: { id: true, magnets: true, emailVerifiedAt: true, userId: true },
        take: MAX_ROWS,
      })
      .catch(() => []),
  ]);

  const people = new Map<string, Map<string, { verified: boolean; user: boolean }>>();
  const add = (slug: string, id: string, verified: boolean, user: boolean) => {
    const set = people.get(slug) ?? new Map();
    set.set(id, { verified, user });
    people.set(slug, set);
  };
  for (const e of events) {
    const props = e.props && typeof e.props === "object" && !Array.isArray(e.props) ? (e.props as Record<string, unknown>) : {};
    if (typeof props.magnet === "string") add(props.magnet, e.contactId, !!e.contact.emailVerifiedAt, !!e.contact.userId);
  }
  for (const c of contacts) for (const slug of c.magnets) add(slug, c.id, !!c.emailVerifiedAt, !!c.userId);

  return MAGNET_SLUGS.map((slug) => {
    const set = [...(people.get(slug)?.values() ?? [])];
    return { slug, captures: set.length, confirmed: set.filter((p) => p.verified).length, signups: set.filter((p) => p.user).length };
  });
}

// ── Sequences ───────────────────────────────────────────────────────────────

export type SequenceRow = { key: string; enrolled: number; sent: number; notSent: number; converted: number };

const SENT = new Set(["sent", "delivered"]);

export async function getSequenceStats(days: number): Promise<SequenceRow[]> {
  const from = since(days);
  const [messages, enrolled, converted] = await Promise.all([
    db.emailMessage
      .groupBy({ by: ["sequenceKey", "status"], where: { sequenceKey: { not: null }, queuedAt: { gte: from } }, _count: { _all: true } })
      .catch(() => []),
    db.sequenceEnrollment.groupBy({ by: ["sequenceKey"], where: { enrolledAt: { gte: from } }, _count: { _all: true } }).catch(() => []),
    db.sequenceEnrollment
      .groupBy({ by: ["sequenceKey"], where: { exitReason: "converted", exitedAt: { gte: from } }, _count: { _all: true } })
      .catch(() => []),
  ]);
  const table = new Map<string, SequenceRow>();
  const row = (key: string) => table.get(key) ?? { key, enrolled: 0, sent: 0, notSent: 0, converted: 0 };
  for (const m of messages) {
    if (!m.sequenceKey) continue;
    const r = row(m.sequenceKey);
    if (SENT.has(m.status)) r.sent += m._count._all;
    else r.notSent += m._count._all;
    table.set(m.sequenceKey, r);
  }
  for (const e of enrolled) table.set(e.sequenceKey, { ...row(e.sequenceKey), enrolled: e._count._all });
  for (const e of converted) table.set(e.sequenceKey, { ...row(e.sequenceKey), converted: e._count._all });
  return [...table.values()].sort((a, b) => a.key.localeCompare(b.key));
}

// ── Outreach (Rule of 100) ──────────────────────────────────────────────────

export type OutreachStats = { today: number; goal: number; series: DayPoint[]; streak: number };

/** Today's touches, 30 days of bars, and the run of consecutive days at goal. */
export async function getOutreachStats(days = 30): Promise<OutreachStats> {
  const goal = outreachDailyGoal();
  const touches = await db.contactEvent
    .findMany({ where: { type: "outreach_touch", occurredAt: { gte: since(days) } }, select: { occurredAt: true }, take: 20_000 })
    .catch(() => []);
  const series = zeroFill(countByDay(touches.map((t) => t.occurredAt)), days);
  const today = series[series.length - 1]?.count ?? 0;
  // Today still counts as "in progress": the streak runs through yesterday if today isn't done yet.
  let streak = 0;
  for (let i = series.length - 1; i >= 0; i--) {
    if (series[i].count >= goal) streak++;
    else if (i === series.length - 1) continue;
    else break;
  }
  return { today, goal, series, streak };
}

// ── Leads per day ───────────────────────────────────────────────────────────

export async function getLeadSeries(days: number): Promise<DayPoint[]> {
  const rows = await db.contact
    .findMany({ where: { source: { in: LEAD_SOURCES }, createdAt: { gte: since(days) } }, select: { createdAt: true }, take: MAX_ROWS })
    .catch(() => []);
  return zeroFill(countByDay(rows.map((r) => r.createdAt)), days);
}

// ── Comped expiring ─────────────────────────────────────────────────────────

export type CompedExpiringRow = { userId: string; email: string; name: string | null; plan: string; planExpiresAt: Date; contactId: string | null };

export async function getCompedExpiring(days = 30): Promise<CompedExpiringRow[]> {
  const now = new Date();
  const users = await db.user.findMany({
    where: {
      plan: { not: "FREE" },
      planExpiresAt: { gte: now, lte: new Date(now.getTime() + days * DAY_MS) },
      OR: [{ subscription: { is: null } }, { subscription: { is: { status: { notIn: PAYING_STATUSES } } } }],
    },
    orderBy: { planExpiresAt: "asc" },
    take: 100,
    select: { id: true, email: true, name: true, plan: true, planExpiresAt: true },
  });
  const contacts = await db.contact
    .findMany({ where: { userId: { in: users.map((u) => u.id) } }, select: { id: true, userId: true } })
    .catch(() => []);
  const byUser = new Map(contacts.map((c) => [c.userId, c.id]));
  return users.map((u) => ({ userId: u.id, email: u.email, name: u.name, plan: u.plan, planExpiresAt: u.planExpiresAt as Date, contactId: byUser.get(u.id) ?? null }));
}

// ── Offer and usage ─────────────────────────────────────────────────────────

export type MonthPoint = { month: string; signups: number; cancels: number };

export type OfferStats = {
  /** Same count as the public "{n} of 100 left" counter (survives account deletion). */
  foundingSold: number;
  /** Founder-service requests since the 1st of this UTC month, per kind (each has a monthly cap). */
  servicesThisMonth: Record<FounderService, number>;
  wordPacksSold: number;
  wordPacksInPeriod: number;
  /** Average words used this billing period by users with a paying subscription; null with none. */
  wordsPerPaidUser: number | null;
  paidUsers: number;
  months: MonthPoint[];
  /** Humanize passes aren't stored per rewrite yet; null until they are. */
  avgPassesPerRewrite: number | null;
};

function monthKey(d: Date): string {
  return d.toISOString().slice(0, 7);
}

export async function getOfferStats(days: number, months = 6): Promise<OfferStats> {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1));
  const [foundingSold, services, wordPacksSold, wordPacksInPeriod, paid, signups, cancels] = await Promise.all([
    countFoundingSold().catch(() => 0),
    db.crmTask
      .groupBy({ by: ["kind"], where: { kind: { in: FOUNDER_SERVICE_KINDS }, source: "request", createdAt: { gte: monthStartUtc(now) } }, _count: { _all: true } })
      .catch(() => []),
    db.purchase.count({ where: { kind: "wordpack" } }).catch(() => 0),
    db.purchase.count({ where: { kind: "wordpack", createdAt: { gte: since(days) } } }).catch(() => 0),
    db.user.aggregate({ where: { subscription: { is: { status: { in: PAYING_STATUSES } } } }, _avg: { wordsUsed: true }, _count: { _all: true } }),
    db.user.findMany({ where: { createdAt: { gte: monthStart } }, select: { createdAt: true } }),
    db.contactEvent
      .findMany({ where: { type: "subscription_cancelled", occurredAt: { gte: monthStart } }, select: { occurredAt: true } })
      .catch(() => []),
  ]);

  const table = new Map<string, MonthPoint>();
  for (let i = 0; i < months; i++) {
    const m = monthKey(new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + i, 1)));
    table.set(m, { month: m, signups: 0, cancels: 0 });
  }
  for (const u of signups) {
    const row = table.get(monthKey(u.createdAt));
    if (row) row.signups++;
  }
  for (const c of cancels) {
    const row = table.get(monthKey(c.occurredAt));
    if (row) row.cancels++;
  }

  const servicesThisMonth = Object.fromEntries(FOUNDER_SERVICE_KINDS.map((k) => [k, 0])) as Record<FounderService, number>;
  for (const row of services) {
    if (row.kind in servicesThisMonth) servicesThisMonth[row.kind as FounderService] = row._count._all;
  }

  return {
    foundingSold,
    servicesThisMonth,
    wordPacksSold,
    wordPacksInPeriod,
    wordsPerPaidUser: paid._count._all > 0 ? Math.round(paid._avg.wordsUsed ?? 0) : null,
    paidUsers: paid._count._all,
    months: [...table.values()],
    avgPassesPerRewrite: null,
  };
}
