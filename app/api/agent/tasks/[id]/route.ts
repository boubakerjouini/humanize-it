// ===========================================================
// PATCH /api/agent/tasks/[id] — { status: open | done | dismissed }: the agent
// closes a task once the work is done (or reopens it), audited under the
// agent like the admin's task.complete / task.dismiss / task.reopen.
// ===========================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { AGENT_ACTOR, requireAgent } from "@/lib/agent/auth";
import { logAudit } from "@/lib/audit";
import { fail, handleError, readJson } from "@/app/api/admin/email/_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const bodySchema = z.object({ status: z.enum(["open", "done", "dismissed"]) });

const ACTIONS = { done: "task.complete", dismissed: "task.dismiss", open: "task.reopen" } as const;

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    requireAgent(req);
    const { id } = await params;
    const json = await readJson(req);
    if (!json.ok) return json.response;
    const { status } = bodySchema.parse(json.body);
    const task = await db.crmTask.findUnique({ where: { id }, select: { id: true } });
    if (!task) return fail("NOT_FOUND", "Task not found.", 404);

    const updated = await db.crmTask.update({
      where: { id },
      data:
        status === "open"
          ? { status, completedAt: null, completedBy: null }
          : { status, completedAt: new Date(), completedBy: AGENT_ACTOR },
      select: { id: true, title: true, status: true, completedAt: true, completedBy: true },
    });
    const action = ACTIONS[status];
    await logAudit({ actorEmail: AGENT_ACTOR, action, targetType: "task", targetId: id, summary: `${action.split(".")[1]}: ${updated.title}` });
    return NextResponse.json({ task: updated });
  } catch (err) {
    return handleError("agent-task-update", err);
  }
}
