// ===========================================================
// POST /api/admin/campaigns/[id]/cancel — Stop a campaign: every message still
// queued is cancelled; emails already sent stay sent. Audited campaign.cancel.
// ===========================================================

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { logAudit } from "@/lib/audit";
import { cancelCampaign } from "@/lib/email/campaigns";
import { handleError } from "../../../email/_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Ctx) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const { cancelled } = await cancelCampaign(id);
    await logAudit({
      actorEmail: admin.email,
      action: "campaign.cancel",
      targetType: "campaign",
      targetId: id,
      summary: `Cancelled campaign (${cancelled} queued messages dropped)`,
      meta: { cancelled },
    });
    return NextResponse.json({ ok: true, cancelled });
  } catch (err) {
    return handleError("admin-campaign-cancel", err);
  }
}
