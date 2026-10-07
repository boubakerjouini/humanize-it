// ===========================================================
// POST /api/admin/email/run — "Run now": starts the daily job after the
// response (the banner polls /api/admin/email/status for the result). The
// job's JobLock means a run already in progress (cron or another click) makes
// this one record "locked" instead of running twice. after() is bounded by this
// route's own maxDuration, hence 300 here too.
// ===========================================================

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { logAudit } from "@/lib/audit";
import { runDailyJob } from "@/lib/growth/daily-job";
import { runAfter } from "@/lib/growth/safe";
import { handleError } from "../_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST() {
  try {
    const admin = await requireAdmin();
    await logAudit({ actorEmail: admin.email, action: "email.job.run", targetType: "job", targetId: "growth-daily", summary: "Ran the daily growth job manually" });
    runAfter("admin-run-daily", () => runDailyJob({ trigger: "manual", actorEmail: admin.email }));
    return NextResponse.json({ ok: true, started: true }, { status: 202 });
  } catch (err) {
    return handleError("admin-email-run", err);
  }
}
