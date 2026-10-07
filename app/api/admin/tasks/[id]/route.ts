// ===========================================================
// PATCH  /api/admin/tasks/[id] — { status?: open|done|dismissed, title?, priority?, dueAt? }
// DELETE /api/admin/tasks/[id] — delete a task (a rule task deleted this cycle
//        can be created again by the rules; dismiss it to keep it away)
// ===========================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { logAudit } from "@/lib/audit";
import { TASK_PRIORITIES } from "../shared";

type Ctx = { params: Promise<{ id: string }> };

function fail(err: unknown) {
  const status = (err as { status?: number })?.status ?? 500;
  if (status === 500) console.error("[admin/tasks/:id]", err instanceof Error ? err.message : err);
  return NextResponse.json(
    { error: { code: status === 500 ? "INTERNAL_ERROR" : "UNAUTHORIZED", message: status === 500 ? "Something went wrong." : (err as Error).message } },
    { status }
  );
}
const bad = (message: string, status = 400, code = "INVALID_INPUT") => NextResponse.json({ error: { code, message } }, { status });

const schema = z
  .object({
    status: z.enum(["open", "done", "dismissed"]).optional(),
    title: z.string().trim().min(1).max(200).optional(),
    priority: z.enum(TASK_PRIORITIES).optional(),
    dueAt: z.coerce.date().nullable().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), "Nothing to update.");

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return bad("Invalid JSON.", 400, "INVALID_JSON");
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) return bad(parsed.error.issues[0]?.message ?? "Invalid input.");
    const input = parsed.data;
    const task = await db.crmTask.findUnique({ where: { id }, select: { status: true, title: true } });
    if (!task) return bad("Task not found.", 404, "NOT_FOUND");

    const closing = input.status && input.status !== "open";
    const updated = await db.crmTask.update({
      where: { id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...(input.dueAt !== undefined ? { dueAt: input.dueAt } : {}),
        ...(input.status !== undefined
          ? closing
            ? { status: input.status, completedAt: new Date(), completedBy: admin.email }
            : { status: "open", completedAt: null, completedBy: null }
          : {}),
      },
    });
    const action = input.status === "done" ? "task.complete" : input.status === "dismissed" ? "task.dismiss" : input.status === "open" ? "task.reopen" : "task.update";
    await logAudit({ actorEmail: admin.email, action, targetType: "task", targetId: id, summary: `${action.split(".")[1]}: ${updated.title}` });
    return NextResponse.json({ task: updated });
  } catch (err) {
    return fail(err);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const task = await db.crmTask.findUnique({ where: { id }, select: { title: true } });
    if (!task) return bad("Task not found.", 404, "NOT_FOUND");
    await db.crmTask.delete({ where: { id } });
    await logAudit({ actorEmail: admin.email, action: "task.delete", targetType: "task", targetId: id, summary: `Deleted task: ${task.title}` });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return fail(err);
  }
}
