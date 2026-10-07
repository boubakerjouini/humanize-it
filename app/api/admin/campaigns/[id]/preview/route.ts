// ===========================================================
// POST /api/admin/campaigns/[id]/preview — Render the saved campaign for the
// admin's own contact and count who would receive it, with the exclusions
// broken down by reason (no consent, unverified, suppressed, not allowlisted…).
// ===========================================================

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { previewCampaign } from "@/lib/email/campaigns";
import { handleError } from "../../../email/_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Ctx) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    return NextResponse.json(await previewCampaign(id, admin));
  } catch (err) {
    return handleError("admin-campaign-preview", err);
  }
}
