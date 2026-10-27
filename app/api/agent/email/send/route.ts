// ===========================================================
// POST /api/agent/email/send — A 1:1 note from the founder to one contact,
// sent by the agent. Body: { contactId, subject, bodyMd }. Same rules as the
// admin composer (lib/email/personal.ts): 409 TEST_REQUIRED until the
// founder's inbox got a test of this exact content (POST ./test), the shared
// 40-a-day cap, deduplicated per recipient and content, audited
// email.personal.send under the agent. Returns { result: SendOutcome }.
// ===========================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { AGENT_ACTOR, founderInbox, requireAgent } from "@/lib/agent/auth";
import { logAudit } from "@/lib/audit";
import { PERSONAL_DAILY_LIMIT, personalEmailSchema, sendPersonalNote } from "@/lib/email/personal";
import { fail, handleError, readJson } from "@/app/api/admin/email/_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = personalEmailSchema.extend({
  contactId: z.string().trim().min(1).max(64),
});

export async function POST(req: Request) {
  try {
    requireAgent(req);
    const json = await readJson(req);
    if (!json.ok) return json.response;
    const input = bodySchema.parse(json.body);
    const contact = await db.contact.findUnique({ where: { id: input.contactId }, select: { id: true } });
    if (!contact) return fail("NOT_FOUND", "Contact not found.", 404);

    const founder = await founderInbox();
    if (!founder) return fail("NO_FOUNDER", "The founder's account isn't in the database.", 503);
    const sent = await sendPersonalNote({ ownContactId: founder.contactId, contactId: contact.id, email: input });
    if (sent.status === "test_required") return fail("TEST_REQUIRED", "Send the founder a test of this exact email first (POST /api/agent/email/test), then send it.", 409);
    if (sent.status === "rate_limited") return fail("RATE_LIMITED", `Daily limit of ${PERSONAL_DAILY_LIMIT} personal emails reached.`, 429);

    const { result } = sent;
    await logAudit({
      actorEmail: AGENT_ACTOR,
      action: "email.personal.send",
      targetType: "contact",
      targetId: contact.id,
      summary: `Personal email "${input.subject.slice(0, 80)}": ${result.status}`,
      meta: { status: result.status, ...("reason" in result ? { reason: result.reason } : {}) },
    });
    return NextResponse.json({ result });
  } catch (err) {
    return handleError("agent-email-send", err);
  }
}
