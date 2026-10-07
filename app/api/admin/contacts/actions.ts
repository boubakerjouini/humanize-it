// ===========================================================
// app/api/admin/contacts/actions.ts — Contact mutations shared by the contact
// PATCH, the bulk endpoint and the touch logger (pipeline moves, tags).
// ===========================================================

import { db } from "@/lib/db";
import type { PipelineStage } from "@/lib/growth/constants";
import { recordEvent } from "@/lib/crm/events";
import { addTagToContact } from "@/lib/crm/tags";

/**
 * Move a contact on the outreach pipeline and record `pipeline_changed`.
 * Returns false when it was already there (nothing written) or doesn't exist.
 */
export async function setPipelineStage(contactId: string, stage: PipelineStage | null, actor: string): Promise<boolean> {
  const current = await db.contact.findUnique({ where: { id: contactId }, select: { pipelineStage: true } });
  if (!current || current.pipelineStage === stage) return false;
  // Conditional on the stage we read, so two admins moving the same card can't both log a move.
  const res = await db.contact.updateMany({
    where: { id: contactId, pipelineStage: current.pipelineStage },
    data: { pipelineStage: stage, pipelineUpdatedAt: new Date() },
  });
  if (res.count === 0) return false;
  await recordEvent({ contactId, type: "pipeline_changed", props: { from: current.pipelineStage, to: stage }, actor });
  return true;
}

/** Find a tag by id, or create it by name. Null when neither is usable. */
export async function resolveTag(ref: { tagId?: string | null; name?: string | null }) {
  if (ref.tagId) return db.tag.findUnique({ where: { id: ref.tagId } });
  const name = ref.name?.trim().slice(0, 40);
  if (!name) return null;
  return db.tag.upsert({ where: { name }, update: {}, create: { name } });
}

export async function tagContact(contactId: string, tagId: string): Promise<boolean> {
  return (await addTagToContact(contactId, tagId)) !== null;
}
