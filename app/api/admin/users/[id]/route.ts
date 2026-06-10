// ===========================================================
// GET    /api/admin/users/[id]  — full customer 360 (admin only)
// PATCH  /api/admin/users/[id]  — actions: setPlan | grant | setRole | resetQuota
// DELETE /api/admin/users/[id]  — delete a customer
// ===========================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, isAdminEmail } from "@/lib/admin";
import { resolveIdentities } from "@/lib/clerk-identity";
import { logAudit } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string }> };

function adminError(err: unknown) {
  const status = (err as { status?: number })?.status ?? 500;
  return NextResponse.json({ error: { message: status === 500 ? "Something went wrong." : (err as Error).message } }, { status });
}

export async function GET(_req: Request, { params }: Ctx) {
  try {
    await requireAdmin();
    const { id } = await params;

    // Core profile uses only long-existing tables, so it always loads.
    const user = await db.user.findUnique({
      where: { id },
      include: {
        subscription: true,
        documents: { orderBy: { createdAt: "desc" }, take: 20, select: { id: true, title: true, overallScore: true, humanizedScore: true, wordCount: true, status: true, createdAt: true } },
        redemptions: { orderBy: { redeemedAt: "desc" }, include: { discountCode: { select: { code: true, plan: true } } } },
        memberships: { include: { organization: { select: { id: true, name: true, slug: true } } } },
        _count: { select: { documents: true } },
      },
    });
    if (!user) return NextResponse.json({ error: { message: "User not found." } }, { status: 404 });

    const ident = (await resolveIdentities([user.clerkId])).get(user.clerkId);

    // CRM extras live in newer tables that may not exist in every environment
    // yet — fetch defensively so a missing table degrades to empty, never a 500.
    const [notes, tagRows, audit] = await Promise.all([
      db.adminNote.findMany({ where: { subjectId: id }, orderBy: { createdAt: "desc" } }).catch(() => []),
      db.userTag.findMany({ where: { userId: id }, include: { tag: true } }).catch(() => []),
      db.auditLog.findMany({ where: { targetType: "user", targetId: id }, orderBy: { createdAt: "desc" }, take: 40 }).catch(() => []),
    ]);

    return NextResponse.json({
      user: {
        id: user.id,
        clerkId: user.clerkId,
        email: ident?.email ?? user.email,
        name: ident?.name ?? user.name,
        imageUrl: ident?.imageUrl ?? null,
        plan: user.plan,
        role: user.role,
        planExpiresAt: user.planExpiresAt,
        wordsUsed: user.wordsUsed,
        rewriteCount: user.rewriteCount,
        quotaResetAt: user.quotaResetAt,
        createdAt: user.createdAt,
        documentCount: user._count.documents,
        paid: user.subscription?.status === "active",
      },
      subscription: user.subscription,
      documents: user.documents,
      redemptions: user.redemptions.map((r) => ({ id: r.id, code: r.discountCode.code, plan: r.discountCode.plan, redeemedAt: r.redeemedAt })),
      memberships: user.memberships.map((m) => ({ id: m.id, org: m.organization, role: m.role, seatActive: m.seatActive })),
      notes,
      tags: tagRows.map((t) => t.tag),
      audit,
    });
  } catch (err) {
    return adminError(err);
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const body = (await req.json()) as { action?: string; plan?: string; role?: string; days?: number | null };

    const target = await db.user.findUnique({ where: { id }, select: { email: true, plan: true, role: true } });
    if (!target) return NextResponse.json({ error: { message: "User not found." } }, { status: 404 });

    switch (body.action) {
      case "setPlan": {
        if (!body.plan || !["FREE", "PRO", "TEAM"].includes(body.plan)) return NextResponse.json({ error: { message: "Invalid plan." } }, { status: 400 });
        await db.user.update({ where: { id }, data: { plan: body.plan as "FREE" | "PRO" | "TEAM", planExpiresAt: null } });
        await logAudit({ actorEmail: admin.email, action: "user.plan.set", targetType: "user", targetId: id, summary: `Plan → ${body.plan} (no expiry)` });
        break;
      }
      case "grant": {
        if (!body.plan || !["PRO", "TEAM"].includes(body.plan)) return NextResponse.json({ error: { message: "Grant requires PRO or TEAM." } }, { status: 400 });
        const days = typeof body.days === "number" && body.days > 0 ? body.days : null;
        const planExpiresAt = days ? new Date(Date.now() + days * 86_400_000) : null;
        await db.user.update({ where: { id }, data: { plan: body.plan as "PRO" | "TEAM", planExpiresAt } });
        await logAudit({ actorEmail: admin.email, action: "user.grant", targetType: "user", targetId: id, summary: `Granted ${body.plan}${days ? ` for ${days}d` : " (lifetime)"}` });
        break;
      }
      case "setRole": {
        if (!body.role || !["USER", "ADMIN"].includes(body.role)) return NextResponse.json({ error: { message: "Invalid role." } }, { status: 400 });
        if (body.role === "USER") {
          if (id === admin.id) return NextResponse.json({ error: { message: "You cannot remove your own admin role." } }, { status: 400 });
          if (isAdminEmail(target.email)) return NextResponse.json({ error: { message: "Allow-listed admins can't be demoted here." } }, { status: 400 });
          if ((await db.user.count({ where: { role: "ADMIN" } })) <= 1) return NextResponse.json({ error: { message: "You can't remove the last admin." } }, { status: 400 });
        }
        await db.user.update({ where: { id }, data: { role: body.role as "USER" | "ADMIN" } });
        await logAudit({ actorEmail: admin.email, action: "user.role.set", targetType: "user", targetId: id, summary: `Role → ${body.role}` });
        break;
      }
      case "resetQuota": {
        await db.user.update({ where: { id }, data: { wordsUsed: 0, rewriteCount: 0, quotaResetAt: new Date() } });
        await logAudit({ actorEmail: admin.email, action: "user.quota.reset", targetType: "user", targetId: id, summary: "Quota reset" });
        break;
      }
      default:
        return NextResponse.json({ error: { message: "Unknown action." } }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return adminError(err);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    if (id === admin.id) return NextResponse.json({ error: { message: "You can't delete yourself." } }, { status: 400 });

    const target = await db.user.findUnique({ where: { id }, select: { email: true } });
    if (!target) return NextResponse.json({ error: { message: "User not found." } }, { status: 404 });
    if (isAdminEmail(target.email)) return NextResponse.json({ error: { message: "Allow-listed admins can't be deleted here." } }, { status: 400 });

    await db.user.delete({ where: { id } });
    await logAudit({ actorEmail: admin.email, action: "user.delete", targetType: "user", targetId: id, summary: `Deleted ${target.email}` });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return adminError(err);
  }
}
