// ===========================================================
// GET /api/admin/pipeline?mode=outreach|lifecycle — board columns.
//   outreach:  one column per PIPELINE_STAGES value (contacts on the pipeline)
//   lifecycle: one column per lifecycle stage (read-only, override per card)
// At most 50 cards per column, with the full count for the "view all" link.
// Also returns today's outreach touches against OUTREACH_DAILY_GOAL.
// ===========================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { PIPELINE_STAGES } from "@/lib/growth/constants";
import { outreachDailyGoal } from "@/lib/growth/flags";
import { STAGES } from "@/lib/crm/lifecycle";
import { contactType } from "@/lib/crm/contact-360";
import { contactListSelect } from "../contacts/query";

const PER_COLUMN = 50;

export async function GET(req: Request) {
  try {
    await requireAdmin();
    const mode = new URL(req.url).searchParams.get("mode") === "lifecycle" ? "lifecycle" : "outreach";
    const now = new Date();
    const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    const keys: readonly string[] = mode === "outreach" ? PIPELINE_STAGES : STAGES;
    const field = mode === "outreach" ? "pipelineStage" : "stage";
    const [columns, touchesToday] = await Promise.all([
      Promise.all(
        keys.map(async (key) => {
          const where = { [field]: key };
          const [rows, total] = await Promise.all([
            db.contact.findMany({
              where,
              // Outreach: most recently moved first; lifecycle: hottest first.
              orderBy: mode === "outreach" ? [{ pipelineUpdatedAt: { sort: "desc", nulls: "last" } }, { id: "asc" }] : [{ score: "desc" }, { id: "asc" }],
              take: PER_COLUMN,
              select: { ...contactListSelect, pipelineUpdatedAt: true },
            }),
            db.contact.count({ where }),
          ]);
          return { key, total, items: rows.map(({ user, ...c }) => ({ ...c, type: contactType(c), plan: user?.plan ?? null })) };
        })
      ),
      db.contactEvent.count({ where: { type: "outreach_touch", occurredAt: { gte: dayStart } } }).catch(() => 0),
    ]);
    return NextResponse.json({ mode, columns, touchesToday, goal: outreachDailyGoal() });
  } catch (err) {
    const status = (err as { status?: number })?.status ?? 500;
    if (status === 500) console.error("[admin/pipeline]", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: { code: status === 500 ? "INTERNAL_ERROR" : "UNAUTHORIZED", message: status === 500 ? "Something went wrong." : (err as Error).message } },
      { status }
    );
  }
}
