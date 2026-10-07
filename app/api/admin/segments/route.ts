// ===========================================================
// GET /api/admin/segments — system segments (and any saved ones) with live
// counts. Cross-stream contract (campaign editor):
//   { items: [{ id: "sys:<key>" | cuid, name, description, system, count }] }
// The custom segment builder was cut; segments are defined in lib/crm/segments.ts.
// ===========================================================

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { listSegmentsWithCounts } from "./counts";

export async function GET() {
  try {
    await requireAdmin();
    const items = await listSegmentsWithCounts();
    // The contract promises a number; a failed count reads as 0 rather than breaking the campaign editor.
    return NextResponse.json({ items: items.map((s) => ({ ...s, count: s.count ?? 0 })) });
  } catch (err) {
    const status = (err as { status?: number })?.status ?? 500;
    if (status === 500) console.error("[admin/segments]", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: { code: status === 500 ? "INTERNAL_ERROR" : "UNAUTHORIZED", message: status === 500 ? "Something went wrong." : (err as Error).message } },
      { status }
    );
  }
}
