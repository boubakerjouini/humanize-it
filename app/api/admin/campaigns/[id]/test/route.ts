// ===========================================================
// POST /api/admin/campaigns/[id]/test — Send the campaign to the admin's own
// inbox, "[TEST]" in the subject. Only allowlisted inboxes (EMAIL_ALLOWLIST or
// an admin address) can receive a test, in every mode. A test that went out
// marks the campaign "tested" and pins its content hash. Audited
// campaign.test_send.
// ===========================================================

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { logAudit } from "@/lib/audit";
import { testSendCampaign } from "@/lib/email/campaigns";
import { handleError } from "../../../email/_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const DEFER_MESSAGES: Record<string, string> = {
  allowlist: "Your address isn't on the allowlist, so the test was held back.",
  budget: "Today's email budget is used up. Try again tomorrow.",
  disabled: "Email sending is switched off.",
  not_configured: "Resend isn't configured.",
  error: "Something went wrong while sending.",
};

export async function POST(_req: Request, { params }: Ctx) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const outcome = await testSendCampaign(id, admin);
    await logAudit({
      actorEmail: admin.email,
      action: "campaign.test_send",
      targetType: "campaign",
      targetId: id,
      summary: `Test send to own inbox: ${outcome.status}`,
      meta: { status: outcome.status, ...("reason" in outcome ? { reason: outcome.reason } : {}) },
    });
    const ok = outcome.status === "sent" || outcome.status === "duplicate";
    const message = ok
      ? `Test sent to ${admin.email}.`
      : outcome.status === "deferred"
        ? (DEFER_MESSAGES[outcome.reason] ?? "The test was held back.")
        : outcome.status === "skipped"
          ? `The test was skipped (${outcome.reason.replace(/_/g, " ")}).`
          : `The test failed: ${outcome.error}`;
    return NextResponse.json({ ok, outcome, message }, { status: ok ? 200 : 409 });
  } catch (err) {
    return handleError("admin-campaign-test", err);
  }
}
