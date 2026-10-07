// ===========================================================
// lib/email/sweeps.ts — Who should be in a sequence but isn't (spec §5.4 step 2).
//
// Some sequences start from state rather than an event: a grant about to end,
// a checkout that never finished, a user gone quiet. The daily job finds them
// here. The same candidate finders power the admin "Backfill" (dry run, then
// confirm), so what the dry run counts is exactly what gets enrolled.
// Enrollment is idempotent per (contact, sequence, cycle), so re-running a
// sweep never double-enrolls; a flow that is off costs no query at all.
// ===========================================================

import { db } from "@/lib/db";
import type { Prisma } from "@/app/generated/prisma/client";
import type { SequenceKey } from "@/lib/email/catalog";
import { enroll, isFlowEnabled } from "@/lib/email/enroll";
import { SEQUENCES, lateStepsAt, type EnrollmentContext } from "@/lib/email/sequences";
import { isMagnetSlug } from "@/lib/growth/constants";
import { logGrowthError } from "@/lib/growth/safe";
import { GRANT_EXPIRY_WINDOW_DAYS, QUOTA_UPGRADE_COOLDOWN_DAYS, enrollGrantExpiry, grantDaysFor } from "@/lib/growth/triggers";

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const PAYING_STATUSES = ["active", "on_trial", "past_due"];
const MAX_CANDIDATES = 500;
const WINBACK_INACTIVE_DAYS = 21;
const WINBACK_COOLDOWN_DAYS = 90;
const NURTURE_CONFIRM_WINDOW_DAYS = 14;
/** Onboarding lasts 10 days (founder_checkin at +240h). */
const ONBOARDING_BACKFILL_DAYS = 10;

export type Candidate = {
  contactId: string;
  anchorAt: Date;
  cycle?: string;
  context?: EnrollmentContext;
  cooldownDays?: number;
  /** grant_expiry goes through enrollGrantExpiry (cycle = the expiry). */
  grant?: { planExpiresAt: Date; plan: string; grantDays: number };
};

const notPaying: Prisma.UserWhereInput = { NOT: { subscription: { is: { status: { in: PAYING_STATUSES } } } } };
// Founding 100 buyers hold Pro with a two-year planExpiresAt. That is a purchase,
// not a comped grant, so the grant_expiry copy ("complimentary access") is wrong for them.
const notFounding: Prisma.UserWhereInput = { purchases: { none: { kind: "founding" } } };
const ago = (now: Date, ms: number) => new Date(now.getTime() - ms);

function magnetContext(magnets: readonly string[]): EnrollmentContext {
  const magnet = magnets.find(isMagnetSlug);
  return magnet ? { magnet } : {};
}

// ── Candidate finders ───────────────────────────────────────────────────────

/** Grants ending within [now − 6d, now + 15d], plus grants that already lapsed (planExpiresAt cleared). */
async function grantExpiryCandidates(now: Date): Promise<Candidate[]> {
  const users = await db.user.findMany({
    where: {
      plan: { not: "FREE" },
      planExpiresAt: { gte: ago(now, 6 * DAY_MS), lte: new Date(now.getTime() + GRANT_EXPIRY_WINDOW_DAYS * DAY_MS) },
      ...notPaying,
      ...notFounding,
    },
    select: { id: true, plan: true, planExpiresAt: true, contact: { select: { id: true } } },
    take: MAX_CANDIDATES,
  });
  const out: Candidate[] = [];
  for (const u of users) {
    if (!u.contact || !u.planExpiresAt) continue;
    const grantDays = await grantDaysFor(u.contact.id, u.id);
    out.push({ contactId: u.contact.id, anchorAt: u.planExpiresAt, grant: { planExpiresAt: u.planExpiresAt, plan: u.plan, grantDays } });
  }

  // checkAndResetQuota sets FREE and clears planExpiresAt on the first request
  // after a lapse, so those users only show up through their grant_expired event.
  const lapsed = await db.contactEvent.findMany({
    where: { type: "grant_expired", occurredAt: { gte: ago(now, 6 * DAY_MS) }, contact: { user: { is: { plan: "FREE", planExpiresAt: null, ...notFounding } } } },
    select: { occurredAt: true, props: true, contact: { select: { id: true, userId: true } } },
    orderBy: { occurredAt: "desc" },
    take: MAX_CANDIDATES,
  });
  const seen = new Set(out.map((c) => c.contactId));
  for (const e of lapsed) {
    if (seen.has(e.contact.id) || !e.contact.userId) continue;
    seen.add(e.contact.id);
    const props = e.props as Prisma.JsonObject | null;
    const plan = props?.previousPlan === "TEAM" ? "TEAM" : "PRO";
    out.push({
      contactId: e.contact.id,
      anchorAt: e.occurredAt,
      cycle: `lapsed:${e.occurredAt.toISOString().slice(0, 10)}`,
      context: { plan, grantDays: await grantDaysFor(e.contact.id, e.contact.userId) },
      // An enrollment made before the lapse already covers it.
      cooldownDays: 30,
    });
  }
  return out;
}

/** checkout_started 24–72 hours ago, with no subscription since. */
async function checkoutAbandonedCandidates(now: Date): Promise<Candidate[]> {
  const events = await db.contactEvent.findMany({
    where: {
      type: "checkout_started",
      occurredAt: { gte: ago(now, 72 * HOUR_MS), lte: ago(now, 24 * HOUR_MS) },
      contact: { userId: { not: null }, user: { is: notPaying } },
    },
    select: { id: true, contactId: true, occurredAt: true, props: true },
    orderBy: { occurredAt: "desc" },
    take: MAX_CANDIDATES,
  });
  const out: Candidate[] = [];
  const seen = new Set<string>();
  for (const e of events) {
    if (seen.has(e.contactId)) continue;
    seen.add(e.contactId);
    const subscribed = await db.contactEvent.findFirst({
      where: { contactId: e.contactId, type: "subscription_started", occurredAt: { gte: e.occurredAt } },
      select: { id: true },
    });
    if (subscribed) continue;
    const props = e.props as Prisma.JsonObject | null;
    out.push({
      contactId: e.contactId,
      anchorAt: e.occurredAt,
      cycle: e.id,
      context: { plan: props?.plan === "TEAM" ? "TEAM" : "PRO", checkoutEventId: e.id },
      cooldownDays: 7,
    });
  }
  return out;
}

/** Free users with a first document and no activity for 21 days. */
async function winbackCandidates(now: Date): Promise<Candidate[]> {
  const cutoff = ago(now, WINBACK_INACTIVE_DAYS * DAY_MS);
  const contacts = await db.contact.findMany({
    where: {
      userId: { not: null },
      firstDocumentAt: { not: null },
      OR: [{ lastActiveAt: { lt: cutoff } }, { lastActiveAt: null, firstDocumentAt: { lt: cutoff } }],
      user: { is: { OR: [{ plan: "FREE" }, { planExpiresAt: { lt: now } }], ...notPaying } },
    },
    select: { id: true },
    take: MAX_CANDIDATES,
  });
  const cycle = now.toISOString().slice(0, 7);
  return contacts.map((c) => ({ contactId: c.id, anchorAt: now, cycle, cooldownDays: WINBACK_COOLDOWN_DAYS }));
}

/** Safety net: confirmed tips leads (last 14 days) whose onLeadConfirmed trigger was missed. */
async function leadNurtureCandidates(now: Date): Promise<Candidate[]> {
  const contacts = await db.contact.findMany({
    where: {
      userId: null,
      subscribedTopics: { has: "tips" },
      emailVerifiedAt: { gte: ago(now, NURTURE_CONFIRM_WINDOW_DAYS * DAY_MS) },
      enrollments: { none: { sequenceKey: "lead_nurture" } },
    },
    select: { id: true, emailVerifiedAt: true, magnets: true },
    take: MAX_CANDIDATES,
  });
  return contacts.map((c) => ({ contactId: c.id, anchorAt: c.emailVerifiedAt ?? now, context: magnetContext(c.magnets) }));
}

/** Backfill only: signups from the last 10 days without onboarding. */
async function onboardingCandidates(now: Date): Promise<Candidate[]> {
  const contacts = await db.contact.findMany({
    where: {
      user: { is: { createdAt: { gte: ago(now, ONBOARDING_BACKFILL_DAYS * DAY_MS) } } },
      enrollments: { none: { sequenceKey: "onboarding" } },
    },
    select: { id: true, user: { select: { createdAt: true } } },
    take: MAX_CANDIDATES,
  });
  return contacts.flatMap((c) => (c.user ? [{ contactId: c.id, anchorAt: c.user.createdAt }] : []));
}

/** Backfill only: Free users who hit a limit in the last 3 days. */
async function quotaUpgradeCandidates(now: Date): Promise<Candidate[]> {
  const events = await db.contactEvent.findMany({
    where: {
      type: "quota_hit",
      occurredAt: { gte: ago(now, 3 * DAY_MS) },
      contact: { user: { is: { OR: [{ plan: "FREE" }, { planExpiresAt: { lt: now } }], ...notPaying } } },
    },
    select: { contactId: true, occurredAt: true },
    orderBy: { occurredAt: "desc" },
    take: MAX_CANDIDATES,
  });
  const seen = new Set<string>();
  const out: Candidate[] = [];
  for (const e of events) {
    if (seen.has(e.contactId)) continue;
    seen.add(e.contactId);
    out.push({
      contactId: e.contactId,
      anchorAt: e.occurredAt,
      cycle: e.occurredAt.toISOString().slice(0, 10),
      cooldownDays: QUOTA_UPGRADE_COOLDOWN_DAYS,
    });
  }
  return out;
}

/** Backfill only: extension_launch subscribers without the waitlist sequence. */
async function extensionWaitlistCandidates(now: Date): Promise<Candidate[]> {
  const contacts = await db.contact.findMany({
    where: { subscribedTopics: { has: "extension_launch" }, enrollments: { none: { sequenceKey: "extension_waitlist" } } },
    select: { id: true },
    take: MAX_CANDIDATES,
  });
  return contacts.map((c) => ({ contactId: c.id, anchorAt: now }));
}

const FINDERS: Record<SequenceKey, (now: Date) => Promise<Candidate[]>> = {
  onboarding: onboardingCandidates,
  quota_upgrade: quotaUpgradeCandidates,
  grant_expiry: grantExpiryCandidates,
  winback_inactive: winbackCandidates,
  checkout_abandoned: checkoutAbandonedCandidates,
  lead_nurture: leadNurtureCandidates,
  extension_waitlist: extensionWaitlistCandidates,
};

/** Sequences the daily job sweeps; the others start from triggers and are backfilled by hand. */
export const SWEPT_SEQUENCES: SequenceKey[] = ["grant_expiry", "checkout_abandoned", "winback_inactive", "lead_nurture"];

export function findCandidates(key: SequenceKey, now: Date = new Date()): Promise<Candidate[]> {
  return FINDERS[key](now);
}

/** Enroll candidates; returns how many enrollments were created. */
export async function enrollCandidates(key: SequenceKey, candidates: Candidate[], actor = "system"): Promise<number> {
  let created = 0;
  for (const c of candidates) {
    try {
      const ok = c.grant
        ? await enrollGrantExpiry(c.contactId, c.grant.planExpiresAt, { plan: c.grant.plan, grantDays: c.grant.grantDays, actor })
        : !!(await enroll(c.contactId, key, {
            anchorAt: c.anchorAt,
            steps: SEQUENCES[key].steps,
            cycle: c.cycle,
            context: c.context as Prisma.InputJsonValue | undefined,
            cooldownDays: c.cooldownDays,
            actor,
          }));
      if (ok) created++;
    } catch (err) {
      logGrowthError(`sweep:${key}`, err);
    }
  }
  return created;
}

/** Backfill dry run: how many would enroll, and how many of their steps are already too late to send. */
export async function previewBackfill(key: SequenceKey, now: Date = new Date()): Promise<{ candidates: number; stepsLate: number; stepsToSend: number }> {
  const candidates = await findCandidates(key, now);
  const seq = SEQUENCES[key];
  let stepsLate = 0;
  for (const c of candidates) stepsLate += lateStepsAt(seq, c.anchorAt, now);
  return { candidates: candidates.length, stepsLate, stepsToSend: candidates.length * seq.steps.length - stepsLate };
}

/** Daily job step 2: run every enabled sweep. */
export async function runSweeps(now: Date = new Date(), deadlineMs?: number): Promise<{ enrolled: Partial<Record<SequenceKey, number>>; errors: number }> {
  const enrolled: Partial<Record<SequenceKey, number>> = {};
  let errors = 0;
  for (const key of SWEPT_SEQUENCES) {
    if (deadlineMs && Date.now() > deadlineMs) break;
    try {
      if (!(await isFlowEnabled(key))) continue;
      enrolled[key] = await enrollCandidates(key, await findCandidates(key, now));
    } catch (err) {
      errors++;
      logGrowthError(`sweep:${key}`, err);
    }
  }
  return { enrolled, errors };
}
