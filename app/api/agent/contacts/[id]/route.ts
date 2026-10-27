// ===========================================================
// GET /api/agent/contacts/[id] — One contact, by contact id or user id: who
// they are (name, email, stage, source, email status), their plan, the last
// emails sent to them and their open tasks. What the agent checks before it
// writes to someone. Bearer auth (lib/agent/auth.ts).
// ===========================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAgent } from "@/lib/agent/auth";
import { fail, handleError } from "@/app/api/admin/email/_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const ID = /^[A-Za-z0-9_-]{1,64}$/;

export async function GET(req: Request, { params }: Ctx) {
  try {
    requireAgent(req);
    const { id } = await params;
    if (!ID.test(id)) return fail("INVALID_INPUT", "Not a contact or user id.", 400);

    const contact = await db.contact.findFirst({
      where: { OR: [{ id }, { userId: id }] },
      select: {
        id: true,
        email: true,
        name: true,
        stage: true,
        source: true,
        emailStatus: true,
        lifecycleEmails: true,
        lastEmailedAt: true,
        createdAt: true,
        userId: true,
        user: { select: { plan: true, planExpiresAt: true, createdAt: true } },
        messages: {
          where: { NOT: { dedupeKey: { startsWith: "test:" } } },
          orderBy: { queuedAt: "desc" },
          take: 10,
          select: { template: true, subject: true, status: true, skipReason: true, sentAt: true, deliveredAt: true, bouncedAt: true },
        },
        tasks: {
          where: { status: "open" },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: { id: true, title: true, ruleKey: true, priority: true, createdAt: true },
        },
      },
    });
    if (!contact) return fail("NOT_FOUND", "Contact not found.", 404);
    return NextResponse.json({ contact });
  } catch (err) {
    return handleError("agent-contact", err);
  }
}
