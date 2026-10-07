// ===========================================================
// /api/admin/campaigns
//   GET   every campaign, newest first, with message counts
//   POST  create a draft { name, topic, segmentRef, subject, preheader?, bodyMd }
//         (audited campaign.create)
// ===========================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { logAudit } from "@/lib/audit";
import { campaignDraftSchema, campaignStats, createCampaign } from "@/lib/email/campaigns";
import { handleError, readJson } from "../email/_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();
    const campaigns = await db.emailCampaign.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
    const stats = await campaignStats(campaigns.map((c) => c.id));
    return NextResponse.json({
      items: campaigns.map((c) => ({
        id: c.id,
        name: c.name,
        topic: c.topic,
        segmentRef: c.segmentRef,
        subject: c.subject,
        status: c.status,
        recipientCount: c.recipientCount,
        createdAt: c.createdAt,
        confirmedAt: c.confirmedAt,
        completedAt: c.completedAt,
        stats: stats.get(c.id) ?? null,
      })),
    });
  } catch (err) {
    return handleError("admin-campaigns", err);
  }
}

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin();
    const json = await readJson(req);
    if (!json.ok) return json.response;
    const input = campaignDraftSchema.parse(json.body);
    const campaign = await createCampaign(input, admin);
    await logAudit({
      actorEmail: admin.email,
      action: "campaign.create",
      targetType: "campaign",
      targetId: campaign.id,
      summary: `Created campaign "${campaign.name}"`,
    });
    return NextResponse.json({ campaign }, { status: 201 });
  } catch (err) {
    return handleError("admin-campaigns", err);
  }
}
