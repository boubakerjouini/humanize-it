// ===========================================================
// POST /api/admin/email/personal — A 1:1 note from the founder to one contact
// (the contact 360 composer, stream A). Body: { contactId, subject, bodyMd }.
// Sent on the "personal" stream (plain layout, preferences link, respects
// every opt-out except topics), capped at 40 a day, deduplicated per
// recipient and content, audited. Refused (409 TEST_REQUIRED) until the admin
// sent themselves a test of this exact subject and body in the last day
// (POST ./test, lib/email/personal.ts). Returns { result: SendOutcome }.
// ===========================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { logAudit } from "@/lib/audit";
import { getOrCreateContactForUser } from "@/lib/crm/contacts";
import { PERSONAL_DAILY_LIMIT, personalEmailSchema, sendPersonalNote } from "@/lib/email/personal";
import { fail, handleError, readJson } from "../_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = personalEmailSchema.extend({
  contactId: z.string().trim().min(1).max(64),
});

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin();
    const json = await readJson(req);
    if (!json.ok) return json.response;
    const input = bodySchema.parse(json.body);
    const contact = await db.contact.findUnique({ where: { id: input.contactId }, select: { id: true } });
    if (!contact) return fail("NOT_FOUND", "Contact not found.", 404);

    const ownContactId = await getOrCreateContactForUser(admin.id);
    const sent = ownContactId ? await sendPersonalNote({ ownContactId, contactId: contact.id, email: input }) : { status: "test_required" as const };
    if (sent.status === "test_required") return fail("TEST_REQUIRED", "Send yourself a test of this exact email first, then send it.", 409);
    if (sent.status === "rate_limited") return fail("RATE_LIMITED", `Daily limit of ${PERSONAL_DAILY_LIMIT} personal emails reached.`, 429);

    const { result } = sent;
    await logAudit({
      actorEmail: admin.email,
      action: "email.personal.send",
      targetType: "contact",
      targetId: contact.id,
      summary: `Personal email "${input.subject.slice(0, 80)}": ${result.status}`,
      meta: { status: result.status, ...("reason" in result ? { reason: result.reason } : {}) },
    });
    return NextResponse.json({ result });
  } catch (err) {
    return handleError("admin-email-personal", err);
  }
}
