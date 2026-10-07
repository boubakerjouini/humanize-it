// ===========================================================
// POST   /api/admin/contacts/[id]/notes — add a note. A customer's note is an
//        AdminNote (so the customer page shows it too); a lead's is a "note" event.
// DELETE /api/admin/contacts/[id]/notes — { noteId, source: "admin_note" | "event" }
// ===========================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { logAudit } from "@/lib/audit";
import { recordEvent } from "@/lib/crm/events";

type Ctx = { params: Promise<{ id: string }> };

function fail(err: unknown) {
  const status = (err as { status?: number })?.status ?? 500;
  if (status === 500) console.error("[admin/contacts/notes]", err instanceof Error ? err.message : err);
  return NextResponse.json(
    { error: { code: status === 500 ? "INTERNAL_ERROR" : "UNAUTHORIZED", message: status === 500 ? "Something went wrong." : (err as Error).message } },
    { status }
  );
}
const bad = (message: string, status = 400, code = "INVALID_INPUT") => NextResponse.json({ error: { code, message } }, { status });

async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

// Event props cap strings at 500 characters; keep both note kinds to the same limit.
const addSchema = z.object({ body: z.string().trim().min(1, "Note can't be empty.").max(500) });
const deleteSchema = z.object({ noteId: z.string().min(1).max(64), source: z.enum(["admin_note", "event"]) });

export async function POST(req: Request, { params }: Ctx) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const parsed = addSchema.safeParse(await readJson(req));
    if (!parsed.success) return bad(parsed.error.issues[0]?.message ?? "Invalid input.");
    const contact = await db.contact.findUnique({ where: { id }, select: { userId: true } });
    if (!contact) return bad("Contact not found.", 404, "NOT_FOUND");

    if (contact.userId) {
      await db.adminNote.create({ data: { subjectId: contact.userId, authorEmail: admin.email, body: parsed.data.body } });
    } else {
      const event = await recordEvent({ contactId: id, type: "note", props: { body: parsed.data.body }, actor: admin.email });
      if (!event) return bad("The note could not be saved.", 500, "DB_ERROR");
    }
    await logAudit({ actorEmail: admin.email, action: "note.add", targetType: "contact", targetId: id, summary: "Added a note" });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    return fail(err);
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const parsed = deleteSchema.safeParse(await readJson(req));
    if (!parsed.success) return bad("noteId and source are required.");
    const contact = await db.contact.findUnique({ where: { id }, select: { userId: true } });
    if (!contact) return bad("Contact not found.", 404, "NOT_FOUND");

    const { noteId, source } = parsed.data;
    const res =
      source === "admin_note"
        ? contact.userId
          ? await db.adminNote.deleteMany({ where: { id: noteId, subjectId: contact.userId } })
          : { count: 0 }
        : await db.contactEvent.deleteMany({ where: { id: noteId, contactId: id, type: "note" } });
    if (res.count === 0) return bad("Note not found.", 404, "NOT_FOUND");
    await logAudit({ actorEmail: admin.email, action: "note.delete", targetType: "contact", targetId: id, summary: "Removed a note" });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return fail(err);
  }
}
