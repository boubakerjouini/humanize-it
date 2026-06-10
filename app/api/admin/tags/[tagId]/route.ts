// DELETE /api/admin/tags/[tagId] — remove a reusable customer tag (UserTag rows cascade).
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { logAudit } from "@/lib/audit";

type Ctx = { params: Promise<{ tagId: string }> };

const fail = (err: unknown) => {
  const status = (err as { status?: number })?.status ?? 500;
  return NextResponse.json({ error: { message: status === 500 ? "Something went wrong." : (err as Error).message } }, { status });
};

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const admin = await requireAdmin();
    const { tagId } = await params;

    const tag = await db.tag.findUnique({ where: { id: tagId }, select: { name: true } });
    if (!tag) return NextResponse.json({ error: { message: "Tag not found." } }, { status: 404 });

    // UserTag rows cascade via the UserTag.tag relation (onDelete: Cascade).
    await db.tag.delete({ where: { id: tagId } });
    await logAudit({ actorEmail: admin.email, action: "tag.delete", targetType: "tag", targetId: tagId, summary: `Deleted tag "${tag.name}"` });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return fail(err);
  }
}
