// ===========================================================
// lib/crm/consent.ts — Marketing consent and its proof.
//
// Topics (tips, extension_launch) are explicit opt-ins. Public forms add them
// as *pending* until the double opt-in click confirms; an in-app opt-in
// (Clerk-verified address) or the signed preference link subscribes directly.
// Admins, imports and webhooks can never grant consent, only withdraw it.
// Every change writes a ConsentRecord (who, when, how, which wording), with the
// IP stored only as a keyed hash.
// ===========================================================

import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import type { Prisma } from "@/app/generated/prisma/client";
import { isTopic, type ConsentWordingId, type Topic } from "@/lib/growth/constants";
import { onUnsubscribed } from "@/lib/growth/triggers";
import { logGrowthError } from "@/lib/growth/safe";

export type ConsentMethod = "checkbox" | "doi" | "in_app" | "preferences" | "one_click" | "link" | "admin" | "webhook";

export type ConsentMeta = {
  method: ConsentMethod;
  wording?: ConsentWordingId | null;
  /** Page path or form id. */
  source?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  actor?: string | null;
};

/** Methods that may subscribe directly (the inbox is already proven). */
const DIRECT_GRANT_METHODS: ReadonlySet<ConsentMethod> = new Set(["in_app", "preferences"]);
/** Methods that may never add consent. */
const WITHDRAW_ONLY_METHODS: ReadonlySet<ConsentMethod> = new Set(["admin", "webhook", "one_click"]);
const MAX_OPTIMISTIC_ATTEMPTS = 5;

/** sha256(EMAIL_TOKEN_SECRET + ":" + ip), 32 hex chars. Null without a secret: an unkeyed IPv4 hash is reversible. */
export function hashIp(ip: string | null | undefined): string | null {
  const secret = process.env.EMAIL_TOKEN_SECRET;
  const value = ip?.trim();
  if (!value || !secret) return null;
  return createHash("sha256").update(`${secret}:${value}`).digest("hex").slice(0, 32);
}

export function truncateUserAgent(userAgent: string | null | undefined): string | null {
  const value = userAgent?.trim();
  return value ? value.slice(0, 200) : null;
}

function uniqueTopics(topics: readonly unknown[]): Topic[] {
  return [...new Set(topics.filter(isTopic))];
}

function consentRows(
  contactId: string,
  topics: readonly string[],
  action: "grant" | "confirm" | "withdraw",
  meta: Omit<ConsentMeta, "method"> & { method: ConsentMethod }
): Prisma.ConsentRecordCreateManyInput[] {
  const base = {
    contactId,
    action,
    method: meta.method,
    wording: meta.wording ?? null,
    source: meta.source?.slice(0, 200) ?? null,
    ipHash: hashIp(meta.ip),
    userAgent: truncateUserAgent(meta.userAgent),
    actor: meta.actor?.slice(0, 200) ?? null,
  };
  return topics.map((topic) => ({ ...base, topic }));
}

type TopicState = { subscribed: string[]; pending: string[] };
type TopicChange = TopicState & { extra?: Prisma.ContactUpdateManyMutationInput };

/**
 * Read-modify-write of the two topic arrays with optimistic concurrency: the
 * write only lands if both arrays still hold what was read. Returns the state
 * before and after, or null when the contact is missing or nothing changed.
 */
async function updateTopics(
  contactId: string,
  change: (current: TopicState) => TopicChange | null
): Promise<{ before: TopicState; after: TopicState } | null> {
  for (let attempt = 0; attempt < MAX_OPTIMISTIC_ATTEMPTS; attempt++) {
    const row = await db.contact.findUnique({ where: { id: contactId }, select: { subscribedTopics: true, pendingTopics: true } });
    if (!row) return null;
    const before = { subscribed: row.subscribedTopics, pending: row.pendingTopics };
    const next = change(before);
    if (!next) return null;
    const res = await db.contact.updateMany({
      where: { id: contactId, subscribedTopics: { equals: before.subscribed }, pendingTopics: { equals: before.pending } },
      data: { subscribedTopics: next.subscribed, pendingTopics: next.pending, ...next.extra },
    });
    if (res.count === 1) return { before, after: { subscribed: next.subscribed, pending: next.pending } };
  }
  throw new Error("consent topics changed concurrently");
}

/**
 * Add consent for `topics`. `pending: true` (public forms) waits for the double
 * opt-in; otherwise only in_app and preferences may subscribe directly.
 */
export async function grantTopics(
  contactId: string,
  topics: readonly Topic[],
  meta: ConsentMeta & { pending: boolean }
): Promise<{ ok: boolean; granted: Topic[] }> {
  const wanted = uniqueTopics(topics);
  if (wanted.length === 0) return { ok: true, granted: [] };
  if (WITHDRAW_ONLY_METHODS.has(meta.method)) return { ok: false, granted: [] };
  if (!meta.pending && !DIRECT_GRANT_METHODS.has(meta.method)) return { ok: false, granted: [] };

  let granted: Topic[] = [];
  const result = await updateTopics(contactId, ({ subscribed, pending }) => {
    granted = wanted.filter((t) => !subscribed.includes(t) && (meta.pending ? !pending.includes(t) : true));
    if (granted.length === 0) return null;
    if (meta.pending) return { subscribed, pending: [...pending, ...granted] };
    return {
      subscribed: [...subscribed, ...granted],
      pending: pending.filter((t) => !granted.includes(t as Topic)),
      // A direct opt-in proves the inbox and supersedes an earlier withdrawal.
      extra: { unsubscribedAt: null },
    };
  });
  if (!result) return { ok: true, granted: [] };

  if (!meta.pending) {
    await db.contact.updateMany({ where: { id: contactId, emailVerifiedAt: null }, data: { emailVerifiedAt: new Date() } });
  }
  await db.consentRecord.createMany({ data: consentRows(contactId, granted, "grant", meta) });
  return { ok: true, granted };
}

/**
 * The double opt-in click: pending topics become subscribed and the inbox
 * counts as verified. Idempotent.
 */
export async function confirmPendingTopics(
  contactId: string,
  meta: { source?: string | null; ip?: string | null; userAgent?: string | null } = {}
): Promise<{ confirmed: Topic[] }> {
  let confirmed: Topic[] = [];
  await updateTopics(contactId, ({ subscribed, pending }) => {
    confirmed = uniqueTopics(pending).filter((t) => !subscribed.includes(t));
    if (pending.length === 0) return null;
    return { subscribed: [...subscribed, ...confirmed], pending: [], extra: confirmed.length > 0 ? { unsubscribedAt: null } : undefined };
  });
  await db.contact.updateMany({ where: { id: contactId, emailVerifiedAt: null }, data: { emailVerifiedAt: new Date() } });
  if (confirmed.length > 0) {
    await db.consentRecord.createMany({ data: consentRows(contactId, confirmed, "confirm", { ...meta, method: "doi" }) });
  }
  return { confirmed };
}

/** Withdraw topics (or all of them). Sets unsubscribedAt and tells the email engine. */
export async function withdrawTopics(
  contactId: string,
  topics: readonly Topic[] | "all",
  meta: ConsentMeta
): Promise<{ withdrawn: Topic[] }> {
  let withdrawn: Topic[] = [];
  await updateTopics(contactId, ({ subscribed, pending }) => {
    const targets = topics === "all" ? uniqueTopics([...subscribed, ...pending]) : uniqueTopics(topics);
    withdrawn = targets.filter((t) => subscribed.includes(t) || pending.includes(t));
    if (withdrawn.length === 0) return null;
    return {
      subscribed: subscribed.filter((t) => !withdrawn.includes(t as Topic)),
      pending: pending.filter((t) => !withdrawn.includes(t as Topic)),
      extra: { unsubscribedAt: new Date() },
    };
  });
  if (withdrawn.length === 0) return { withdrawn };
  await db.consentRecord.createMany({ data: consentRows(contactId, withdrawn, "withdraw", meta) });
  try {
    await onUnsubscribed(contactId, "marketing");
  } catch (err) {
    logGrowthError("trigger-unsubscribed", err);
  }
  return { withdrawn };
}

/**
 * Turn lifecycle (service) email on or off. Admins may only turn it off, like
 * every other consent change they make.
 */
export async function setLifecycleEmails(
  contactId: string,
  enabled: boolean,
  meta: ConsentMeta
): Promise<{ changed: boolean }> {
  if (enabled && WITHDRAW_ONLY_METHODS.has(meta.method)) return { changed: false };
  const res = await db.contact.updateMany({
    where: { id: contactId, lifecycleEmails: !enabled },
    data: { lifecycleEmails: enabled },
  });
  if (res.count === 0) return { changed: false };
  await db.consentRecord.createMany({ data: consentRows(contactId, ["lifecycle"], enabled ? "grant" : "withdraw", meta) });
  if (!enabled) {
    try {
      await onUnsubscribed(contactId, "lifecycle");
    } catch (err) {
      logGrowthError("trigger-unsubscribed", err);
    }
  }
  return { changed: true };
}

/** The in-app consent card was shown or answered: don't prompt again. */
export async function markConsentPrompted(contactId: string): Promise<void> {
  await db.contact.updateMany({ where: { id: contactId, consentPromptedAt: null }, data: { consentPromptedAt: new Date() } });
}
