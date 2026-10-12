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
import { hasRecentPersonalTest, personalDigest, personalEmailSchema } from "@/lib/email/personal";
import { sendEmail } from "@/lib/email/send";
import { checkDailyLimit } from "@/lib/rate-limit";
import { fail, handleError, readJson } from "../_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAILY_LIMIT = 40;

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

    const digest = personalDigest(input.subject, input.bodyMd);
    const ownContactId = await getOrCreateContactForUser(admin.id);
    if (!ownContactId || !(await hasRecentPersonalTest(ownContactId, digest))) {
      return fail("TEST_REQUIRED", "Send yourself a test of this exact email first, then send it.", 409);
    }

    const limit = await checkDailyLimit("admin:personal", DAILY_LIMIT);
    if (!limit.ok) return fail("RATE_LIMITED", `Daily limit of ${DAILY_LIMIT} personal emails reached.`, 429);

    const result = await sendEmail({
      contactId: contact.id,
      template: "personal_note",
      props: { subject: input.subject, bodyMd: input.bodyMd },
      dedupeKey: `personal:${contact.id}:${digest}`,
      pool: "inline",
    });
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
