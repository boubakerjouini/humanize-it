// ===========================================================
// lib/crm/events.ts — The contact timeline (ContactEvent rows).
//
// Events live in Postgres, not PostHog: the CRM joins them with users, plans
// and email. recordEvent never throws, resolves (or lazily creates) the
// contact of a user id, and treats a dedupe-key conflict as "already
// recorded". Props are sanitized: no email addresses or user text, strings
// capped at 500 characters.
// ===========================================================

import { db } from "@/lib/db";
import type { Prisma } from "@/app/generated/prisma/client";
import { EVENT_TYPES, isEventType, type EventType } from "@/lib/growth/constants";
import { getOrCreateContactForUser } from "@/lib/crm/contacts";
import { isUniqueViolation, logGrowthError } from "@/lib/growth/safe";

export { EVENT_TYPES, isEventType, type EventType };

const DROPPED_KEYS = new Set(["email", "text", "originaltext", "humanizedtext"]);
const MAX_STRING = 500;
const MAX_ITEMS = 50;
const MAX_DEPTH = 4;
const ACTIVITY_THROTTLE_MS = 15 * 60 * 1000;

function sanitizeValue(value: unknown, depth: number): Prisma.InputJsonValue | null | undefined {
  if (value === null) return null;
  if (typeof value === "string") return value.slice(0, MAX_STRING);
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "boolean") return value;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value.toISOString();
  if (depth >= MAX_DEPTH) return undefined;
  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_ITEMS)
      .map((v) => sanitizeValue(v, depth + 1))
      .filter((v): v is Prisma.InputJsonValue => v !== undefined && v !== null);
  }
  if (typeof value === "object") {
    const out: Record<string, Prisma.InputJsonValue | null> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>).slice(0, MAX_ITEMS)) {
      if (DROPPED_KEYS.has(key.toLowerCase())) continue;
      const clean = sanitizeValue(v, depth + 1);
      if (clean !== undefined) out[key] = clean;
    }
    return out;
  }
  return undefined;
}

/** Event props safe to store: no email/text keys, bounded strings and sizes. */
export function sanitizeProps(props: Record<string, unknown> | null | undefined): Prisma.InputJsonValue | undefined {
  if (!props) return undefined;
  const clean = sanitizeValue(props, 0);
  return clean && typeof clean === "object" && Object.keys(clean).length > 0 ? clean : undefined;
}

export type RecordEventInput = {
  contactId?: string | null;
  userId?: string | null;
  type: EventType;
  props?: Record<string, unknown> | null;
  /** "system", or an admin email for admin actions (stored, never logged). */
  actor?: string;
  dedupeKey?: string | null;
  occurredAt?: Date;
};

/** Append an event. Returns null when it was a duplicate or anything failed. Never throws. */
export async function recordEvent(input: RecordEventInput): Promise<{ id: string; contactId: string } | null> {
  try {
    const contactId = input.contactId ?? (input.userId ? await getOrCreateContactForUser(input.userId) : null);
    if (!contactId) return null;
    const row = await db.contactEvent.create({
      data: {
        contactId,
        type: input.type,
        props: sanitizeProps(input.props),
        actor: (input.actor ?? "system").slice(0, 200),
        dedupeKey: input.dedupeKey ?? null,
        occurredAt: input.occurredAt ?? new Date(),
      },
      select: { id: true },
    });
    return { id: row.id, contactId };
  } catch (err) {
    if (!isUniqueViolation(err)) logGrowthError(`event:${input.type}`, err);
    return null;
  }
}

/** Bump lastActiveAt at most every 15 minutes (one conditional write). Never throws. */
export async function touchLastActive(contactId: string, now: Date = new Date()): Promise<void> {
  try {
    await db.contact.updateMany({
      where: {
        id: contactId,
        OR: [{ lastActiveAt: null }, { lastActiveAt: { lt: new Date(now.getTime() - ACTIVITY_THROTTLE_MS) } }],
      },
      data: { lastActiveAt: now },
    });
  } catch (err) {
    logGrowthError("last-active", err);
  }
}

/**
 * Record a product event for a user and mark them active. The contact is
 * created first if the lazy signup hook hasn't run yet. Never throws.
 */
export async function recordUserActivity(
  userId: string,
  type: EventType,
  props?: Record<string, unknown> | null
): Promise<{ id: string; contactId: string } | null> {
  let contactId: string | null = null;
  try {
    contactId = await getOrCreateContactForUser(userId);
  } catch (err) {
    logGrowthError(`activity:${type}`, err);
  }
  if (!contactId) return null;
  const event = await recordEvent({ contactId, type, props });
  await touchLastActive(contactId);
  return event;
}
