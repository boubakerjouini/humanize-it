// ===========================================================
// GET /api/agent/inbox — The support inbox for the founder's agent: one row
// per email received at @humanizeit.app (its "Support email" task), newest
// first, plus the open daily notices (machine mail, caps, bouncing forwards).
// ?status=open (default) | all, ?limit=1-100 (default 30). Read one with
// GET ./[emailId]. Bearer auth (lib/agent/auth.ts).
// ===========================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAgent } from "@/lib/agent/auth";
import { INBOUND_TASK_PREFIX } from "@/lib/agent/inbox";
import { handleError } from "@/app/api/admin/email/_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({
  status: z.enum(["open", "all"]).default("open"),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

const TASK_FIELDS = { id: true, dedupeKey: true, title: true, body: true, status: true, priority: true, createdAt: true, completedAt: true, completedBy: true } as const;

export async function GET(req: Request) {
  try {
    requireAgent(req);
    const query = querySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
    const [emails, notices] = await Promise.all([
      db.crmTask.findMany({
        where: { ruleKey: "inbound_email", dedupeKey: { startsWith: INBOUND_TASK_PREFIX }, ...(query.status === "open" ? { status: "open" } : {}) },
        orderBy: { createdAt: "desc" },
        take: query.limit,
        select: TASK_FIELDS,
      }),
      db.crmTask.findMany({
        where: { ruleKey: "inbound_email", status: "open", NOT: { dedupeKey: { startsWith: INBOUND_TASK_PREFIX } } },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: TASK_FIELDS,
      }),
    ]);
    return NextResponse.json({
      emails: emails.map(({ dedupeKey, body, ...task }) => ({ emailId: dedupeKey?.slice(INBOUND_TASK_PREFIX.length) ?? null, ...task, notes: body })),
      notices: notices.map(({ dedupeKey: _key, body, ...task }) => ({ ...task, notes: body })),
    });
  } catch (err) {
    return handleError("agent-inbox", err);
  }
}
