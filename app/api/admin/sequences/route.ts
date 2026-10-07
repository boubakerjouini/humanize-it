// ===========================================================
// GET /api/admin/sequences — Every flow and sequence with its toggle and
// 30-day numbers: active enrollments, emails sent, conversions (enrollments
// that exited as "converted"). No EmailFlowSetting row means OFF.
// ===========================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { FLOW_KEYS, FLOW_META, TEMPLATES, isTemplateKey } from "@/lib/email/catalog";
import { getSequence } from "@/lib/email/sequences";
import { SWEPT_SEQUENCES } from "@/lib/email/sweeps";
import { handleError } from "../email/_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();
    const since = new Date(Date.now() - 30 * 24 * 3_600_000);
    const [settings, enrollments, converted, sent] = await Promise.all([
      db.emailFlowSetting.findMany(),
      db.sequenceEnrollment.groupBy({ by: ["sequenceKey", "status"], _count: { _all: true } }),
      db.sequenceEnrollment.groupBy({ by: ["sequenceKey"], where: { exitReason: "converted", exitedAt: { gte: since } }, _count: { _all: true } }),
      db.emailMessage.groupBy({ by: ["template"], where: { sentAt: { gte: since } }, _count: { _all: true } }),
    ]);
    const sentByFlow = new Map<string, number>();
    for (const r of sent) {
      const flow = isTemplateKey(r.template) ? TEMPLATES[r.template].flow : null;
      if (flow) sentByFlow.set(flow, (sentByFlow.get(flow) ?? 0) + r._count._all);
    }
    const items = FLOW_KEYS.map((key) => {
      const setting = settings.find((s) => s.key === key);
      const seq = getSequence(key);
      const count = (status: string) => enrollments.find((e) => e.sequenceKey === key && e.status === status)?._count._all ?? 0;
      return {
        key,
        name: FLOW_META[key].name,
        kind: FLOW_META[key].kind,
        description: FLOW_META[key].description,
        audience: FLOW_META[key].audience,
        // Swept sequences enroll everyone who qualifies at the next daily run once switched on.
        swept: (SWEPT_SEQUENCES as readonly string[]).includes(key),
        trigger: seq?.trigger ?? "Sent right away when someone asks",
        steps: seq?.steps.length ?? 1,
        enabled: setting?.enabled === true,
        updatedBy: setting?.updatedBy ?? null,
        updatedAt: setting?.updatedAt ?? null,
        active: count("active"),
        paused: count("paused"),
        completed: count("completed"),
        sent30d: sentByFlow.get(key) ?? 0,
        converted30d: converted.find((c) => c.sequenceKey === key)?._count._all ?? 0,
      };
    });
    return NextResponse.json({ items });
  } catch (err) {
    return handleError("admin-sequences", err);
  }
}
