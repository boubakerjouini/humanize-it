// ===========================================================
// GET  /api/admin/tasks — ?view=today|overdue|upcoming|done&kind=&contactId=
//      Days are UTC. "Today" also holds open tasks without a due date.
// POST /api/admin/tasks — create a manual task (optionally on a contact)
// ===========================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import type { Prisma } from "@/app/generated/prisma/client";
import { requireAdmin } from "@/lib/admin";
import { logAudit } from "@/lib/audit";
import { TASK_KINDS, TASK_VIEWS, type TaskView } from "./shared";

function fail(err: unknown) {
  const status = (err as { status?: number })?.status ?? 500;
  if (status === 500) console.error("[admin/tasks]", err instanceof Error ? err.message : err);
  return NextResponse.json(
    { error: { code: status === 500 ? "INTERNAL_ERROR" : "UNAUTHORIZED", message: status === 500 ? "Something went wrong." : (err as Error).message } },
    { status }
  );
}
const bad = (message: string, status = 400, code = "INVALID_INPUT") => NextResponse.json({ error: { code, message } }, { status });

function dayBounds(now: Date) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return { start, end: new Date(start.getTime() + 86_400_000) };
}

function viewWhere(view: TaskView, now: Date): Prisma.CrmTaskWhereInput {
  const { start, end } = dayBounds(now);
  switch (view) {
    case "overdue":
      return { status: "open", dueAt: { lt: start } };
    case "today":
      return { status: "open", OR: [{ dueAt: null }, { dueAt: { gte: start, lt: end } }] };
    case "upcoming":
      return { status: "open", dueAt: { gte: end } };
    case "done":
      return { status: { in: ["done", "dismissed"] } };
  }
}

const PRIORITY_RANK: Record<string, number> = { high: 0, normal: 1, low: 2 };
const dayOf = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "9999-99-99");

/** By due day, then priority (high first); the DB order breaks the remaining ties. */
function sortOpen<T extends { dueAt: Date | null; priority: string }>(items: T[]): T[] {
  return items
    .map((t, i) => ({ t, i }))
    .sort((a, b) => dayOf(a.t.dueAt).localeCompare(dayOf(b.t.dueAt)) || (PRIORITY_RANK[a.t.priority] ?? 1) - (PRIORITY_RANK[b.t.priority] ?? 1) || a.i - b.i)
    .map(({ t }) => t);
}

export async function GET(req: Request) {
  try {
    await requireAdmin();
    const params = new URL(req.url).searchParams;
    const viewRaw = params.get("view") ?? "today";
    if (!(TASK_VIEWS as readonly string[]).includes(viewRaw)) return bad("Unknown view.");
    const view = viewRaw as TaskView;
    const kind = params.get("kind");
    if (kind && !(TASK_KINDS as readonly string[]).includes(kind)) return bad("Unknown task kind.");
    const contactId = params.get("contactId");
    const now = new Date();

    const scope: Prisma.CrmTaskWhereInput = { ...(kind ? { kind } : {}), ...(contactId ? { contactId } : {}) };
    const [items, ...counts] = await Promise.all([
      db.crmTask.findMany({
        where: { AND: [scope, viewWhere(view, now)] },
        orderBy:
          view === "done"
            ? [{ completedAt: { sort: "desc", nulls: "last" } }, { updatedAt: "desc" }]
            : [{ dueAt: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
        take: view === "done" ? 100 : 200,
        include: { contact: { select: { id: true, name: true, email: true, stage: true, userId: true } } },
      }),
      ...TASK_VIEWS.map((v) => db.crmTask.count({ where: { AND: [scope, viewWhere(v, now)] } })),
    ]);
    return NextResponse.json({
      items: view === "done" ? items : sortOpen(items),
      counts: Object.fromEntries(TASK_VIEWS.map((v, i) => [v, counts[i]])),
    });
  } catch (err) {
    return fail(err);
  }
}

const createSchema = z.object({
  title: z.string().trim().min(1, "Give the task a title.").max(200),
  body: z.string().trim().max(2000).nullable().optional(),
  kind: z.enum(TASK_KINDS).default("follow_up"),
  priority: z.enum(["low", "normal", "high"]).default("normal"),
  dueAt: z.coerce.date().nullable().optional(),
  contactId: z.string().min(1).max(64).nullable().optional(),
});

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin();
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return bad("Invalid JSON.", 400, "INVALID_JSON");
    }
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return bad(parsed.error.issues[0]?.message ?? "Invalid input.");
    const input = parsed.data;
    if (input.contactId && !(await db.contact.findUnique({ where: { id: input.contactId }, select: { id: true } }))) {
      return bad("Contact not found.", 404, "NOT_FOUND");
    }
    const task = await db.crmTask.create({
      data: {
        title: input.title,
        body: input.body || null,
        kind: input.kind,
        priority: input.priority,
        dueAt: input.dueAt ?? null,
        contactId: input.contactId ?? null,
        source: "manual",
        createdBy: admin.email,
      },
    });
    await logAudit({ actorEmail: admin.email, action: "task.create", targetType: "task", targetId: task.id, summary: `Task: ${task.title}` });
    return NextResponse.json({ task }, { status: 201 });
  } catch (err) {
    return fail(err);
  }
}
