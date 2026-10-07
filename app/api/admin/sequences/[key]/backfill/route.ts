// ===========================================================
// POST /api/admin/sequences/[key]/backfill — Enroll people who qualified
// before the flow was switched on. Body: { dryRun: boolean }.
// The dry run counts candidates and how many of their steps would be skipped
// as too late; the real run (flow must be ON) enrolls the same candidates and
// is audited as sequence.backfill.
// ===========================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin";
import { logAudit } from "@/lib/audit";
import { FLOW_META, isSequenceKey } from "@/lib/email/catalog";
import { isFlowEnabled } from "@/lib/email/enroll";
import { enrollCandidates, findCandidates, previewBackfill } from "@/lib/email/sweeps";
import { fail, handleError, readJson } from "../../../email/_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Ctx = { params: Promise<{ key: string }> };
const bodySchema = z.object({ dryRun: z.boolean() });

export async function POST(req: Request, { params }: Ctx) {
  try {
    const admin = await requireAdmin();
    const { key } = await params;
    if (!isSequenceKey(key)) return fail("NOT_FOUND", "Only sequences can be backfilled.", 404);
    const json = await readJson(req);
    if (!json.ok) return json.response;
    const { dryRun } = bodySchema.parse(json.body);

    if (dryRun) return NextResponse.json({ ok: true, dryRun: true, ...(await previewBackfill(key)) });

    if (!(await isFlowEnabled(key))) return fail("FLOW_OFF", "Turn the flow on before backfilling.", 409);
    const candidates = await findCandidates(key);
    const enrolled = await enrollCandidates(key, candidates, admin.email);
    await logAudit({
      actorEmail: admin.email,
      action: "sequence.backfill",
      targetType: "flow",
      targetId: key,
      summary: `Backfilled ${FLOW_META[key].name}: ${enrolled} of ${candidates.length} enrolled`,
      meta: { candidates: candidates.length, enrolled },
    });
    return NextResponse.json({ ok: true, dryRun: false, candidates: candidates.length, enrolled });
  } catch (err) {
    return handleError("admin-sequence-backfill", err);
  }
}
