// ===========================================================
// POST /api/admin/campaigns/[id]/test — Send the campaign with "[TEST]" in
// the subject to the admin's own inbox, or to another allowlisted test inbox
// (body { to }). Only allowlisted inboxes (EMAIL_ALLOWLIST or an admin
// address) can receive a test, in every mode. A test that went out marks the
// campaign "tested" and pins its content hash. Audited campaign.test_send.
// ===========================================================

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { logAudit } from "@/lib/audit";
import { testSendCampaign } from "@/lib/email/campaigns";
import { z } from "zod";
import { fail, handleError } from "../../../email/_lib/respond";

const bodySchema = z.object({ to: z.string().trim().max(254).optional() }).strict();

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const DEFER_MESSAGES: Record<string, string> = {
  allowlist: "That inbox isn't on the allowlist, so the test was held back.",
  budget: "Today's email budget is used up. Try again tomorrow.",
  disabled: "Email sending is switched off.",
  not_configured: "Resend isn't configured.",
  error: "Something went wrong while sending.",
};

export async function POST(req: Request, { params }: Ctx) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    // The body is optional: no body (or no `to`) means the admin's own inbox.
    const raw = await req.text();
    let json: unknown = {};
    if (raw.trim()) {
      try {
        json = JSON.parse(raw);
      } catch {
        return fail("INVALID_JSON", "Invalid JSON body.", 400);
      }
    }
    const body = bodySchema.parse(json);
    const to = body.to || admin.email;
    const outcome = await testSendCampaign(id, admin, { to });
    await logAudit({
      actorEmail: admin.email,
      action: "campaign.test_send",
      targetType: "campaign",
      targetId: id,
      summary: `Test send to ${to === admin.email ? "own inbox" : to}: ${outcome.status}`,
      meta: { status: outcome.status, ...("reason" in outcome ? { reason: outcome.reason } : {}) },
    });
    const ok = outcome.status === "sent" || outcome.status === "duplicate";
    const message = ok
      ? `Test sent to ${to}.`
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
