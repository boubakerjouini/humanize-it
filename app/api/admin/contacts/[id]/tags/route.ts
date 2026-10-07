// ===========================================================
// POST   /api/admin/contacts/[id]/tags — { tagId } or { name } (created if new)
// DELETE /api/admin/contacts/[id]/tags — { tagId }
// lib/crm/tags.ts picks the table: UserTag for customers, ContactTag for leads.
// ===========================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin";
import { logAudit } from "@/lib/audit";
import { removeTagFromContact } from "@/lib/crm/tags";
import { resolveTag, tagContact } from "../../actions";

type Ctx = { params: Promise<{ id: string }> };

function fail(err: unknown) {
  const status = (err as { status?: number })?.status ?? 500;
  if (status === 500) console.error("[admin/contacts/tags]", err instanceof Error ? err.message : err);
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

const addSchema = z.object({ tagId: z.string().max(64).optional(), name: z.string().trim().max(40).optional() });

export async function POST(req: Request, { params }: Ctx) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const parsed = addSchema.safeParse(await readJson(req));
    if (!parsed.success) return bad("tagId or name required.");
    const tag = await resolveTag(parsed.data);
    if (!tag) return bad("tagId or name required.");
    if (!(await tagContact(id, tag.id))) return bad("Contact not found.", 404, "NOT_FOUND");
    await logAudit({ actorEmail: admin.email, action: "contact.tag.add", targetType: "contact", targetId: id, summary: `Tagged "${tag.name}"` });
    return NextResponse.json({ tag });
  } catch (err) {
    return fail(err);
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const parsed = z.object({ tagId: z.string().min(1).max(64) }).safeParse(await readJson(req));
    if (!parsed.success) return bad("tagId required.");
    await removeTagFromContact(id, parsed.data.tagId);
    await logAudit({ actorEmail: admin.email, action: "contact.tag.remove", targetType: "contact", targetId: id, summary: "Removed a tag" });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return fail(err);
  }
}
