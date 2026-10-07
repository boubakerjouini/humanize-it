// ===========================================================
// POST /api/admin/campaigns/[id]/send — Confirm and send. Body: { confirmCount }.
// confirmCount must equal the eligible count computed now, the campaign must
// be "tested" with unchanged content, sending must be on and the circuit
// breaker closed (lib/email/campaigns.ts checks all of it). Messages are queued
// in the same transaction, then drained after the response within the bulk
// budget; the daily job drains the rest. Audited campaign.send.
// ===========================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin";
import { logAudit } from "@/lib/audit";
import { drainCampaign, sendCampaign } from "@/lib/email/campaigns";
import { runAfter } from "@/lib/growth/safe";
import { handleError, readJson } from "../../../email/_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };
const bodySchema = z.object({ confirmCount: z.number().int().min(0).max(1_000_000) });

export async function POST(req: Request, { params }: Ctx) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const json = await readJson(req);
    if (!json.ok) return json.response;
    const { confirmCount } = bodySchema.parse(json.body);
    const { queued } = await sendCampaign(id, admin, confirmCount);
    await logAudit({
      actorEmail: admin.email,
      action: "campaign.send",
      targetType: "campaign",
      targetId: id,
      summary: `Confirmed campaign send to ${queued} recipients`,
      meta: { queued },
    });
    runAfter("campaign-drain", () => drainCampaign(id, { deadlineMs: Date.now() + 240_000 }));
    return NextResponse.json({ ok: true, queued });
  } catch (err) {
    return handleError("admin-campaign-send", err);
  }
}
