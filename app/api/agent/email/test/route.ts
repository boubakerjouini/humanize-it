// ===========================================================
// POST /api/agent/email/test — The agent's "Send test to me": the email,
// "[TEST]" in the subject, goes to the founder's own inbox. Body:
// { subject, bodyMd }, exactly as it will be sent. A test that went out
// unlocks POST ./send and the inbox reply for that content for a day
// (lib/email/personal.ts). Shares the composer's 40-a-day test cap, audited
// email.personal.test_send under the agent. Returns { ok, to, result, message }.
// ===========================================================

import { NextResponse } from "next/server";
import { AGENT_ACTOR, founderInbox, requireAgent } from "@/lib/agent/auth";
import { logAudit } from "@/lib/audit";
import { PERSONAL_DAILY_LIMIT, personalEmailSchema, sendPersonalTest, testOutcomeMessage } from "@/lib/email/personal";
import { fail, handleError, readJson } from "@/app/api/admin/email/_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    requireAgent(req);
    const json = await readJson(req);
    if (!json.ok) return json.response;
    const input = personalEmailSchema.parse(json.body);

    const founder = await founderInbox();
    if (!founder) return fail("NO_FOUNDER", "The founder's account isn't in the database.", 503);

    const result = await sendPersonalTest(founder.contactId, input);
    if (!result) return fail("RATE_LIMITED", `Daily limit of ${PERSONAL_DAILY_LIMIT} test emails reached.`, 429);
    await logAudit({
      actorEmail: AGENT_ACTOR,
      action: "email.personal.test_send",
      targetType: "contact",
      targetId: founder.contactId,
      summary: `Test of personal email "${input.subject.slice(0, 80)}": ${result.status}`,
      meta: { status: result.status, ...("reason" in result ? { reason: result.reason } : {}) },
    });

    const ok = result.status === "sent";
    return NextResponse.json({ ok, to: founder.email, result, message: testOutcomeMessage(result, founder.email) }, { status: ok ? 200 : 409 });
  } catch (err) {
    return handleError("agent-email-test", err);
  }
}
