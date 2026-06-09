// ===========================================================
// GET   /api/organizations — the current user's org (members, invites, seats)
// POST  /api/organizations — create an organization (caller becomes OWNER)
// PATCH /api/organizations — update name / seat count (managers only)
// ===========================================================

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureUser } from "@/lib/user";
import { ORG_SEAT } from "@/lib/plans";
import {
  uniqueOrgSlug,
  getActiveMembership,
  orgSeatUsage,
  isOrgManager,
  applySeatEntitlement,
  orgPooledLimit,
} from "@/lib/organizations";

async function currentUser() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return null;
  return ensureUser(clerkId);
}

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: { message: "Authentication required." } }, { status: 401 });

  const membership = await getActiveMembership(user.id);
  if (!membership) return NextResponse.json({ organization: null });

  const org = membership.organization;
  const [members, invitations, usage] = await Promise.all([
    db.membership.findMany({
      where: { organizationId: org.id },
      include: { user: { select: { id: true, email: true, name: true } } },
      orderBy: { createdAt: "asc" },
    }),
    db.invitation.findMany({
      where: { organizationId: org.id, status: "PENDING" },
      orderBy: { createdAt: "desc" },
    }),
    orgSeatUsage(org.id),
  ]);

  return NextResponse.json({
    organization: {
      id: org.id,
      name: org.name,
      slug: org.slug,
      seatsTotal: org.seatsTotal,
      status: org.status,
      pooledWordsLimit: orgPooledLimit(org.seatsTotal),
      wordsUsed: org.wordsUsed,
    },
    role: membership.role,
    canManage: isOrgManager(membership.role),
    usage,
    members: members.map(m => ({
      membershipId: m.id,
      userId: m.user.id,
      email: m.user.email,
      name: m.user.name,
      role: m.role,
      isSelf: m.user.id === user.id,
    })),
    invitations: invitations.map(i => ({ id: i.id, email: i.email, role: i.role, token: i.token, expiresAt: i.expiresAt })),
  });
}

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: { message: "Authentication required." } }, { status: 401 });

  // One active org membership per user (keeps seat accounting simple).
  const existing = await getActiveMembership(user.id);
  if (existing) {
    return NextResponse.json({ error: { message: "You're already part of an organization." } }, { status: 409 });
  }

  const body = (await req.json().catch(() => ({}))) as { name?: string; seats?: number };
  const name = (body.name ?? "").trim();
  if (name.length < 2) {
    return NextResponse.json({ error: { message: "Organization name is required." } }, { status: 400 });
  }
  const seats = Math.max(ORG_SEAT.minSeats, Math.min(ORG_SEAT.maxSeats, Number(body.seats) || ORG_SEAT.minSeats));

  const slug = await uniqueOrgSlug(name);
  const org = await db.organization.create({
    data: {
      name,
      slug,
      ownerId: user.id,
      plan: "TEAM",
      seatsTotal: seats,
      billingEmail: user.email,
      memberships: {
        create: {
          userId: user.id,
          role: "OWNER",
          seatActive: true,
          // Snapshot so the owner's prior plan is recoverable if the org is left/closed.
          priorPlan: user.plan,
          priorPlanExpiresAt: user.planExpiresAt,
        },
      },
    },
  });

  // Owner immediately gets TEAM-tier features.
  await applySeatEntitlement(user.id);

  return NextResponse.json({ organization: { id: org.id, name: org.name, slug: org.slug, seatsTotal: org.seatsTotal } });
}

export async function PATCH(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: { message: "Authentication required." } }, { status: 401 });

  const membership = await getActiveMembership(user.id);
  if (!membership || !isOrgManager(membership.role)) {
    return NextResponse.json({ error: { message: "Only owners and admins can manage the organization." } }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { name?: string; seatsTotal?: number };
  const data: { name?: string; seatsTotal?: number } = {};

  if (typeof body.name === "string" && body.name.trim().length >= 2) data.name = body.name.trim();

  if (body.seatsTotal != null) {
    const activeMembers = await db.membership.count({ where: { organizationId: membership.organizationId, seatActive: true } });
    const requested = Math.max(activeMembers, Math.min(ORG_SEAT.maxSeats, Number(body.seatsTotal)));
    data.seatsTotal = requested;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: { message: "Nothing to update." } }, { status: 400 });
  }

  const org = await db.organization.update({ where: { id: membership.organizationId }, data });
  return NextResponse.json({ organization: { id: org.id, name: org.name, seatsTotal: org.seatsTotal } });
}
