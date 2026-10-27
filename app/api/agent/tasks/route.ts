// ===========================================================
// GET /api/agent/tasks — CRM tasks for the agent to work through or report.
// ?status=open (default) | done | dismissed | all, ?ruleKey=, ?contactId=,
// ?limit=1-100 (default 50). Newest first, each with its contact.
// Bearer auth (lib/agent/auth.ts).
// ===========================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAgent } from "@/lib/agent/auth";
import { handleError } from "@/app/api/admin/email/_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({
  status: z.enum(["open", "done", "dismissed", "all"]).default("open"),
  ruleKey: z.string().trim().min(1).max(64).optional(),
  contactId: z.string().trim().min(1).max(64).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export async function GET(req: Request) {
  try {
    requireAgent(req);
    const query = querySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
    const tasks = await db.crmTask.findMany({
      where: {
        ...(query.status !== "all" ? { status: query.status } : {}),
        ...(query.ruleKey ? { ruleKey: query.ruleKey } : {}),
        ...(query.contactId ? { contactId: query.contactId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: query.limit,
      select: {
        id: true,
        title: true,
        body: true,
        kind: true,
        priority: true,
        status: true,
        source: true,
        ruleKey: true,
        dueAt: true,
        createdAt: true,
        completedAt: true,
        completedBy: true,
        contact: { select: { id: true, name: true, email: true } },
      },
    });
    return NextResponse.json({ tasks });
  } catch (err) {
    return handleError("agent-tasks", err);
  }
}
