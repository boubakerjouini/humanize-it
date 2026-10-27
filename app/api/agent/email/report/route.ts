// ===========================================================
// GET /api/agent/email/report — What the agent reads to tell the founder
// about email. ?days=1-30 (default 1). Sending mode, today's sends against the
// cap and the circuit breaker; outbound counts by status and by template; the
// problems (bounced, complained, failed) with their contact; the personal
// notes that went out; the support inbox (received, still open). Test sends
// (dedupe key test:...) are left out: they never reach a user.
// ===========================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAgent } from "@/lib/agent/auth";
import { INBOUND_TASK_PREFIX } from "@/lib/agent/inbox";
import { sentToday } from "@/lib/email/budget";
import { breakerState } from "@/lib/email/circuit-breaker";
import { emailDailyCap, emailSendingMode } from "@/lib/growth/flags";
import { handleError } from "@/app/api/admin/email/_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAY_MS = 86_400_000;

const querySchema = z.object({ days: z.coerce.number().int().min(1).max(30).default(1) });

const CONTACT = { select: { id: true, name: true, email: true } } as const;

export async function GET(req: Request) {
  try {
    requireAgent(req);
    const { days } = querySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
    const now = new Date();
    const since = new Date(now.getTime() - days * DAY_MS);
    const window = { queuedAt: { gte: since }, NOT: { dedupeKey: { startsWith: "test:" } } };

    const [byStatus, byTemplate, problems, personal, sent, breaker, received, openInbound] = await Promise.all([
      db.emailMessage.groupBy({ by: ["status"], where: window, _count: { _all: true } }),
      db.emailMessage.groupBy({ by: ["template", "status"], where: window, _count: { _all: true } }),
      db.emailMessage.findMany({
        where: {
          NOT: { dedupeKey: { startsWith: "test:" } },
          OR: [{ bouncedAt: { gte: since } }, { complainedAt: { gte: since } }, { status: "failed", queuedAt: { gte: since } }],
        },
        orderBy: { queuedAt: "desc" },
        take: 20,
        select: { template: true, subject: true, status: true, error: true, queuedAt: true, bouncedAt: true, complainedAt: true, contact: CONTACT },
      }),
      db.emailMessage.findMany({
        where: { ...window, template: "personal_note" },
        orderBy: { queuedAt: "desc" },
        take: 20,
        select: { subject: true, status: true, skipReason: true, sentAt: true, deliveredAt: true, bouncedAt: true, contact: CONTACT },
      }),
      sentToday(now),
      breakerState(now),
      db.crmTask.count({ where: { ruleKey: "inbound_email", dedupeKey: { startsWith: INBOUND_TASK_PREFIX }, createdAt: { gte: since } } }),
      db.crmTask.findMany({
        where: { ruleKey: "inbound_email", status: "open" },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { id: true, dedupeKey: true, title: true, priority: true, createdAt: true },
      }),
    ]);

    return NextResponse.json({
      window: { days, since: since.toISOString() },
      sending: {
        mode: emailSendingMode(),
        sentToday: sent,
        dailyCap: emailDailyCap(),
        breaker: { tripped: breaker.tripped, reason: breaker.reason, bounceRate: breaker.bounceRate, complaintRate: breaker.complaintRate },
      },
      outbound: {
        byStatus: Object.fromEntries(byStatus.map((row) => [row.status, row._count._all])),
        byTemplate: byTemplate.map((row) => ({ template: row.template, status: row.status, count: row._count._all })),
      },
      problems,
      personal,
      inbound: {
        received,
        open: openInbound.map(({ dedupeKey, ...task }) => ({
          ...task,
          emailId: dedupeKey?.startsWith(INBOUND_TASK_PREFIX) ? dedupeKey.slice(INBOUND_TASK_PREFIX.length) : null,
        })),
      },
    });
  } catch (err) {
    return handleError("agent-email-report", err);
  }
}
