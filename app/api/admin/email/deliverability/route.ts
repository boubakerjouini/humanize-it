// ===========================================================
// GET /api/admin/email/deliverability — 30-day delivery health per stream:
// sent, delivered %, bounce %, complaint %, each with its threshold level
// (amber at 2% bounces / 0.1% complaints, red at 4% / 0.3%).
// ===========================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { breakerState, rateLevel } from "@/lib/email/circuit-breaker";
import { EMAIL_STREAMS } from "@/lib/growth/constants";
import { handleError } from "../_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();
    const now = new Date();
    const since = new Date(now.getTime() - 30 * 24 * 3_600_000);
    const base = { sentAt: { gte: since } };
    const [sent, delivered, bounced, complained, breaker] = await Promise.all([
      db.emailMessage.groupBy({ by: ["stream"], where: base, _count: { _all: true } }),
      db.emailMessage.groupBy({ by: ["stream"], where: { ...base, deliveredAt: { not: null } }, _count: { _all: true } }),
      db.emailMessage.groupBy({ by: ["stream"], where: { ...base, bouncedAt: { not: null } }, _count: { _all: true } }),
      db.emailMessage.groupBy({ by: ["stream"], where: { ...base, complainedAt: { not: null } }, _count: { _all: true } }),
      breakerState(now),
    ]);
    const count = (rows: { stream: string; _count: { _all: number } }[], stream: string) => rows.find((r) => r.stream === stream)?._count._all ?? 0;
    const streams = EMAIL_STREAMS.map((stream) => {
      const s = count(sent, stream);
      const b = count(bounced, stream);
      const c = count(complained, stream);
      const bounceRate = s ? b / s : 0;
      const complaintRate = s ? c / s : 0;
      return {
        stream,
        sent: s,
        delivered: count(delivered, stream),
        bounced: b,
        complained: c,
        deliveredRate: s ? count(delivered, stream) / s : 0,
        bounceRate,
        complaintRate,
        bounceLevel: rateLevel("bounce", bounceRate),
        complaintLevel: rateLevel("complaint", complaintRate),
      };
    });
    return NextResponse.json({ days: 30, streams, breaker });
  } catch (err) {
    return handleError("admin-deliverability", err);
  }
}
