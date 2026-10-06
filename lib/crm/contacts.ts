// ===========================================================
// lib/crm/contacts.ts — One Contact per person.
//
// Every User gets exactly one Contact (Contact.userId is unique); leads and
// outreach prospects are Contacts without a user. When a lead signs up, their
// lead contact is linked to (or merged into) the account's contact so the
// person keeps one timeline, one consent record and one score. Unique-key
// races (two requests creating the same contact) are resolved by re-reading.
// ===========================================================

import { db } from "@/lib/db";
import type { Contact, Prisma, User } from "@/app/generated/prisma/client";
import { isPlaceholderEmail } from "@/lib/user";
import { emailHash, normalizeEmail } from "@/lib/email/address";
import { touchToFirstTouchFields } from "@/lib/growth/attribution";
import { applyFirstTouch, firstTouchOf, type AttributionSnapshot } from "@/lib/growth/attribution-server";
import type { LeadSource, MagnetSlug } from "@/lib/growth/constants";
import { isUniqueViolation, logGrowthError } from "@/lib/growth/safe";
import { onContactConverted } from "@/lib/growth/triggers";
import { moveContactTagsToUser } from "@/lib/crm/tags";

export type UserIdentity = Pick<User, "id" | "email" | "name" | "createdAt">;
export type SyncResult = { contactId: string; created: boolean; linked: boolean; merged: boolean };

const MAX_SYNC_ATTEMPTS = 3;

function lastTouchJson(snapshot: AttributionSnapshot | null | undefined): Prisma.InputJsonValue | undefined {
  return snapshot?.last ? (snapshot.last as unknown as Prisma.InputJsonValue) : undefined;
}

async function writeConvertedEvent(contactId: string, userId: string): Promise<void> {
  try {
    await db.contactEvent.create({ data: { contactId, type: "converted", dedupeKey: `converted:${userId}`, props: { userId } } });
  } catch (err) {
    if (!isUniqueViolation(err)) logGrowthError("converted-event", err);
  }
}

/**
 * Make sure `user` has its contact, with the right email, and link or merge a
 * lead captured under the same address. Throws on DB errors (hooks catch).
 */
export async function syncContactForUser(
  user: UserIdentity,
  opts: { attribution?: AttributionSnapshot | null } = {}
): Promise<SyncResult> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await syncOnce(user, opts.attribution ?? null);
    } catch (err) {
      // A concurrent sync created or linked the row first: re-read and retry.
      if (!isUniqueViolation(err) || attempt >= MAX_SYNC_ATTEMPTS) throw err;
    }
  }
}

async function syncOnce(user: UserIdentity, attribution: AttributionSnapshot | null): Promise<SyncResult> {
  const email = isPlaceholderEmail(user.email) ? null : normalizeEmail(user.email);
  const [byUser, byEmail] = await Promise.all([
    db.contact.findUnique({ where: { userId: user.id } }),
    email ? db.contact.findUnique({ where: { email } }) : Promise.resolve(null),
  ]);

  // (1) The account already has its contact: keep its email current.
  if (byUser) {
    let merged = false;
    const data: Prisma.ContactUpdateInput = {};
    if (email && byUser.email !== email) {
      if (byEmail && byEmail.id !== byUser.id && byEmail.userId === null) {
        await mergeContacts(byUser.id, byEmail.id, { actor: "system" });
        merged = true;
      }
      // An address still held by another account's contact is stale data; leave ours as is.
      if (!byEmail || byEmail.id === byUser.id || byEmail.userId === null) {
        data.email = email;
        if (!byUser.emailVerifiedAt) data.emailVerifiedAt = new Date();
      }
    }
    if (!byUser.name && user.name) data.name = user.name;
    if (Object.keys(data).length > 0) await db.contact.update({ where: { id: byUser.id }, data });
    if (attribution) await applyFirstTouch(byUser.id, attribution);
    return { contactId: byUser.id, created: false, linked: false, merged };
  }

  // (2) A lead with this address exists: link it to the account (Clerk verified the address).
  if (byEmail && byEmail.userId === null) {
    const res = await db.contact.updateMany({
      where: { id: byEmail.id, userId: null },
      data: {
        userId: user.id,
        emailVerifiedAt: byEmail.emailVerifiedAt ?? new Date(),
        ...(byEmail.name ? {} : { name: user.name }),
      },
    });
    if (res.count === 1) {
      await moveContactTagsToUser(byEmail.id, user.id);
      await writeConvertedEvent(byEmail.id, user.id);
      try {
        await onContactConverted(byEmail.id);
      } catch (err) {
        logGrowthError("trigger-converted", err);
      }
      if (attribution) await applyFirstTouch(byEmail.id, attribution);
      return { contactId: byEmail.id, created: false, linked: true, merged: false };
    }
    // Someone linked it in between: retry from the top.
    const raced = new Error("contact linked concurrently") as Error & { code: string };
    raced.code = "P2002";
    throw raced;
  }

  // (3) Create. If the address belongs to another account's contact, create ours without it.
  const first = firstTouchOf(attribution);
  const ownEmail = byEmail ? null : email;
  const created = await db.contact.create({
    data: {
      userId: user.id,
      email: ownEmail,
      name: user.name,
      source: "signup",
      emailVerifiedAt: ownEmail ? user.createdAt : null,
      ...(first ? touchToFirstTouchFields(first) : {}),
      lastTouch: lastTouchJson(attribution),
    },
    select: { id: true },
  });
  return { contactId: created.id, created: true, linked: false, merged: false };
}

/** The contact id of a user, creating the contact from the User row when missing. */
export async function getOrCreateContactForUser(userId: string): Promise<string | null> {
  const existing = await db.contact.findUnique({ where: { userId }, select: { id: true } });
  if (existing) return existing.id;
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true, createdAt: true } });
  if (!user) return null;
  return (await syncContactForUser(user)).contactId;
}

/**
 * Create or update a lead from a public form. Adds the magnet, never touches
 * consent (that's lib/crm/consent.ts). Returns null for an unusable address.
 */
export async function upsertLeadContact(input: {
  email: string;
  source: LeadSource;
  magnet?: MagnetSlug;
  name?: string | null;
  attribution?: AttributionSnapshot | null;
}): Promise<{ contactId: string; created: boolean } | null> {
  const email = normalizeEmail(input.email);
  if (!email) return null;
  for (let attempt = 1; attempt <= MAX_SYNC_ATTEMPTS; attempt++) {
    const existing = await db.contact.findUnique({ where: { email }, select: { id: true, name: true, magnets: true } });
    if (existing) {
      const data: Prisma.ContactUpdateInput = {};
      if (input.magnet && !existing.magnets.includes(input.magnet)) data.magnets = { push: input.magnet };
      if (!existing.name && input.name) data.name = input.name;
      if (Object.keys(data).length > 0) await db.contact.update({ where: { id: existing.id }, data });
      if (input.attribution) await applyFirstTouch(existing.id, input.attribution);
      return { contactId: existing.id, created: false };
    }
    try {
      const first = firstTouchOf(input.attribution);
      const row = await db.contact.create({
        data: {
          email,
          name: input.name ?? null,
          source: input.source,
          magnets: input.magnet ? [input.magnet] : [],
          ...(first ? touchToFirstTouchFields(first) : {}),
          lastTouch: lastTouchJson(input.attribution),
        },
        select: { id: true },
      });
      return { contactId: row.id, created: true };
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
    }
  }
  return null;
}

// ── Merge ────────────────────────────────────────────────────────────────────

const STATUS_SEVERITY: Record<string, number> = { ok: 0, invalid: 1, bounced: 2, complained: 3 };

const minDate = (a: Date | null, b: Date | null) => (a && b ? (a < b ? a : b) : (a ?? b));
const maxDate = (a: Date | null, b: Date | null) => (a && b ? (a > b ? a : b) : (a ?? b));
const union = (a: readonly string[], b: readonly string[]) => [...new Set([...a, ...b])];

function liveBonus(c: Pick<Contact, "bonusWords" | "bonusWordsExpireAt">, now: Date): number {
  if (c.bonusWordsExpireAt && c.bonusWordsExpireAt <= now) return 0;
  return Math.max(0, c.bonusWords);
}

/** Scalars of the merged contact (spec §3.3); score and stage are recomputed afterwards. */
function mergedScalars(into: Contact, from: Contact, now: Date): Prisma.ContactUpdateInput {
  const intoFirst = into.firstTouchAt ?? into.createdAt;
  const fromFirst = from.firstTouchAt ?? from.createdAt;
  const attributionFrom = fromFirst < intoFirst ? from : into;
  const subscribed = union(into.subscribedTopics, from.subscribedTopics);

  // Bonus pools: add what is still live; null expiry means "never".
  const intoBonus = liveBonus(into, now);
  const fromBonus = liveBonus(from, now);
  const live = [intoBonus > 0 ? into : null, fromBonus > 0 ? from : null].filter((c): c is Contact => c !== null);
  const bonusWordsExpireAt =
    live.length === 0 ? null : live.some((c) => c.bonusWordsExpireAt === null) ? null : live.map((c) => c.bonusWordsExpireAt as Date).reduce((a, b) => (a > b ? a : b));

  return {
    email: into.email ?? from.email,
    name: into.name ?? from.name,
    stageOverride: into.stageOverride ?? from.stageOverride,
    pipelineStage: into.pipelineStage ?? from.pipelineStage,
    pipelineUpdatedAt: into.pipelineStage ? into.pipelineUpdatedAt : from.pipelineUpdatedAt,
    firstDocumentAt: minDate(into.firstDocumentAt, from.firstDocumentAt),
    lastActiveAt: maxDate(into.lastActiveAt, from.lastActiveAt),
    lastSeenAt: maxDate(into.lastSeenAt, from.lastSeenAt),
    bonusWords: intoBonus + fromBonus,
    bonusWordsExpireAt,
    referralCode: into.referralCode ?? from.referralCode,
    source: attributionFrom.source,
    channel: attributionFrom.channel,
    referrerHost: attributionFrom.referrerHost,
    landingPath: attributionFrom.landingPath,
    utmSource: attributionFrom.utmSource,
    utmMedium: attributionFrom.utmMedium,
    utmCampaign: attributionFrom.utmCampaign,
    utmTerm: attributionFrom.utmTerm,
    utmContent: attributionFrom.utmContent,
    refCode: attributionFrom.refCode,
    firstTouchAt: minDate(into.firstTouchAt, from.firstTouchAt),
    lastTouch: (into.lastTouch ?? from.lastTouch ?? undefined) as Prisma.InputJsonValue | undefined,
    magnets: union(into.magnets, from.magnets),
    subscribedTopics: subscribed,
    pendingTopics: union(into.pendingTopics, from.pendingTopics).filter((t) => !subscribed.includes(t)),
    lifecycleEmails: into.lifecycleEmails && from.lifecycleEmails,
    consentPromptedAt: minDate(into.consentPromptedAt, from.consentPromptedAt),
    emailVerifiedAt: minDate(into.emailVerifiedAt, from.emailVerifiedAt),
    emailStatus:
      (STATUS_SEVERITY[from.emailStatus] ?? 0) > (STATUS_SEVERITY[into.emailStatus] ?? 0) ? from.emailStatus : into.emailStatus,
    unsubscribedAt: maxDate(into.unsubscribedAt, from.unsubscribedAt),
    lastEmailedAt: maxDate(into.lastEmailedAt, from.lastEmailedAt),
    phone: into.phone ?? from.phone,
    handle: into.handle ?? from.handle,
    company: into.company ?? from.company,
  };
}

/**
 * Fold `fromId` into `intoId` in one transaction: move every child row, merge
 * the scalars, delete `from`, and record a `merged` event. Two contacts that
 * both belong to accounts are never merged.
 */
export async function mergeContacts(intoId: string, fromId: string, opts: { actor?: string } = {}): Promise<boolean> {
  if (intoId === fromId) return false;
  const now = new Date();
  return db.$transaction(async (tx) => {
    const [into, from] = await Promise.all([
      tx.contact.findUnique({ where: { id: intoId } }),
      tx.contact.findUnique({ where: { id: fromId } }),
    ]);
    if (!into || !from) return false;
    if (into.userId && from.userId) throw new Error("refusing to merge two account contacts");
    const userId = into.userId ?? from.userId;

    const move = { where: { contactId: fromId }, data: { contactId: intoId } };
    await tx.contactEvent.updateMany(move);
    await tx.emailMessage.updateMany(move);
    await tx.consentRecord.updateMany(move);
    await tx.crmTask.updateMany(move);

    await tx.referral.updateMany({ where: { referrerContactId: fromId }, data: { referrerContactId: intoId } });
    const intoReferred = await tx.referral.findUnique({ where: { refereeContactId: intoId }, select: { id: true } });
    if (intoReferred) await tx.referral.deleteMany({ where: { refereeContactId: fromId } });
    else await tx.referral.updateMany({ where: { refereeContactId: fromId }, data: { refereeContactId: intoId } });
    // A person can't have referred themselves.
    await tx.referral.deleteMany({ where: { referrerContactId: intoId, refereeContactId: intoId } });

    const taken = new Set(
      (await tx.sequenceEnrollment.findMany({ where: { contactId: intoId }, select: { sequenceKey: true, cycle: true } })).map(
        (e) => `${e.sequenceKey}|${e.cycle}`
      )
    );
    const fromEnrollments = await tx.sequenceEnrollment.findMany({ where: { contactId: fromId }, select: { id: true, sequenceKey: true, cycle: true } });
    const clashing = fromEnrollments.filter((e) => taken.has(`${e.sequenceKey}|${e.cycle}`)).map((e) => e.id);
    if (clashing.length > 0) await tx.sequenceEnrollment.deleteMany({ where: { id: { in: clashing } } });
    await tx.sequenceEnrollment.updateMany(move);

    if (userId) {
      await moveContactTagsToUser(fromId, userId, tx);
      await moveContactTagsToUser(intoId, userId, tx);
    } else {
      const intoTags = new Set((await tx.contactTag.findMany({ where: { contactId: intoId }, select: { tagId: true } })).map((t) => t.tagId));
      await tx.contactTag.deleteMany({ where: { contactId: fromId, tagId: { in: [...intoTags] } } });
      await tx.contactTag.updateMany(move);
    }

    // Delete first: `from` may hold the email, referral code or user link `into` takes over.
    await tx.contact.delete({ where: { id: fromId } });
    await tx.contact.update({
      where: { id: intoId },
      data: { ...mergedScalars(into, from, now), ...(userId && !into.userId ? { user: { connect: { id: userId } } } : {}) },
    });
    await tx.contactEvent.create({ data: { contactId: intoId, type: "merged", props: { fromId }, actor: opts.actor ?? "system" } });
    return true;
  });
}

// ── Departure ────────────────────────────────────────────────────────────────

type DepartingContact = Pick<Contact, "email" | "unsubscribedAt" | "lifecycleEmails" | "emailStatus">;

/**
 * Hashed suppressions that must outlive a deleted contact, so erasure never
 * leads to re-contact: withdrawn consent, lifecycle off, hard bounce, complaint.
 */
export async function writeDepartureSuppressions(
  contact: DepartingContact,
  opts: { source: string; erasure?: boolean }
): Promise<number> {
  const email = normalizeEmail(contact.email);
  if (!email) return 0;
  const rows: { scope: string; reason: string }[] = [];
  if (contact.unsubscribedAt) rows.push({ scope: "marketing", reason: "unsubscribe" });
  if (!contact.lifecycleEmails) rows.push({ scope: "nonessential", reason: "unsubscribe" });
  if (contact.emailStatus === "bounced") rows.push({ scope: "all", reason: "bounce" });
  if (contact.emailStatus === "complained") rows.push({ scope: "nonessential", reason: "complaint" });
  if (opts.erasure) rows.push({ scope: "marketing", reason: "erasure" });
  if (rows.length === 0) return 0;
  const hash = emailHash(email);
  const res = await db.emailSuppression.createMany({
    data: rows.map((r) => ({ emailHash: hash, scope: r.scope, reason: r.reason, source: opts.source })),
    skipDuplicates: true,
  });
  return res.count;
}

/**
 * Delete a lead or prospect (admin, or a GDPR erasure request). Account
 * contacts are deleted with their user instead.
 */
export async function eraseContact(
  contactId: string,
  opts: { erasureRequest?: boolean } = {}
): Promise<{ ok: true } | { ok: false; reason: "not_found" | "linked_to_user" }> {
  const contact = await db.contact.findUnique({
    where: { id: contactId },
    select: { userId: true, email: true, unsubscribedAt: true, lifecycleEmails: true, emailStatus: true },
  });
  if (!contact) return { ok: false, reason: "not_found" };
  if (contact.userId) return { ok: false, reason: "linked_to_user" };
  await writeDepartureSuppressions(contact, { source: "contact_erased", erasure: opts.erasureRequest });
  await db.contact.delete({ where: { id: contactId } });
  return { ok: true };
}

/** Create the missing contact of every user (daily job and backfill). */
export async function syncMissingContacts(opts: { batchSize?: number } = {}): Promise<{ synced: number; failed: number }> {
  const batchSize = opts.batchSize ?? 200;
  let synced = 0;
  let failed = 0;
  let cursor: string | undefined;
  for (;;) {
    const users = await db.user.findMany({
      where: { contact: { is: null }, ...(cursor ? { id: { gt: cursor } } : {}) },
      select: { id: true, email: true, name: true, createdAt: true },
      orderBy: { id: "asc" },
      take: batchSize,
    });
    if (users.length === 0) break;
    for (const user of users) {
      try {
        await syncContactForUser(user);
        synced++;
      } catch (err) {
        failed++;
        logGrowthError("sync-missing", err);
      }
    }
    cursor = users[users.length - 1].id;
    if (users.length < batchSize) break;
  }
  return { synced, failed };
}
