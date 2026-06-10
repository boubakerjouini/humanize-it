// POST/DELETE /api/admin/users/[id]/notes — admin notes on a customer.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { logAudit } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string }> };
const fail = (err: unknown) => {
  const status = (err as { status?: number })?.status ?? 500;
  return NextResponse.json({ error: { message: status === 500 ? "Something went wrong." : (err as Error).message } }, { status });
};

export async function POST(req: Request, { params }: Ctx) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const { body } = (await req.json()) as { body?: string };
    if (!body?.trim()) return NextResponse.json({ error: { message: "Note can't be empty." } }, { status: 400 });
    const note = await db.adminNote.create({ data: { subjectId: id, authorEmail: admin.email, body: body.trim() } });
    await logAudit({ actorEmail: admin.email, action: "note.add", targetType: "user", targetId: id, summary: "Added a note" });
    return NextResponse.json({ note });
  } catch (err) {
    return fail(err);
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const { noteId } = (await req.json()) as { noteId?: string };
    if (!noteId) return NextResponse.json({ error: { message: "noteId required." } }, { status: 400 });
    await db.adminNote.deleteMany({ where: { id: noteId, subjectId: id } });
    await logAudit({ actorEmail: admin.email, action: "note.delete", targetType: "user", targetId: id, summary: "Removed a note" });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return fail(err);
  }
}
