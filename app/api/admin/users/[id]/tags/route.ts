// POST/DELETE /api/admin/users/[id]/tags — attach/detach a tag to a customer.
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
    const { tagId, name } = (await req.json()) as { tagId?: string; name?: string };

    // Accept either an existing tagId or a name to create-then-attach.
    let tag = tagId
      ? await db.tag.findUnique({ where: { id: tagId } })
      : name?.trim()
        ? await db.tag.upsert({ where: { name: name.trim() }, update: {}, create: { name: name.trim() } })
        : null;
    if (!tag) return NextResponse.json({ error: { message: "tagId or name required." } }, { status: 400 });

    await db.userTag.upsert({
      where: { userId_tagId: { userId: id, tagId: tag.id } },
      update: {},
      create: { userId: id, tagId: tag.id },
    });
    await logAudit({ actorEmail: admin.email, action: "user.tag.add", targetType: "user", targetId: id, summary: `Tagged "${tag.name}"` });
    return NextResponse.json({ tag });
  } catch (err) {
    return fail(err);
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const { tagId } = (await req.json()) as { tagId?: string };
    if (!tagId) return NextResponse.json({ error: { message: "tagId required." } }, { status: 400 });
    await db.userTag.deleteMany({ where: { userId: id, tagId } });
    await logAudit({ actorEmail: admin.email, action: "user.tag.remove", targetType: "user", targetId: id, summary: "Removed a tag" });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return fail(err);
  }
}
