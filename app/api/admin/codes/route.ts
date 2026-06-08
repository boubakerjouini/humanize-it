// ===========================================================
// GET  /api/admin/codes — list discount codes (admin only)
// POST /api/admin/codes — create a discount code (admin only)
// ===========================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";

function adminError(err: unknown) {
  const status = (err as { status?: number })?.status ?? 500;
  const message = status === 500 ? "Something went wrong." : (err as Error).message;
  return NextResponse.json({ error: { message } }, { status });
}

export async function GET() {
  try {
    await requireAdmin();
    const codes = await db.discountCode.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { _count: { select: { redemptions: true } } },
    });
    return NextResponse.json({ codes });
  } catch (err) {
    return adminError(err);
  }
}

function randomCode(plan: string): string {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `HUMAN-${plan}-${rand}`;
}

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const body = (await req.json()) as { code?: string; plan?: string; maxUses?: number; grantDays?: number | null };

    const plan = body.plan === "TEAM" ? "TEAM" : "PRO";
    const code = (body.code?.trim() || randomCode(plan)).toUpperCase();
    const maxUses = Math.max(1, Math.min(100_000, Number(body.maxUses) || 1));
    const grantDays = body.grantDays === null ? null : Math.max(1, Number(body.grantDays) || 365);

    const existing = await db.discountCode.findUnique({ where: { code } });
    if (existing) {
      return NextResponse.json({ error: { message: "That code already exists." } }, { status: 409 });
    }

    const created = await db.discountCode.create({
      data: { code, plan, maxUses, grantDays },
      include: { _count: { select: { redemptions: true } } },
    });

    return NextResponse.json({ code: created });
  } catch (err) {
    return adminError(err);
  }
}
