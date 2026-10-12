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
import { personalDigest, personalEmailSchema, personalTestKey } from "@/lib/email/personal";
import { sendEmail } from "@/lib/email/send";
import { checkDailyLimit } from "@/lib/rate-limit";
import { fail, handleError, readJson } from "../../_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAILY_LIMIT = 40;

const DEFER_MESSAGES: Record<string, string> = {
  allowlist: "Your inbox isn't on the allowlist, so the test was held back.",
  budget: "Today's email budget is used up. Try again tomorrow.",
  disabled: "Email sending is switched off.",
  not_configured: "Resend isn't configured.",
};

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin();
    const json = await readJson(req);
    if (!json.ok) return json.response;
    const input = personalEmailSchema.parse(json.body);

    const contactId = await getOrCreateContactForUser(admin.id);
    if (!contactId) return fail("NO_CONTACT", "No contact record for your own inbox.", 409);

    const limit = await checkDailyLimit("admin:personal-test", DAILY_LIMIT);
    if (!limit.ok) return fail("RATE_LIMITED", `Daily limit of ${DAILY_LIMIT} test emails reached.`, 429);

    const result = await sendEmail({
      contactId,
      template: "personal_note",
      props: { subject: input.subject, bodyMd: input.bodyMd },
      dedupeKey: personalTestKey(personalDigest(input.subject, input.bodyMd)),
      pool: "inline",
      isTest: true,
    });
    await logAudit({
      actorEmail: admin.email,
      action: "email.personal.test_send",
      targetType: "contact",
      targetId: contactId,
      summary: `Test of personal email "${input.subject.slice(0, 80)}": ${result.status}`,
      meta: { status: result.status, ...("reason" in result ? { reason: result.reason } : {}) },
    });

    const ok = result.status === "sent";
    const message = ok
      ? `Test sent to ${admin.email}. Check your inbox, then send it.`
      : result.status === "deferred"
        ? (DEFER_MESSAGES[result.reason] ?? "The test was held back.")
        : result.status === "skipped"
          ? `The test was skipped (${result.reason.replace(/_/g, " ")}).`
          : result.status === "failed"
            ? `The test failed: ${result.error}`
            : "The test was not sent.";
    return NextResponse.json({ ok, to: admin.email, result, message }, { status: ok ? 200 : 409 });
  } catch (err) {
    return handleError("admin-email-personal-test", err);
  }
}
