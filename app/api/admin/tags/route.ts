// GET/POST /api/admin/tags — list and create reusable customer tags.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { logAudit } from "@/lib/audit";

const fail = (err: unknown) => {
  const status = (err as { status?: number })?.status ?? 500;
  return NextResponse.json({ error: { message: status === 500 ? "Something went wrong." : (err as Error).message } }, { status });
};

export async function GET() {
  try {
    await requireAdmin();
    const tags = await db.tag.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { users: true } } } });
    return NextResponse.json({ tags: tags.map((t) => ({ id: t.id, name: t.name, color: t.color, count: t._count.users })) });
  } catch (err) {
    return fail(err);
  }
}

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin();
    const { name, color } = (await req.json()) as { name?: string; color?: string };
    if (!name?.trim()) return NextResponse.json({ error: { message: "Tag name required." } }, { status: 400 });
    const tag = await db.tag.upsert({
      where: { name: name.trim() },
      update: {},
      create: { name: name.trim(), color: color || "#7c3aed" },
    });
    await logAudit({ actorEmail: admin.email, action: "tag.create", targetType: "tag", targetId: tag.id, summary: `Tag "${tag.name}"` });
    return NextResponse.json({ tag });
  } catch (err) {
    return fail(err);
  }
}
