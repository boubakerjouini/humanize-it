// ===========================================================
// lib/crm/recompute.ts — Recompute lead score and lifecycle stage.
//
// Loads the facts the pure rules need (lib/crm/scoring.ts, lifecycle.ts),
// resolves the effective plan here (lib/quota.ts is DB-bound, so the pure
// modules take it as data), and writes only rows whose score, breakdown or
// stage changed. A stage change is recorded as a `stage_changed` event.
// recomputeAll() uses grouped aggregates, not one query per contact.
// ===========================================================

import { db } from "@/lib/db";
import type { Prisma } from "@/app/generated/prisma/client";
import { effectivePlanId } from "@/lib/quota";
import { computeStage, type Stage, type StageInput } from "@/lib/crm/lifecycle";
import { computeScore, type ScoreInput, type ScoreResult } from "@/lib/crm/scoring";
import { syncMissingContacts } from "@/lib/crm/contacts";
import { recordEvent } from "@/lib/crm/events";
import { logGrowthError } from "@/lib/growth/safe";

const DAY_MS = 24 * 60 * 60 * 1000;
const PAGE_SIZE = 500;
/** Statuses that count as paying (past_due is still a customer, at risk). */
const PAYING_STATUSES = new Set(["active", "on_trial", "past_due"]);

const scoringSelect = {
  id: true,
  email: true,
  emailVerifiedAt: true,
  magnets: true,
  subscribedTopics: true,
  pendingTopics: true,
  channel: true,
  firstDocumentAt: true,
  lastActiveAt: true,
  unsubscribedAt: true,
  emailStatus: true,
  stageOverride: true,
  stage: true,
  score: true,
  scoreBreakdown: true,
  userId: true,
  user: {
    select: {
      plan: true,
      planExpiresAt: true,
      createdAt: true,
      subscription: { select: { status: true } },
      memberships: {
        where: { seatActive: true },
        select: { organization: { select: { lsSubscriptionId: true, status: true } } },
      },
    },
  },
} satisfies Prisma.ContactSelect;

export type ScoringContact = Prisma.ContactGetPayload<{ select: typeof scoringSelect }>;

export type ActivityCounts = {
  docsLast14d: number;
  humanizedLast30d: number;
  quotaHitsLast30d: number;
  checkoutsLast30d: number;
  referrals: number;
};

export type ScoringInput = { contact: ScoringContact; stage: Omit<StageInput, "score">; score: ScoreInput };
export type Evaluation = { score: ScoreResult; stage: Stage; reason: string };

function olderThan(at: Date | null, days: number, now: Date): boolean {
  return !!at && now.getTime() - at.getTime() > days * DAY_MS;
}

/** Turn a contact plus its activity counts into the inputs of the pure rules. */
export function buildScoringInput(contact: ScoringContact, activity: ActivityCounts, now: Date): ScoringInput {
  const user = contact.user;
  const subscriptionStatus = user?.subscription?.status ?? null;
  const orgSeatActive = !!user?.memberships.some(
    (m) => !!m.organization.lsSubscriptionId && PAYING_STATUSES.has(m.organization.status)
  );
  const hasActiveSubscription = (subscriptionStatus !== null && PAYING_STATUSES.has(subscriptionStatus)) || orgSeatActive;

  return {
    contact,
    stage: {
      now,
      override: contact.stageOverride,
      hasEmail: !!contact.email,
      isUser: !!user,
      userCreatedAt: user?.createdAt ?? null,
      effectivePlan: user ? effectivePlanId(user) : "FREE",
      subscriptionStatus,
      hadPaidSubscription: !!user?.subscription,
      orgSeatActive,
      firstDocumentAt: contact.firstDocumentAt,
      lastActiveAt: contact.lastActiveAt,
      docsLast14d: activity.docsLast14d,
      emailVerified: !!contact.emailVerifiedAt,
      magnetCount: contact.magnets.length,
    },
    score: {
      hasEmail: !!contact.email,
      emailVerified: !!contact.emailVerifiedAt,
      magnetCount: contact.magnets.length,
      subscribedTopics: contact.subscribedTopics,
      pendingTopics: contact.pendingTopics,
      channel: contact.channel,
      isUser: !!user,
      hasFirstDocument: !!contact.firstDocumentAt,
      docsLast14d: activity.docsLast14d,
      humanizedLast30d: activity.humanizedLast30d,
      quotaHitsLast30d: activity.quotaHitsLast30d,
      checkoutsLast30d: activity.checkoutsLast30d,
      hasActiveSubscription,
      referrals: activity.referrals,
      userInactive30d: !!user && olderThan(contact.lastActiveAt ?? user.createdAt, 30, now),
      unsubscribed: !!contact.unsubscribedAt,
      emailStatus: contact.emailStatus,
    },
  };
}

/** Score first: the engaged-lead stage rule reads the score. */
export function evaluate(input: ScoringInput): Evaluation {
  const score = computeScore(input.score);
  const { stage, reason } = computeStage({ ...input.stage, score: score.score });
  return { score, stage, reason };
}

/** Write the evaluation if anything changed. Returns whether the row was updated and the stage moved. */
async function persist(contact: ScoringContact, result: Evaluation, now: Date): Promise<{ updated: boolean; stageChanged: boolean }> {
  const breakdown = result.score.breakdown as unknown as Prisma.InputJsonValue;
  const stageChanged = contact.stage !== result.stage;
  const scoreChanged =
    contact.score !== result.score.score || JSON.stringify(contact.scoreBreakdown ?? []) !== JSON.stringify(result.score.breakdown);
  if (!stageChanged && !scoreChanged) return { updated: false, stageChanged: false };

  await db.contact.update({
    where: { id: contact.id },
    data: {
      score: result.score.score,
      scoreBreakdown: breakdown,
      scoredAt: now,
      ...(stageChanged ? { stage: result.stage, stageChangedAt: now } : {}),
    },
  });
  if (stageChanged) {
    await recordEvent({
      contactId: contact.id,
      type: "stage_changed",
      props: { from: contact.stage, to: result.stage, reason: result.reason },
      occurredAt: now,
    });
  }
  return { updated: true, stageChanged };
}

async function loadActivity(contact: ScoringContact, now: Date): Promise<ActivityCounts> {
  const d14 = new Date(now.getTime() - 14 * DAY_MS);
  const d30 = new Date(now.getTime() - 30 * DAY_MS);
  const userId = contact.userId;
  const eventCount = (type: string) =>
    db.contactEvent.count({ where: { contactId: contact.id, type, occurredAt: { gte: d30 } } });
  const [docsLast14d, humanizedDocs, humanizedEvents, quotaHitsLast30d, checkoutsLast30d, referrals] = await Promise.all([
    userId ? db.document.count({ where: { userId, createdAt: { gte: d14 } } }) : Promise.resolve(0),
    userId ? db.document.count({ where: { userId, createdAt: { gte: d30 }, rewrittenText: { not: null } } }) : Promise.resolve(0),
    eventCount("document_humanized"),
    eventCount("quota_hit"),
    eventCount("checkout_started"),
    db.referral.count({ where: { referrerContactId: contact.id, status: { in: ["pending", "rewarded"] } } }),
  ]);
  return { docsLast14d, humanizedLast30d: Math.max(humanizedDocs, humanizedEvents), quotaHitsLast30d, checkoutsLast30d, referrals };
}

/** Everything recomputeContact would use, for one contact (admin "why this score?"). */
export async function loadScoringInput(contactId: string, now: Date = new Date()): Promise<ScoringInput | null> {
  const contact = await db.contact.findUnique({ where: { id: contactId }, select: scoringSelect });
  if (!contact) return null;
  return buildScoringInput(contact, await loadActivity(contact, now), now);
}

/** Recompute one contact. Returns null when it doesn't exist. Throws on DB errors (hooks catch). */
export async function recomputeContact(
  contactId: string,
  now: Date = new Date()
): Promise<{ stage: Stage; score: number; updated: boolean; stageChanged: boolean } | null> {
  const input = await loadScoringInput(contactId, now);
  if (!input) return null;
  const result = evaluate(input);
  const written = await persist(input.contact, result, now);
  return { stage: result.stage, score: result.score.score, ...written };
}

/** Daily job: sync missing contacts, then recompute every contact from grouped aggregates. */
export async function recomputeAll(now: Date = new Date()): Promise<{
  synced: number;
  contacts: number;
  updated: number;
  stageChanges: number;
  errors: number;
}> {
  const { synced } = await syncMissingContacts();
  const d14 = new Date(now.getTime() - 14 * DAY_MS);
  const d30 = new Date(now.getTime() - 30 * DAY_MS);

  const [docs14, humanizedDocs, events, referrals] = await Promise.all([
    db.document.groupBy({ by: ["userId"], where: { createdAt: { gte: d14 } }, _count: { _all: true } }),
    db.document.groupBy({ by: ["userId"], where: { createdAt: { gte: d30 }, rewrittenText: { not: null } }, _count: { _all: true } }),
    db.contactEvent.groupBy({
      by: ["contactId", "type"],
      where: { occurredAt: { gte: d30 }, type: { in: ["quota_hit", "checkout_started", "document_humanized"] } },
      _count: { _all: true },
    }),
    db.referral.groupBy({
      by: ["referrerContactId"],
      where: { status: { in: ["pending", "rewarded"] } },
      _count: { _all: true },
    }),
  ]);
  const docsByUser = new Map(docs14.map((r) => [r.userId, r._count._all]));
  const humanizedByUser = new Map(humanizedDocs.map((r) => [r.userId, r._count._all]));
  const eventCount = new Map(events.map((r) => [`${r.contactId}|${r.type}`, r._count._all]));
  const referralsBy = new Map(referrals.map((r) => [r.referrerContactId, r._count._all]));

  let contacts = 0;
  let updated = 0;
  let stageChanges = 0;
  let errors = 0;
  let cursor: string | undefined;
  for (;;) {
    const page = await db.contact.findMany({
      select: scoringSelect,
      orderBy: { id: "asc" },
      take: PAGE_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (page.length === 0) break;
    for (const contact of page) {
      contacts++;
      try {
        const userId = contact.userId;
        const activity: ActivityCounts = {
          docsLast14d: userId ? (docsByUser.get(userId) ?? 0) : 0,
          humanizedLast30d: Math.max(
            userId ? (humanizedByUser.get(userId) ?? 0) : 0,
            eventCount.get(`${contact.id}|document_humanized`) ?? 0
          ),
          quotaHitsLast30d: eventCount.get(`${contact.id}|quota_hit`) ?? 0,
          checkoutsLast30d: eventCount.get(`${contact.id}|checkout_started`) ?? 0,
          referrals: referralsBy.get(contact.id) ?? 0,
        };
        const written = await persist(contact, evaluate(buildScoringInput(contact, activity, now)), now);
        if (written.updated) updated++;
        if (written.stageChanged) stageChanges++;
      } catch (err) {
        errors++;
        logGrowthError("recompute", err);
      }
    }
    cursor = page[page.length - 1].id;
    if (page.length < PAGE_SIZE) break;
  }
  return { synced, contacts, updated, stageChanges, errors };
}
