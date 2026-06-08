// ===========================================================
// GET  /api/admin/users    — list/search users (admin only)
// PATCH /api/admin/users    — change a user's plan or role (admin only)
// ===========================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, isAdminEmail } from "@/lib/admin";

function adminError(err: unknown) {
  const status = (err as { status?: number })?.status ?? 500;
  const message = status === 500 ? "Something went wrong." : (err as Error).message;
  return NextResponse.json({ error: { message } }, { status });
}

export async function GET(req: Request) {
  try {
    await requireAdmin();
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim();
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
    const limit = 25;

    const where = q
      ? { OR: [{ email: { contains: q, mode: "insensitive" as const } }, { name: { contains: q, mode: "insensitive" as const } }] }
      : {};

    const [users, total] = await Promise.all([
      db.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true, email: true, name: true, plan: true, role: true,
          wordsUsed: true, rewriteCount: true, createdAt: true, planExpiresAt: true,
          subscription: { select: { status: true } },
          _count: { select: { documents: true, memberships: true } },
        },
      }),
      db.user.count({ where }),
    ]);

    return NextResponse.json({ users, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    return adminError(err);
  }
}

export async function PATCH(req: Request) {
  try {
    const admin = await requireAdmin();
    const body = (await req.json()) as { userId?: string; plan?: string; role?: string };

    if (!body.userId) {
      return NextResponse.json({ error: { message: "userId is required." } }, { status: 400 });
    }

    const data: { plan?: "FREE" | "PRO" | "TEAM"; planExpiresAt?: null; role?: "USER" | "ADMIN" } = {};
    if (body.plan && ["FREE", "PRO", "TEAM"].includes(body.plan)) {
      data.plan = body.plan as "FREE" | "PRO" | "TEAM";
      data.planExpiresAt = null; // admin grants don't expire
    }
    if (body.role && ["USER", "ADMIN"].includes(body.role)) {
      // Guard: an admin cannot strip their own admin role (avoids self-lockout).
      if (body.userId === admin.id && body.role === "USER") {
        return NextResponse.json({ error: { message: "You cannot remove your own admin role." } }, { status: 400 });
      }
      if (body.role === "USER") {
        // Guard: allow-listed (founder) admins can't be demoted via this endpoint,
        // and don't allow demoting the last remaining DB admin.
        const target = await db.user.findUnique({ where: { id: body.userId }, select: { email: true } });
        if (target && isAdminEmail(target.email)) {
          return NextResponse.json({ error: { message: "Allow-listed admins can't be demoted here." } }, { status: 400 });
        }
        const adminCount = await db.user.count({ where: { role: "ADMIN" } });
        if (adminCount <= 1) {
          return NextResponse.json({ error: { message: "You can't remove the last admin." } }, { status: 400 });
        }
      }
      data.role = body.role as "USER" | "ADMIN";
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: { message: "Nothing to update." } }, { status: 400 });
    }

    const updated = await db.user.update({
      where: { id: body.userId },
      data,
      select: { id: true, email: true, plan: true, role: true },
    });

    return NextResponse.json({ user: updated });
  } catch (err) {
    return adminError(err);
  }
}
