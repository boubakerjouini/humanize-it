// ===========================================================
// GET  /api/admin/users    — list/search users (admin only); ?stage= filters
//                            by CRM lifecycle stage, rows carry stage and score
// PATCH /api/admin/users    — change a user's plan or role (admin only)
// ===========================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, isAdminEmail } from "@/lib/admin";
import { resolveIdentities } from "@/lib/clerk-identity";
import { logAudit } from "@/lib/audit";
import { runAfter } from "@/lib/growth/safe";
import { isStage } from "@/lib/crm/lifecycle";
import { trackAdminPlanChange } from "@/lib/crm/hooks";

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

    // The stage filter resolves user ids from the contacts table in its own
    // query, so the users query never joins a growth table (feature previews
    // run against a database that may not have it).
    const stage = url.searchParams.get("stage");
    let stageUserIds: string[] | null = null;
    if (stage && isStage(stage)) {
      const rows = await db.contact.findMany({ where: { stage, userId: { not: null } }, select: { userId: true } }).catch(() => []);
      stageUserIds = rows.map((r) => r.userId as string);
    }

    const where = {
      ...(q ? { OR: [{ email: { contains: q, mode: "insensitive" as const } }, { name: { contains: q, mode: "insensitive" as const } }] } : {}),
      ...(stageUserIds ? { id: { in: stageUserIds } } : {}),
    };

    const [users, total] = await Promise.all([
      db.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true, clerkId: true, email: true, name: true, plan: true, role: true,
          wordsUsed: true, rewriteCount: true, createdAt: true, planExpiresAt: true,
          subscription: { select: { status: true } },
          _count: { select: { documents: true, memberships: true } },
        },
      }),
      db.user.count({ where }),
    ]);

    // The DB email/name may be a placeholder; show the REAL identity from Clerk.
    const [identities, contacts] = await Promise.all([
      resolveIdentities(users.map((u) => u.clerkId)),
      db.contact
        .findMany({ where: { userId: { in: users.map((u) => u.id) } }, select: { id: true, userId: true, stage: true, stageOverride: true, score: true } })
        .catch(() => []),
    ]);
    const crm = new Map(contacts.map((c) => [c.userId, c]));
    const enriched = users.map(({ clerkId, ...u }) => {
      const id = identities.get(clerkId);
      const c = crm.get(u.id);
      return {
        ...u,
        email: id?.email ?? u.email,
        name: id?.name ?? u.name,
        imageUrl: id?.imageUrl ?? null,
        contactId: c?.id ?? null,
        stage: c?.stage ?? null,
        stageOverridden: !!c?.stageOverride,
        score: c?.score ?? null,
      };
    });

    return NextResponse.json({ users: enriched, total, page, totalPages: Math.ceil(total / limit) });
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

    if (data.plan) {
      await logAudit({ actorEmail: admin.email, action: "user.plan.set", targetType: "user", targetId: updated.id, summary: `Plan → ${data.plan} (no expiry)` });
      const plan = data.plan;
      runAfter("admin-plan-change", () => trackAdminPlanChange(updated.id, { action: "setPlan", plan, actor: admin.email }));
    }
    if (data.role) {
      await logAudit({ actorEmail: admin.email, action: "user.role.set", targetType: "user", targetId: updated.id, summary: `Role → ${data.role}` });
    }

    return NextResponse.json({ user: updated });
  } catch (err) {
    return adminError(err);
  }
}
