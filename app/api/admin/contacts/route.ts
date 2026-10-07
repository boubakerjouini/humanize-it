// ===========================================================
// GET  /api/admin/contacts — list contacts (filters → SegmentFilter → compileSegment;
//                             25 per page; `segment=` and base64 `filter=` supported)
// POST /api/admin/contacts — add a manual lead or outreach prospect (never sets consent)
// ===========================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { logAudit } from "@/lib/audit";
import { isValidEmail, normalizeEmail } from "@/lib/email/address";
import { PIPELINE_STAGES } from "@/lib/growth/constants";
import { isUniqueViolation } from "@/lib/growth/safe";
import { getOrCreateContactForUser } from "@/lib/crm/contacts";
import { recordEvent } from "@/lib/crm/events";
import { recomputeContact } from "@/lib/crm/recompute";
import { contactType } from "@/lib/crm/contact-360";
import { effectivePlanId } from "@/lib/quota";
import { CONTACTS_PAGE_SIZE, parseContactQuery } from "./filters";
import { contactListSelect, resolveContactQuery } from "./query";

function fail(err: unknown) {
  const status = (err as { status?: number })?.status ?? 500;
  if (status === 500) console.error("[admin/contacts]", err instanceof Error ? err.message : err);
  return NextResponse.json(
    { error: { code: status === 500 ? "INTERNAL_ERROR" : "UNAUTHORIZED", message: status === 500 ? "Something went wrong." : (err as Error).message } },
    { status }
  );
}

const bad = (message: string, status = 400, code = "INVALID_INPUT") => NextResponse.json({ error: { code, message } }, { status });

export async function GET(req: Request) {
  try {
    await requireAdmin();
    const parsed = parseContactQuery(new URL(req.url).searchParams);
    if (!parsed.ok) return bad(parsed.error);
    const { query } = parsed;
    const resolved = await resolveContactQuery(query);
    if (!resolved.ok) return bad(resolved.error, resolved.status, "NOT_FOUND");

    const [rows, total] = await Promise.all([
      db.contact.findMany({
        where: resolved.where,
        orderBy: resolved.orderBy,
        skip: (query.page - 1) * CONTACTS_PAGE_SIZE,
        take: CONTACTS_PAGE_SIZE,
        select: contactListSelect,
      }),
      db.contact.count({ where: resolved.where }),
    ]);

    const items = rows.map(({ user, ...c }) => ({
      ...c,
      type: contactType(c),
      plan: user ? effectivePlanId(user) : null,
    }));
    return NextResponse.json({
      items,
      total,
      page: query.page,
      totalPages: Math.max(1, Math.ceil(total / CONTACTS_PAGE_SIZE)),
      segmentName: resolved.segmentName,
      campaignTarget: resolved.campaignTarget,
    });
  } catch (err) {
    return fail(err);
  }
}

const createSchema = z.object({
  email: z.string().trim().max(254).optional().nullable(),
  name: z.string().trim().max(120).optional().nullable(),
  company: z.string().trim().max(120).optional().nullable(),
  handle: z.string().trim().max(120).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  pipelineStage: z.enum(PIPELINE_STAGES).optional().nullable(),
  note: z.string().trim().max(500).optional().nullable(),
});

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin();
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return bad("Invalid JSON.", 400, "INVALID_JSON");
    }
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return bad(parsed.error.issues[0]?.message ?? "Invalid input.");
    const input = parsed.data;
    const blank = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

    let email: string | null = null;
    if (blank(input.email)) {
      if (!isValidEmail(input.email)) return bad("That email address doesn't look valid.");
      email = normalizeEmail(input.email);
    }
    const name = blank(input.name);
    const handle = blank(input.handle);
    if (!email && !name && !handle) return bad("Give at least an email, a name or a handle.");

    if (email) {
      // An existing person keeps one contact: point the admin at it instead of duplicating.
      const existing = await db.contact.findUnique({ where: { email }, select: { id: true } });
      if (existing) return NextResponse.json({ error: { code: "ALREADY_EXISTS", message: "A contact with that email already exists.", contactId: existing.id } }, { status: 409 });
      const user = await db.user.findUnique({ where: { email }, select: { id: true } });
      if (user) {
        const contactId = await getOrCreateContactForUser(user.id);
        return NextResponse.json({ error: { code: "ALREADY_EXISTS", message: "That email belongs to a customer.", contactId } }, { status: 409 });
      }
    }

    const pipelineStage = input.pipelineStage ?? "to_contact";
    let contact: { id: string };
    try {
      contact = await db.contact.create({
        data: {
          email,
          name,
          company: blank(input.company),
          handle,
          phone: blank(input.phone),
          source: "manual",
          channel: "outreach",
          stage: email ? "lead" : "prospect",
          pipelineStage,
          pipelineUpdatedAt: new Date(),
        },
        select: { id: true },
      });
    } catch (err) {
      if (isUniqueViolation(err)) return bad("A contact with that email already exists.", 409, "ALREADY_EXISTS");
      throw err;
    }

    await recordEvent({ contactId: contact.id, type: "pipeline_changed", props: { from: null, to: pipelineStage }, actor: admin.email });
    const note = blank(input.note);
    if (note) await recordEvent({ contactId: contact.id, type: "note", props: { body: note }, actor: admin.email });
    await recomputeContact(contact.id).catch(() => null);
    await logAudit({
      actorEmail: admin.email,
      action: "contact.create",
      targetType: "contact",
      targetId: contact.id,
      summary: `Added ${email ? "lead" : "prospect"} ${name ?? handle ?? "contact"}`,
    });
    return NextResponse.json({ id: contact.id }, { status: 201 });
  } catch (err) {
    return fail(err);
  }
}
