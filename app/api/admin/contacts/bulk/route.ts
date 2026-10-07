// ===========================================================
// POST /api/admin/contacts/bulk — { ids[], action } on up to 200 selected
// contacts: addTag | removeTag | setPipelineStage | createTask. One audit row
// for the whole batch.
// ===========================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { logAudit } from "@/lib/audit";
import { PIPELINE_STAGES } from "@/lib/growth/constants";
import { removeTagFromContact } from "@/lib/crm/tags";
import { resolveTag, setPipelineStage, tagContact } from "../actions";

const ids = z.array(z.string().min(1).max(64)).min(1).max(200);

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("addTag"), ids, tagId: z.string().max(64).optional(), name: z.string().trim().max(40).optional() }),
  z.object({ action: z.literal("removeTag"), ids, tagId: z.string().min(1).max(64) }),
  z.object({ action: z.literal("setPipelineStage"), ids, stage: z.enum(PIPELINE_STAGES).nullable() }),
  z.object({
    action: z.literal("createTask"),
    ids,
    title: z.string().trim().min(1).max(200),
    kind: z.enum(["follow_up", "outreach", "email", "call", "review", "other"]).default("follow_up"),
    priority: z.enum(["low", "normal", "high"]).default("normal"),
    dueAt: z.coerce.date().nullable().optional(),
  }),
]);

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin();
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: { code: "INVALID_JSON", message: "Invalid JSON." } }, { status: 400 });
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: { code: "INVALID_INPUT", message: parsed.error.issues[0]?.message ?? "Invalid input." } }, { status: 400 });
    }
    const input = parsed.data;
    const existing = (await db.contact.findMany({ where: { id: { in: input.ids } }, select: { id: true } })).map((c) => c.id);

    let affected = 0;
    let summary = "";
    switch (input.action) {
      case "addTag": {
        const tag = await resolveTag(input);
        if (!tag) return NextResponse.json({ error: { code: "INVALID_INPUT", message: "tagId or name required." } }, { status: 400 });
        for (const id of existing) if (await tagContact(id, tag.id)) affected++;
        summary = `Tagged ${affected} contacts "${tag.name}"`;
        break;
      }
      case "removeTag": {
        for (const id of existing) if (await removeTagFromContact(id, input.tagId)) affected++;
        summary = `Removed a tag from ${affected} contacts`;
        break;
      }
      case "setPipelineStage": {
        for (const id of existing) if (await setPipelineStage(id, input.stage, admin.email)) affected++;
        summary = `Moved ${affected} contacts to ${input.stage ?? "no pipeline stage"}`;
        break;
      }
      case "createTask": {
        const res = await db.crmTask.createMany({
          data: existing.map((contactId) => ({
            contactId,
            title: input.title,
            kind: input.kind,
            priority: input.priority,
            dueAt: input.dueAt ?? null,
            source: "manual",
            createdBy: admin.email,
          })),
        });
        affected = res.count;
        summary = `Created ${affected} tasks: ${input.title}`;
        break;
      }
    }
    await logAudit({
      actorEmail: admin.email,
      action: "contacts.bulk",
      targetType: "contact",
      summary,
      meta: { action: input.action, requested: input.ids.length, affected },
    });
    return NextResponse.json({ affected });
  } catch (err) {
    const status = (err as { status?: number })?.status ?? 500;
    if (status === 500) console.error("[admin/contacts/bulk]", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: { code: status === 500 ? "INTERNAL_ERROR" : "UNAUTHORIZED", message: status === 500 ? "Something went wrong." : (err as Error).message } },
      { status }
    );
  }
}
