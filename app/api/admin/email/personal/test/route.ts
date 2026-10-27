// ===========================================================
// POST /api/admin/email/personal/test — Send a personal email, "[TEST]" in the
// subject, to the admin's own inbox before it goes to anyone. Body:
// { subject, bodyMd }, exactly what the composer will send. A test that went
// out unlocks POST /api/admin/email/personal for that content for a day
// (lib/email/personal.ts). Capped at 40 a day, audited email.personal.test_send.
// Returns { ok, to, result: SendOutcome, message }.
// ===========================================================

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { logAudit } from "@/lib/audit";
import { getOrCreateContactForUser } from "@/lib/crm/contacts";
import { PERSONAL_DAILY_LIMIT, personalEmailSchema, sendPersonalTest, testOutcomeMessage } from "@/lib/email/personal";
import { fail, handleError, readJson } from "../../_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin();
    const json = await readJson(req);
    if (!json.ok) return json.response;
    const input = personalEmailSchema.parse(json.body);

    const contactId = await getOrCreateContactForUser(admin.id);
    if (!contactId) return fail("NO_CONTACT", "No contact record for your own inbox.", 409);

    const result = await sendPersonalTest(contactId, input);
    if (!result) return fail("RATE_LIMITED", `Daily limit of ${PERSONAL_DAILY_LIMIT} test emails reached.`, 429);
    await logAudit({
      actorEmail: admin.email,
      action: "email.personal.test_send",
      targetType: "contact",
      targetId: contactId,
      summary: `Test of personal email "${input.subject.slice(0, 80)}": ${result.status}`,
      meta: { status: result.status, ...("reason" in result ? { reason: result.reason } : {}) },
    });

    const ok = result.status === "sent";
    return NextResponse.json({ ok, to: admin.email, result, message: testOutcomeMessage(result, admin.email) }, { status: ok ? 200 : 409 });
  } catch (err) {
    return handleError("admin-email-personal-test", err);
  }
}
