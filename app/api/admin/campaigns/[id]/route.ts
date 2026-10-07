// ===========================================================
// /api/admin/campaigns/[id]
//   GET     the campaign, its audience name and message counts
//   PATCH   edit the draft; any content change drops it back to draft (a new
//           test send is required). Audited campaign.update.
//   DELETE  drafts and tested campaigns only. Audited campaign.delete.
// ===========================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { logAudit } from "@/lib/audit";
import { campaignContentHash, campaignDraftSchema, campaignStats, deleteCampaign, resolveTarget, updateCampaign } from "@/lib/email/campaigns";
import { fail, handleError, readJson } from "../../email/_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    await requireAdmin();
    const { id } = await params;
    const campaign = await db.emailCampaign.findUnique({ where: { id } });
    if (!campaign) return fail("NOT_FOUND", "Campaign not found.", 404);
    const [target, stats] = await Promise.all([resolveTarget(campaign.segmentRef), campaignStats([id])]);
    return NextResponse.json({
      campaign,
      target: target ? { name: target.name, description: target.description } : null,
      stats: stats.get(id) ?? null,
      // Lets the editor show "changed since the test" without another request.
      testIsCurrent: !!campaign.contentHash && campaign.contentHash === campaignContentHash(campaign),
    });
  } catch (err) {
    return handleError("admin-campaign", err);
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const json = await readJson(req);
    if (!json.ok) return json.response;
    const input = campaignDraftSchema.parse(json.body);
    const campaign = await updateCampaign(id, input);
    await logAudit({
      actorEmail: admin.email,
      action: "campaign.update",
      targetType: "campaign",
      targetId: id,
      summary: `Edited campaign "${campaign.name}"${campaign.status === "draft" ? " (back to draft)" : ""}`,
    });
    return NextResponse.json({ campaign });
  } catch (err) {
    return handleError("admin-campaign", err);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const campaign = await deleteCampaign(id);
    await logAudit({ actorEmail: admin.email, action: "campaign.delete", targetType: "campaign", targetId: id, summary: `Deleted campaign "${campaign.name}"` });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleError("admin-campaign", err);
  }
}
