// ===========================================================
// /api/admin/email/suppressions — The hashed do-not-email list.
//   GET     newest 200, each matched to a contact when one has that address
//   POST    { email, scope, note? }: the address is hashed here and never stored
//   DELETE  ?id=: lift one suppression
// Suppressions outlive contact deletion, so the list holds hashes, not
// addresses. Every change is audited.
// ===========================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { logAudit } from "@/lib/audit";
import { emailHash, isValidEmail, maskEmail, normalizeEmail } from "@/lib/email/address";
import { fail, handleError, readJson } from "../_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LIST_LIMIT = 200;
/** Contacts hashed to match suppressions to people; plenty at this scale. */
const MATCH_LIMIT = 5000;

const addSchema = z.object({
  email: z.string().trim().max(320),
  scope: z.enum(["all", "nonessential", "marketing"]),
  note: z.string().trim().max(300).optional(),
});

export async function GET() {
  try {
    await requireAdmin();
    const rows = await db.emailSuppression.findMany({ orderBy: { createdAt: "desc" }, take: LIST_LIMIT });
    const wanted = new Set(rows.map((r) => r.emailHash));
    const contacts = await db.contact.findMany({
      where: { email: { not: null } },
      select: { id: true, email: true, name: true },
      orderBy: { createdAt: "desc" },
      take: MATCH_LIMIT,
    });
    const byHash = new Map<string, { id: string; email: string; name: string | null }>();
    for (const c of contacts) {
      if (!c.email) continue;
      const h = emailHash(c.email);
      if (wanted.has(h)) byHash.set(h, { id: c.id, email: c.email, name: c.name });
    }
    return NextResponse.json({
      items: rows.map((r) => ({
        id: r.id,
        hashPrefix: r.emailHash.slice(0, 10),
        scope: r.scope,
        reason: r.reason,
        source: r.source,
        note: r.note,
        createdAt: r.createdAt,
        contact: byHash.get(r.emailHash) ?? null,
      })),
    });
  } catch (err) {
    return handleError("admin-suppressions", err);
  }
}

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin();
    const json = await readJson(req);
    if (!json.ok) return json.response;
    const input = addSchema.parse(json.body);
    const email = normalizeEmail(input.email);
    if (!email || !isValidEmail(email)) return fail("INVALID_INPUT", "Enter a valid email address.", 400);
    const hash = emailHash(email);
    const row = await db.emailSuppression.upsert({
      where: { emailHash_scope: { emailHash: hash, scope: input.scope } },
      create: { emailHash: hash, scope: input.scope, reason: "manual", source: `admin:${admin.email}`.slice(0, 200), note: input.note || null },
      update: {},
    });
    await logAudit({
      actorEmail: admin.email,
      action: "email.suppression.add",
      targetType: "suppression",
      targetId: row.id,
      summary: `Suppressed ${maskEmail(email)} (${input.scope})`,
      meta: { scope: input.scope, hashPrefix: hash.slice(0, 10) },
    });
    return NextResponse.json({ ok: true, id: row.id });
  } catch (err) {
    return handleError("admin-suppressions", err);
  }
}

export async function DELETE(req: Request) {
  try {
    const admin = await requireAdmin();
    const id = new URL(req.url).searchParams.get("id")?.trim();
    if (!id) return fail("INVALID_INPUT", "Missing id.", 400);
    const row = await db.emailSuppression.findUnique({ where: { id } });
    if (!row) return fail("NOT_FOUND", "Suppression not found.", 404);
    await db.emailSuppression.delete({ where: { id } });
    await logAudit({
      actorEmail: admin.email,
      action: "email.suppression.remove",
      targetType: "suppression",
      targetId: id,
      summary: `Lifted a ${row.scope} suppression (${row.reason})`,
      meta: { scope: row.scope, reason: row.reason, hashPrefix: row.emailHash.slice(0, 10) },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleError("admin-suppressions", err);
  }
}
