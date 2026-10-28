// ===========================================================
// POST /api/admin/sequences/[key]/test — Send one step of a sequence, "[TEST]"
// in the subject and sample data in the body, to the admin's own inbox. Body:
// { stepKey }. A test that went out marks that step's current content tested
// for a week; PATCH ../ { enabled: true } needs every step tested
// (lib/email/sequence-test.ts). Shares the 40/day test cap with personal
// emails, audited sequence.test_send. Returns { ok, to, result, message }.
// ===========================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin";
import { logAudit } from "@/lib/audit";
import { isSequenceKey } from "@/lib/email/catalog";
import { getOrCreateContactForUser } from "@/lib/crm/contacts";
import { PERSONAL_DAILY_LIMIT, testOutcomeMessage } from "@/lib/email/personal";
import { sendStepTest } from "@/lib/email/sequence-test";
import { fail, handleError, readJson } from "../../../email/_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ key: string }> };
const bodySchema = z.object({ stepKey: z.string().trim().min(1).max(64) });

export async function POST(req: Request, { params }: Ctx) {
  try {
    const admin = await requireAdmin();
    const { key } = await params;
    if (!isSequenceKey(key)) return fail("NOT_FOUND", "Unknown sequence.", 404);
    const json = await readJson(req);
    if (!json.ok) return json.response;
    const { stepKey } = bodySchema.parse(json.body);

    const contactId = await getOrCreateContactForUser(admin.id);
    if (!contactId) return fail("NO_CONTACT", "No contact record for your own inbox.", 409);

    const sent = await sendStepTest(contactId, key, stepKey);
    if (sent.status === "unknown_step") return fail("NOT_FOUND", "Unknown step.", 404);
    if (sent.status === "template_missing") return fail("TEMPLATE_MISSING", "This step's template isn't built yet.", 404);
    if (sent.status === "rate_limited") return fail("RATE_LIMITED", `Daily limit of ${PERSONAL_DAILY_LIMIT} test emails reached.`, 429);

    const { result } = sent;
    await logAudit({
      actorEmail: admin.email,
      action: "sequence.test_send",
      targetType: "flow",
      targetId: key,
      summary: `Test of ${key} / ${stepKey}: ${result.status}`,
      meta: { stepKey, status: result.status, ...("reason" in result ? { reason: result.reason } : {}) },
    });

    const ok = result.status === "sent";
    const message = ok ? `Test sent to ${admin.email}. Read it before you turn the flow on.` : testOutcomeMessage(result, admin.email);
    return NextResponse.json({ ok, to: admin.email, result, message }, { status: ok ? 200 : 409 });
  } catch (err) {
    return handleError("admin-sequence-test", err);
  }
}
