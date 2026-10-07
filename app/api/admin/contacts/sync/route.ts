// ===========================================================
// POST /api/admin/contacts/sync — create the missing contact of every user and
// backfill their timeline (lib/crm/backfill.ts). Idempotent: every backfilled
// event has a dedupe key, so a second run adds nothing. Never enrolls anyone
// in a sequence and never grants consent.
// ===========================================================

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { logAudit } from "@/lib/audit";
import { backfillContacts } from "@/lib/crm/backfill";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST() {
  try {
    const admin = await requireAdmin();
    const result = await backfillContacts();
    await logAudit({
      actorEmail: admin.email,
      action: "contacts.sync",
      targetType: "contact",
      summary: `Synced contacts: ${result.created} created, ${result.linked} linked, ${result.merged} merged, ${result.events} events`,
      meta: result,
    });
    return NextResponse.json({ result });
  } catch (err) {
    const status = (err as { status?: number })?.status ?? 500;
    if (status === 500) console.error("[admin/contacts/sync]", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: { code: status === 500 ? "INTERNAL_ERROR" : "UNAUTHORIZED", message: status === 500 ? "Sync failed." : (err as Error).message } },
      { status }
    );
  }
}
