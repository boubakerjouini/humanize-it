// ===========================================================
// PATCH /api/admin/enrollments/[id] — { action: "exit" | "pause" | "resume" }
// Pause keeps the enrollment's place; resume makes it due now (a step that
// became too late meanwhile is skipped, never sent days late). Exit is final.
// Audited as enrollment.<action>.
// ===========================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { logAudit } from "@/lib/audit";
import { fail, handleError, readJson } from "../../email/_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };
const bodySchema = z.object({ action: z.enum(["exit", "pause", "resume"]) });

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const json = await readJson(req);
    if (!json.ok) return json.response;
    const { action } = bodySchema.parse(json.body);
    const now = new Date();

    const transition = {
      exit: { from: ["active", "paused"], data: { status: "exited", exitedAt: now, exitReason: "admin", nextRunAt: null } },
      pause: { from: ["active"], data: { status: "paused" } },
      resume: { from: ["paused"], data: { status: "active", nextRunAt: now } },
    }[action];
    const res = await db.sequenceEnrollment.updateMany({ where: { id, status: { in: transition.from } }, data: transition.data });
    if (res.count !== 1) {
      const exists = await db.sequenceEnrollment.findUnique({ where: { id }, select: { status: true } });
      if (!exists) return fail("NOT_FOUND", "Enrollment not found.", 404);
      return fail("INVALID_STATE", `Can't ${action} an enrollment that is ${exists.status}.`, 409);
    }
    const row = await db.sequenceEnrollment.findUnique({ where: { id }, select: { sequenceKey: true, contactId: true, status: true } });
    await logAudit({
      actorEmail: admin.email,
      action: `enrollment.${action}`,
      targetType: "contact",
      targetId: row?.contactId ?? null,
      summary: `${action[0].toUpperCase()}${action.slice(1)} ${row?.sequenceKey ?? "sequence"} enrollment`,
      meta: { enrollmentId: id, sequenceKey: row?.sequenceKey ?? null },
    });
    return NextResponse.json({ ok: true, status: row?.status ?? null });
  } catch (err) {
    return handleError("admin-enrollment", err);
  }
}
