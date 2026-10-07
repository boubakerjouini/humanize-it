// ===========================================================
// GET /api/admin/campaigns/targets[?ref=] — Audiences a campaign can target:
// the system segments with live counts (contacts with an email), or, with
// ?ref=, the name and count of one reference (a system segment, a saved
// segment id, or an inline "filter:" from the contacts page).
// ===========================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { resolveTarget } from "@/lib/email/campaigns";
import { SYSTEM_SEGMENTS, compileSegment } from "@/lib/crm/segments";
import { fail, handleError } from "../../email/_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await requireAdmin();
    const now = new Date();
    const ref = new URL(req.url).searchParams.get("ref");
    if (ref) {
      const target = await resolveTarget(ref.slice(0, 8000), now);
      if (!target) return fail("NOT_FOUND", "Unknown audience.", 404);
      const count = await db.contact.count({ where: { AND: [target.where, { email: { not: null } }] } });
      return NextResponse.json({ item: { id: ref, name: target.name, description: target.description, count } });
    }
    const items = await Promise.all(
      Object.values(SYSTEM_SEGMENTS).map(async (s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        count: await db.contact.count({ where: { AND: [compileSegment(s.filter, now), { email: { not: null } }] } }),
      }))
    );
    return NextResponse.json({ items });
  } catch (err) {
    return handleError("admin-campaign-targets", err);
  }
}
