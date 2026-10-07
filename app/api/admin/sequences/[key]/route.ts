// ===========================================================
// /api/admin/sequences/[key]
//   GET    the flow's steps (offset, template, stream, condition) with per-step
//          counts by status and skip reason, plus a page of enrollments
//   PATCH  { enabled }: switch the flow on or off (audited sequence.enable /
//          sequence.disable). Turning a flow on enrolls nobody retroactively;
//          the Backfill action does that, explicitly.
// ===========================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { logAudit } from "@/lib/audit";
import { FLOW_META, TEMPLATES, isFlowKey, templatesOfFlow } from "@/lib/email/catalog";
import { invalidateFlowCache } from "@/lib/email/enroll";
import { getSequence } from "@/lib/email/sequences";
import { SWEPT_SEQUENCES } from "@/lib/email/sweeps";
import { fail, handleError, readJson } from "../../email/_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ key: string }> };
const PAGE_SIZE = 25;
const ENROLLMENT_STATUSES = ["active", "paused", "completed", "exited"];

export async function GET(req: Request, { params }: Ctx) {
  try {
    await requireAdmin();
    const { key } = await params;
    if (!isFlowKey(key)) return fail("NOT_FOUND", "Unknown flow.", 404);
    const url = new URL(req.url);
    const page = Math.max(1, Math.min(500, Number(url.searchParams.get("page")) || 1));
    const statusFilter = url.searchParams.get("status");
    const seq = getSequence(key);

    const steps = seq
      ? seq.steps.map((s) => ({
          key: s.key,
          offsetHours: s.offsetHours,
          template: s.template,
          stream: TEMPLATES[s.template].stream,
          topic: TEMPLATES[s.template].topic,
          condition: s.condition ?? null,
          maxLateHours: s.maxLateHours ?? 48,
        }))
      : templatesOfFlow(key).map((t) => ({
          key: t,
          offsetHours: 0,
          template: t,
          stream: TEMPLATES[t].stream,
          topic: TEMPLATES[t].topic,
          condition: null,
          maxLateHours: null,
        }));

    // Sequence steps are keyed by stepKey; one-off flows by template.
    const statsWhere = seq ? { sequenceKey: key } : { template: { in: steps.map((s) => s.template) } };
    const by = seq ? (["stepKey", "status"] as const) : (["template", "status"] as const);
    const [statusRows, skipRows] = await Promise.all([
      db.emailMessage.groupBy({ by: [...by], where: statsWhere, _count: { _all: true } }),
      db.emailMessage.groupBy({ by: [seq ? "stepKey" : "template", "skipReason"], where: { ...statsWhere, status: "skipped" }, _count: { _all: true } }),
    ]);
    const stepOf = (r: { stepKey?: string | null; template?: string }) => (seq ? r.stepKey : r.template) ?? "";
    const stepStats = steps.map((s) => {
      const counts: Record<string, number> = {};
      for (const r of statusRows) if (stepOf(r) === s.key) counts[r.status] = r._count._all;
      const skipped: Record<string, number> = {};
      for (const r of skipRows) if (stepOf(r) === s.key) skipped[r.skipReason ?? "unknown"] = r._count._all;
      return { key: s.key, counts, skipped };
    });

    const where = { sequenceKey: key, ...(statusFilter && ENROLLMENT_STATUSES.includes(statusFilter) ? { status: statusFilter } : {}) };
    const [setting, active, total, enrollments] = await Promise.all([
      db.emailFlowSetting.findUnique({ where: { key } }),
      seq ? db.sequenceEnrollment.count({ where: { sequenceKey: key, status: "active" } }) : Promise.resolve(0),
      seq ? db.sequenceEnrollment.count({ where }) : Promise.resolve(0),
      seq
        ? db.sequenceEnrollment.findMany({
            where,
            orderBy: { enrolledAt: "desc" },
            skip: (page - 1) * PAGE_SIZE,
            take: PAGE_SIZE,
            include: { contact: { select: { id: true, email: true, name: true } } },
          })
        : Promise.resolve([]),
    ]);

    const { playbook, ...meta } = FLOW_META[key];
    void playbook;
    return NextResponse.json({
      key,
      ...meta,
      isSequence: !!seq,
      swept: (SWEPT_SEQUENCES as readonly string[]).includes(key),
      active,
      trigger: seq?.trigger ?? "Sent right away when someone asks",
      enabled: setting?.enabled === true,
      updatedBy: setting?.updatedBy ?? null,
      updatedAt: setting?.updatedAt ?? null,
      steps,
      stepStats,
      enrollments: enrollments.map((e) => ({
        id: e.id,
        status: e.status,
        cycle: e.cycle,
        stepIndex: e.stepIndex,
        nextStep: seq?.steps[e.stepIndex]?.key ?? null,
        anchorAt: e.anchorAt,
        nextRunAt: e.nextRunAt,
        enrolledAt: e.enrolledAt,
        lastStepAt: e.lastStepAt,
        exitReason: e.exitReason,
        contact: e.contact,
      })),
      total,
      page,
      pageSize: PAGE_SIZE,
    });
  } catch (err) {
    return handleError("admin-sequence", err);
  }
}

const patchSchema = z.object({ enabled: z.boolean() });

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const admin = await requireAdmin();
    const { key } = await params;
    if (!isFlowKey(key)) return fail("NOT_FOUND", "Unknown flow.", 404);
    const json = await readJson(req);
    if (!json.ok) return json.response;
    const { enabled } = patchSchema.parse(json.body);
    const row = await db.emailFlowSetting.upsert({
      where: { key },
      create: { key, enabled, updatedBy: admin.email },
      update: { enabled, updatedBy: admin.email },
    });
    invalidateFlowCache(key);
    await logAudit({
      actorEmail: admin.email,
      action: enabled ? "sequence.enable" : "sequence.disable",
      targetType: "flow",
      targetId: key,
      summary: `${enabled ? "Enabled" : "Disabled"} ${FLOW_META[key].name}`,
    });
    return NextResponse.json({ ok: true, key, enabled: row.enabled });
  } catch (err) {
    return handleError("admin-sequence-toggle", err);
  }
}
