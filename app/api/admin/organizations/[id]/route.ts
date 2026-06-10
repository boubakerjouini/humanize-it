// ===========================================================
// GET    /api/admin/organizations/[id]  — full organization 360 (admin only)
// PATCH  /api/admin/organizations/[id]  — actions: setSeats | setStatus
// ===========================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { resolveIdentities } from "@/lib/clerk-identity";
import { logAudit } from "@/lib/audit";
import { ORG_SEAT } from "@/lib/plans";

type Ctx = { params: Promise<{ id: string }> };

function adminError(err: unknown) {
  const status = (err as { status?: number })?.status ?? 500;
  return NextResponse.json({ error: { message: status === 500 ? "Something went wrong." : (err as Error).message } }, { status });
}

export async function GET(_req: Request, { params }: Ctx) {
  try {
    await requireAdmin();
    const { id } = await params;

    const org = await db.organization.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, clerkId: true, email: true } },
        memberships: {
          orderBy: { createdAt: "asc" },
          include: { user: { select: { id: true, clerkId: true, email: true, name: true } } },
        },
        invitations: { orderBy: { createdAt: "desc" } },
        _count: { select: { memberships: true, invitations: true } },
      },
    });
    if (!org) return NextResponse.json({ error: { message: "Organization not found." } }, { status: 404 });

    // Real identity from Clerk for the owner + every member (DB email/name may be a placeholder).
    const clerkIds = [org.owner.clerkId, ...org.memberships.map((m) => m.user.clerkId)];
    const identities = await resolveIdentities(clerkIds);

    const ownerIdent = identities.get(org.owner.clerkId);
    const owner = {
      id: org.owner.id,
      email: ownerIdent?.email ?? org.owner.email,
      name: ownerIdent?.name ?? null,
    };

    const members = org.memberships.map((m) => {
      const ident = identities.get(m.user.clerkId);
      return {
        membershipId: m.id,
        user: {
          id: m.user.id,
          email: ident?.email ?? m.user.email,
          name: ident?.name ?? m.user.name,
        },
        role: m.role,
        seatActive: m.seatActive,
      };
    });

    const seatsUsed = org.memberships.filter((m) => m.seatActive).length;
    const paid = !!org.lsSubscriptionId;
    // Est. MRR — per-seat monthly list price, only counted when org is on a paid LS subscription.
    const mrr = paid ? org.seatsTotal * ORG_SEAT.pricePerSeatMonthly : 0;

    return NextResponse.json({
      org: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        plan: org.plan,
        seatsTotal: org.seatsTotal,
        wordsUsed: org.wordsUsed,
        status: org.status,
        billingEmail: org.billingEmail,
        lsSubscriptionId: org.lsSubscriptionId,
        currentPeriodEnd: org.currentPeriodEnd,
        createdAt: org.createdAt,
        invitationCount: org._count.invitations,
      },
      owner,
      members,
      invitations: org.invitations.map((inv) => ({
        id: inv.id,
        email: inv.email,
        role: inv.role,
        status: inv.status,
        expiresAt: inv.expiresAt,
        createdAt: inv.createdAt,
      })),
      seatsUsed,
      mrr,
      paid,
    });
  } catch (err) {
    return adminError(err);
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const body = (await req.json()) as { action?: string; seats?: number; status?: string };

    const org = await db.organization.findUnique({ where: { id }, select: { name: true, seatsTotal: true, status: true } });
    if (!org) return NextResponse.json({ error: { message: "Organization not found." } }, { status: 404 });

    switch (body.action) {
      case "setSeats": {
        const seats = typeof body.seats === "number" ? Math.round(body.seats) : NaN;
        if (!Number.isFinite(seats) || seats < ORG_SEAT.minSeats || seats > ORG_SEAT.maxSeats) {
          return NextResponse.json({ error: { message: `Seats must be between ${ORG_SEAT.minSeats} and ${ORG_SEAT.maxSeats}.` } }, { status: 400 });
        }
        const activeSeats = await db.membership.count({ where: { organizationId: id, seatActive: true } });
        if (seats < activeSeats) {
          return NextResponse.json({ error: { message: `Cannot set fewer seats (${seats}) than active members (${activeSeats}).` } }, { status: 400 });
        }
        await db.organization.update({ where: { id }, data: { seatsTotal: seats } });
        await logAudit({ actorEmail: admin.email, action: "org.seats.set", targetType: "org", targetId: id, summary: `Seats ${org.seatsTotal} → ${seats}` });
        break;
      }
      case "setStatus": {
        if (!body.status || !["active", "past_due", "cancelled", "paused"].includes(body.status)) {
          return NextResponse.json({ error: { message: "Invalid status." } }, { status: 400 });
        }
        await db.organization.update({ where: { id }, data: { status: body.status } });
        await logAudit({ actorEmail: admin.email, action: "org.status.set", targetType: "org", targetId: id, summary: `Status ${org.status} → ${body.status}` });
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
