// ===========================================================
// GET  /api/admin/audit  — list the admin audit log (admin only)
//   ?page=        paginated (50 per page), newest first
//   ?action=      filter by action substring (contains, case-insensitive)
//   ?targetType=  filter by exact target type ("user" | "org" | "code" | "tag")
// ===========================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import type { Prisma } from "@/app/generated/prisma/client";

function adminError(err: unknown) {
  const status = (err as { status?: number })?.status ?? 500;
  const message = status === 500 ? "Something went wrong." : (err as Error).message;
  return NextResponse.json({ error: { message } }, { status });
}

export async function GET(req: Request) {
  try {
    await requireAdmin();
    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
    const action = (url.searchParams.get("action") ?? "").trim();
    const targetType = (url.searchParams.get("targetType") ?? "").trim();
    const limit = 50;

    const where: Prisma.AuditLogWhereInput = {};
    if (action) where.action = { contains: action, mode: "insensitive" };
    if (targetType) where.targetType = targetType;

    const [logs, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.auditLog.count({ where }),
    ]);

    return NextResponse.json({ logs, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    return adminError(err);
  }
}
