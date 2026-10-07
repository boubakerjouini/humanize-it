// ===========================================================
// /api/services — Founder services (lib/plans.ts FOUNDER_SERVICES)
//
// GET  → { services: [{ kind, name, eligible, left, cap, requested }] }
// POST { kind, note?, documentId? } → creates a CrmTask of that kind for the
//      founder's task list (source "request") and a service_requested event.
//
// Each service is real founder time: a shared monthly cap (UTC month) and one
// request per account. The cap check and the insert run under a transaction
// advisory lock so two requests can't both take the last slot; the per-account
// rule is the task's unique dedupeKey.
// ===========================================================

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ensureUser } from "@/lib/user";
import { checkAndResetQuota, planConfigFor } from "@/lib/quota";
import {
  FOUNDER_SERVICES,
  FOUNDER_SERVICE_KINDS,
  monthStartUtc,
  type FounderService,
  type PlanId,
} from "@/lib/plans";
import { getOrCreateContactForUser } from "@/lib/crm/contacts";
import { recordEvent } from "@/lib/crm/events";
import { isUniqueViolation, runAfter } from "@/lib/growth/safe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  kind: z.enum(FOUNDER_SERVICE_KINDS as [FounderService, ...FounderService[]]),
  note: z.string().trim().max(1_000).optional(),
  documentId: z.string().trim().min(1).max(64).optional(),
});

const dedupeKeyFor = (kind: FounderService, userId: string) => `service:${kind}:${userId}`;

function error(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

function usedThisMonth(kind: FounderService, now: Date) {
  return db.crmTask.count({ where: { kind, source: "request", createdAt: { gte: monthStartUtc(now) } } });
}

async function loadUser() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return null;
  const user = await checkAndResetQuota(await ensureUser(clerkId));
  return { user, planId: planConfigFor(user).id as PlanId };
}

export async function GET() {
  try {
    const ctx = await loadUser();
    if (!ctx) return error("UNAUTHORIZED", "Authentication required.", 401);
    const now = new Date();

    const services = await Promise.all(
      FOUNDER_SERVICE_KINDS.map(async (kind) => {
        const def = FOUNDER_SERVICES[kind];
        const [used, mine] = await Promise.all([
          usedThisMonth(kind, now),
          db.crmTask.findUnique({ where: { dedupeKey: dedupeKeyFor(kind, ctx.user.id) }, select: { createdAt: true, status: true } }),
        ]);
        return {
          kind,
          name: def.name,
          eligible: def.plans.includes(ctx.planId),
          cap: def.monthlyCap,
          left: Math.max(0, def.monthlyCap - used),
          requested: mine ? { at: mine.createdAt, status: mine.status } : null,
        };
      })
    );
    return NextResponse.json({ services });
  } catch (err) {
    console.error("[services] GET failed:", err);
    return error("INTERNAL_ERROR", "Something went wrong.", 500);
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await loadUser();
    if (!ctx) return error("UNAUTHORIZED", "Authentication required.", 401);
    const { user, planId } = ctx;

    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return error("INVALID_JSON", "Invalid JSON body.", 400);
    }
    const parsed = requestSchema.safeParse(raw);
    if (!parsed.success) return error("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input.", 400);
    const { kind, note, documentId } = parsed.data;
    const def = FOUNDER_SERVICES[kind];

    if (!def.plans.includes(planId)) {
      return error("PLAN_REQUIRED", `The ${def.name} is a ${def.plans.join(" / ")} bonus.`, 403);
    }

    let document: { id: string; title: string | null; wordCount: number } | null = null;
    if (documentId) {
      document = await db.document.findFirst({
        where: { id: documentId, userId: user.id },
        select: { id: true, title: true, wordCount: true },
      });
      if (!document) return error("NOT_FOUND", "Document not found.", 404);
    }

    const contactId = await getOrCreateContactForUser(user.id);
    const now = new Date();
    const dueAt = new Date(now.getTime() + 3 * 86_400_000);
    const lines = [
      `Requested by ${user.email} (${planId}).`,
      document ? `Document: "${document.title ?? "Untitled"}" (${document.wordCount} words), /admin/documents/${document.id}` : null,
      note ? `Their note: ${note}` : null,
    ].filter(Boolean);

    let left: number;
    try {
      left = await db.$transaction(async (tx) => {
        // Serialize requests for this service so the cap can't be overshot.
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`founder_service:${kind}`}))::text`;
        const used = await tx.crmTask.count({ where: { kind, source: "request", createdAt: { gte: monthStartUtc(now) } } });
        if (used >= def.monthlyCap) throw new CapReached();
        await tx.crmTask.create({
          data: {
            contactId,
            title: `${def.name}: ${user.email}`,
            body: lines.join("\n"),
            kind,
            priority: "high",
            status: "open",
            dueAt,
            source: "request",
            dedupeKey: dedupeKeyFor(kind, user.id),
            createdBy: "request",
          },
        });
        return def.monthlyCap - used - 1;
      });
    } catch (err) {
      if (err instanceof CapReached) {
        return error("CAP_REACHED", `All ${def.monthlyCap} slots for this month are taken. New slots open on the 1st.`, 409);
      }
      if (isUniqueViolation(err)) return error("ALREADY_REQUESTED", "You've already used this bonus.", 409);
      throw err;
    }

    runAfter("service-requested", () =>
      recordEvent({
        userId: user.id,
        type: "service_requested",
        props: { kind, documentId: document?.id ?? null },
        dedupeKey: dedupeKeyFor(kind, user.id),
      })
    );
    return NextResponse.json({ ok: true, left }, { status: 201 });
  } catch (err) {
    console.error("[services] POST failed:", err);
    return error("INTERNAL_ERROR", "Something went wrong.", 500);
  }
}

class CapReached extends Error {}
