// ===========================================================
// POST /api/admin/digest/test — Send the founder digest, "[TEST]" in the
// subject and today's live counts in the body, to the admin's own inbox. The
// real daily send stays locked until the founder sets FOUNDER_DIGEST_ENABLED
// (lib/growth/founder-digest.ts). Shares the 40/day test cap, audited
// digest.test_send. Returns { ok, to, result, message }.
// ===========================================================

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { logAudit } from "@/lib/audit";
import { getOrCreateContactForUser } from "@/lib/crm/contacts";
import { PERSONAL_DAILY_LIMIT, testOutcomeMessage } from "@/lib/email/personal";
import { sendFounderDigestTest } from "@/lib/growth/founder-digest";
import { fail, handleError } from "../../email/_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const admin = await requireAdmin();
    const contactId = await getOrCreateContactForUser(admin.id);
    if (!contactId) return fail("NO_CONTACT", "No contact record for your own inbox.", 409);

    const result = await sendFounderDigestTest(contactId);
    if (!result) return fail("RATE_LIMITED", `Daily limit of ${PERSONAL_DAILY_LIMIT} test emails reached.`, 429);
    await logAudit({
      actorEmail: admin.email,
      action: "digest.test_send",
      targetType: "contact",
      targetId: contactId,
      summary: `Test of the founder digest: ${result.status}`,
      meta: { status: result.status, ...("reason" in result ? { reason: result.reason } : {}) },
    });

    const ok = result.status === "sent";
    const message = ok ? `Test digest sent to ${admin.email}.` : testOutcomeMessage(result, admin.email);
    return NextResponse.json({ ok, to: admin.email, result, message }, { status: ok ? 200 : 409 });
  } catch (err) {
    return handleError("admin-digest-test", err);
  }
}
