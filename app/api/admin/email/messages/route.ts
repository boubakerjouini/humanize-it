// ===========================================================
// GET /api/admin/email/messages — The email log, 50 per page.
// Filters: status, stream, template, campaignId, sequenceKey, q (contact
// email or name), from / to (ISO dates on queuedAt), page.
// Messages store only the address hash, so the address comes from the contact.
// ===========================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { Prisma } from "@/app/generated/prisma/client";
import { requireAdmin } from "@/lib/admin";
import { handleError } from "../_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

function param(url: URL, key: string, max = 100): string | null {
  const v = url.searchParams.get(key)?.trim();
  return v ? v.slice(0, max) : null;
}

function dateParam(url: URL, key: string): Date | null {
  const v = param(url, key);
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET(req: Request) {
  try {
    await requireAdmin();
    const url = new URL(req.url);
    const page = Math.max(1, Math.min(1000, Number(url.searchParams.get("page")) || 1));
    const and: Prisma.EmailMessageWhereInput[] = [];
    const status = param(url, "status");
    const stream = param(url, "stream");
    const template = param(url, "template");
    const campaignId = param(url, "campaignId");
    const sequenceKey = param(url, "sequenceKey");
    const contactId = param(url, "contactId");
    const q = param(url, "q");
    const from = dateParam(url, "from");
    const to = dateParam(url, "to");
    if (status) and.push({ status });
    if (stream) and.push({ stream });
    if (template) and.push({ template });
    if (campaignId) and.push({ campaignId });
    if (sequenceKey) and.push({ sequenceKey });
    if (contactId) and.push({ contactId });
    if (q) {
      and.push({ contact: { is: { OR: [{ email: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }] } } });
    }
    if (from) and.push({ queuedAt: { gte: from } });
    if (to) and.push({ queuedAt: { lte: to } });
    const where: Prisma.EmailMessageWhereInput = and.length ? { AND: and } : {};

    const [total, rows] = await Promise.all([
      db.emailMessage.count({ where }),
      db.emailMessage.findMany({
        where,
        orderBy: { queuedAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          id: true,
          template: true,
          stream: true,
          topic: true,
          subject: true,
          status: true,
          skipReason: true,
          error: true,
          attempts: true,
          sequenceKey: true,
          stepKey: true,
          campaignId: true,
          toDomain: true,
          queuedAt: true,
          sentAt: true,
          deliveredAt: true,
          bouncedAt: true,
          complainedAt: true,
          contact: { select: { id: true, email: true, name: true } },
          campaign: { select: { name: true } },
        },
      }),
    ]);
    return NextResponse.json({ items: rows, total, page, pageSize: PAGE_SIZE });
  } catch (err) {
    return handleError("admin-email-messages", err);
  }
}
