// ===========================================================
// lib/crm/tags.ts — Tags on contacts. Tags are the shared vocabulary of the
// admin: a contact linked to a user is tagged through UserTag (so the existing
// customer 360 view stays the source of truth), a lead or prospect through
// ContactTag. These helpers pick the right table; when a lead becomes a user
// its ContactTags move to UserTag.
// ===========================================================

import { db } from "@/lib/db";
import type { Prisma } from "@/app/generated/prisma/client";

type Client = Prisma.TransactionClient | typeof db;

export type ContactTagRef = { id: string; name: string; color: string };

/** Tag a contact. Returns which table was used, or null when the contact doesn't exist. */
export async function addTagToContact(contactId: string, tagId: string): Promise<"user" | "contact" | null> {
  const contact = await db.contact.findUnique({ where: { id: contactId }, select: { userId: true } });
  if (!contact) return null;
  if (contact.userId) {
    await db.userTag.upsert({
      where: { userId_tagId: { userId: contact.userId, tagId } },
      create: { userId: contact.userId, tagId },
      update: {},
    });
    return "user";
  }
  await db.contactTag.upsert({
    where: { contactId_tagId: { contactId, tagId } },
    create: { contactId, tagId },
    update: {},
  });
  return "contact";
}

/** Remove a tag from wherever it is attached for this contact. True when something was removed. */
export async function removeTagFromContact(contactId: string, tagId: string): Promise<boolean> {
  const contact = await db.contact.findUnique({ where: { id: contactId }, select: { userId: true } });
  if (!contact) return false;
  const [fromUser, fromContact] = await Promise.all([
    contact.userId ? db.userTag.deleteMany({ where: { userId: contact.userId, tagId } }) : Promise.resolve({ count: 0 }),
    db.contactTag.deleteMany({ where: { contactId, tagId } }),
  ]);
  return fromUser.count + fromContact.count > 0;
}

/** Tags of a contact from both tables, de-duplicated and sorted by name. */
export async function listContactTags(contactId: string): Promise<ContactTagRef[]> {
  const contact = await db.contact.findUnique({
    where: { id: contactId },
    select: {
      tags: { select: { tag: { select: { id: true, name: true, color: true } } } },
      user: { select: { tags: { select: { tag: { select: { id: true, name: true, color: true } } } } } },
    },
  });
  if (!contact) return [];
  const byId = new Map<string, ContactTagRef>();
  for (const t of [...contact.tags, ...(contact.user?.tags ?? [])]) byId.set(t.tag.id, t.tag);
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Convert a contact's ContactTags into UserTags for `userId` (used when a lead signs up or merges). */
export async function moveContactTagsToUser(contactId: string, userId: string, client: Client = db): Promise<number> {
  const rows = await client.contactTag.findMany({ where: { contactId }, select: { tagId: true } });
  if (rows.length === 0) return 0;
  await client.userTag.createMany({ data: rows.map((r) => ({ userId, tagId: r.tagId })), skipDuplicates: true });
  await client.contactTag.deleteMany({ where: { contactId } });
  return rows.length;
}
