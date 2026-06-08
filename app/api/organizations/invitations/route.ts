// ===========================================================
// POST   /api/organizations/invitations — invite a member to a seat
// DELETE /api/organizations/invitations?id=… — revoke a pending invite
// ===========================================================

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getActiveMembership, isOrgManager, newInviteToken } from "@/lib/organizations";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INVITE_TTL_MS = 7 * 86_400_000; // 7 days

/** Sentinel thrown inside the seat-reservation transaction when no seat is free. */
class SeatFull extends Error {}

async function managerContext() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return { error: NextResponse.json({ error: { message: "Authentication required." } }, { status: 401 }) };
  const user = await db.user.findUnique({ where: { clerkId } });
  if (!user) return { error: NextResponse.json({ error: { message: "User not found." } }, { status: 401 }) };
  const membership = await getActiveMembership(user.id);
  if (!membership || !isOrgManager(membership.role)) {
    return { error: NextResponse.json({ error: { message: "Only owners and admins can manage seats." } }, { status: 403 }) };
  }
  return { user, organizationId: membership.organizationId };
}

export async function POST(req: Request) {
  const ctx = await managerContext();
  if (ctx.error) return ctx.error;

  const body = (await req.json().catch(() => ({}))) as { email?: string; role?: string };
  const email = (body.email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: { message: "Enter a valid email address." } }, { status: 400 });
  }
  const role = body.role === "ADMIN" ? "ADMIN" : "MEMBER";

  // Already a member?
  const alreadyMember = await db.membership.findFirst({
    where: { organizationId: ctx.organizationId, user: { email } },
    select: { id: true },
  });
  if (alreadyMember) {
    return NextResponse.json({ error: { message: "That person is already in your organization." } }, { status: 409 });
  }

  // Duplicate pending invite?
  const existingInvite = await db.invitation.findFirst({
    where: { organizationId: ctx.organizationId, email, status: "PENDING" },
    select: { id: true },
  });
  if (existingInvite) {
    return NextResponse.json({ error: { message: "There's already a pending invite for that email." } }, { status: 409 });
  }

  // Reserve a seat atomically: lock the org row, recount active members +
  // pending invites inside the transaction, then create the invite. This stops
  // two managers from both reserving the last seat (TOCTOU oversubscription).
  let invite;
  try {
    invite = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Organization" WHERE id = ${ctx.organizationId} FOR UPDATE`;

      const org = await tx.organization.findUnique({
        where: { id: ctx.organizationId },
        select: { seatsTotal: true },
      });
      const [used, pending] = await Promise.all([
        tx.membership.count({ where: { organizationId: ctx.organizationId, seatActive: true } }),
        tx.invitation.count({ where: { organizationId: ctx.organizationId, status: "PENDING" } }),
      ]);
      if (!org || org.seatsTotal - used - pending <= 0) {
        throw new SeatFull();
      }

      return tx.invitation.create({
        data: {
          organizationId: ctx.organizationId,
          email,
          role,
          token: newInviteToken(),
          invitedById: ctx.user.id,
          expiresAt: new Date(Date.now() + INVITE_TTL_MS),
        },
      });
    });
  } catch (e) {
    if (e instanceof SeatFull) {
      return NextResponse.json({ error: { message: "No seats available. Add more seats before inviting." } }, { status: 402 });
    }
    console.error("[organizations/invitations] create failed:", e);
    return NextResponse.json({ error: { message: "Could not create the invitation." } }, { status: 500 });
  }

  return NextResponse.json({
    invitation: { id: invite.id, email: invite.email, role: invite.role, token: invite.token, expiresAt: invite.expiresAt },
  });
}

export async function DELETE(req: Request) {
  const ctx = await managerContext();
  if (ctx.error) return ctx.error;

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: { message: "Invite id is required." } }, { status: 400 });

  const invite = await db.invitation.findUnique({ where: { id } });
  if (!invite || invite.organizationId !== ctx.organizationId) {
    return NextResponse.json({ error: { message: "Invite not found." } }, { status: 404 });
  }

  await db.invitation.update({ where: { id }, data: { status: "REVOKED" } });
  return NextResponse.json({ success: true });
}
