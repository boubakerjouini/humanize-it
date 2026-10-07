// ===========================================================
// POST /api/admin/tasks/run — run the auto task rules now (the daily job runs
// them too). Safe to repeat: rule tasks are deduped per rule, contact and cycle.
// ===========================================================

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { logAudit } from "@/lib/audit";
import { runAutoTaskRules } from "@/lib/crm/task-rules";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST() {
  try {
    const admin = await requireAdmin();
    const { created } = await runAutoTaskRules(new Date());
    await logAudit({ actorEmail: admin.email, action: "tasks.rules.run", targetType: "task", summary: `Ran task rules: ${created} created`, meta: { created } });
    return NextResponse.json({ created });
  } catch (err) {
    const status = (err as { status?: number })?.status ?? 500;
    if (status === 500) console.error("[admin/tasks/run]", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: { code: status === 500 ? "INTERNAL_ERROR" : "UNAUTHORIZED", message: status === 500 ? "The rules could not run." : (err as Error).message } },
      { status }
    );
  }
}
