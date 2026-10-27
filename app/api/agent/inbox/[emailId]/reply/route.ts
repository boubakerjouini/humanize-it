// ===========================================================
// POST /api/agent/inbox/[emailId]/reply — Answer a support email as the
// founder. Body: { subject?, bodyMd, closeTask? (default true) }; the subject
// defaults to "Re: <original subject>". Same rule as every personal email:
// 409 TEST_REQUIRED until a test of this exact subject and body reached the
// founder's inbox (POST /api/agent/email/test). Sent on the personal stream to
// the sender's contact (a manual contact is created when they have none),
// threaded with In-Reply-To/References, within the shared 40-a-day cap,
// deduplicated and audited; the email's task is closed once it went out.
// Returns { result: SendOutcome, contactId, contactCreated, taskClosed }.
// ===========================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { AGENT_ACTOR, founderInbox, requireAgent } from "@/lib/agent/auth";
import { INBOUND_TASK_PREFIX, isEmailId, readReceivedEmail, replySubject } from "@/lib/agent/inbox";
import { logAudit } from "@/lib/audit";
import { upsertLeadContact } from "@/lib/crm/contacts";
import { PERSONAL_DAILY_LIMIT, hasRecentPersonalTest, personalDigest, personalEmailSchema, sendPersonalNote } from "@/lib/email/personal";
import { fail, handleError, readJson } from "@/app/api/admin/email/_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ emailId: string }> };

const bodySchema = z.object({
  subject: z.string().trim().min(1).max(150).optional(),
  bodyMd: z.string().trim().min(1).max(10_000),
  closeTask: z.boolean().default(true),
});

const testRequired = () => fail("TEST_REQUIRED", "Send the founder a test of this exact reply first (POST /api/agent/email/test), then reply.", 409);

export async function POST(req: Request, { params }: Ctx) {
  try {
    requireAgent(req);
    const { emailId } = await params;
    if (!isEmailId(emailId)) return fail("INVALID_INPUT", "Not a Resend email id.", 400);
    const json = await readJson(req);
    if (!json.ok) return json.response;
    const input = bodySchema.parse(json.body);

    const read = await readReceivedEmail(emailId);
    if (!read.ok) {
      if (read.reason === "not_found") return fail("NOT_FOUND", "Resend has no received email with this id (it may have expired).", 404);
      return fail("UNAVAILABLE", `Couldn't read the email from Resend (${read.detail ?? read.reason}).`, 502);
    }
    const { email } = read;
    if (!email.sender || email.ownSender) return fail("NOT_REPLYABLE", "This email has no outside sender to answer.", 422);

    const note = personalEmailSchema.parse({ subject: input.subject ?? replySubject(email.subject), bodyMd: input.bodyMd });
    const founder = await founderInbox();
    if (!founder) return fail("NO_FOUNDER", "The founder's account isn't in the database.", 503);
    // Checked before the sender gets a contact, so an untested reply leaves no trace.
    if (!(await hasRecentPersonalTest(founder.contactId, personalDigest(note.subject, note.bodyMd)))) return testRequired();

    const lead = await upsertLeadContact({ email: email.sender, source: "manual" });
    if (!lead) return fail("NOT_REPLYABLE", "The sender's address isn't usable.", 422);

    const sent = await sendPersonalNote({ ownContactId: founder.contactId, contactId: lead.contactId, email: note, inReplyTo: email.messageId });
    if (sent.status === "test_required") return testRequired();
    if (sent.status === "rate_limited") return fail("RATE_LIMITED", `Daily limit of ${PERSONAL_DAILY_LIMIT} personal emails reached.`, 429);

    const { result } = sent;
    let taskClosed = false;
    if (input.closeTask && (result.status === "sent" || result.status === "duplicate")) {
      const closed = await db.crmTask.updateMany({
        where: { dedupeKey: `${INBOUND_TASK_PREFIX}${emailId}`, status: "open" },
        data: { status: "done", completedAt: new Date(), completedBy: AGENT_ACTOR },
      });
      taskClosed = closed.count > 0;
    }
    await logAudit({
      actorEmail: AGENT_ACTOR,
      action: "email.personal.reply",
      targetType: "contact",
      targetId: lead.contactId,
      summary: `Reply to support email "${note.subject.slice(0, 80)}": ${result.status}`,
      meta: { status: result.status, emailId, taskClosed, ...("reason" in result ? { reason: result.reason } : {}) },
    });
    return NextResponse.json({ result, contactId: lead.contactId, contactCreated: lead.created, taskClosed });
  } catch (err) {
    return handleError("agent-inbox-reply", err);
  }
}
