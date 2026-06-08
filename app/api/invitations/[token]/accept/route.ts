// ===========================================================
// POST /api/invitations/[token]/accept — accept a seat invitation
// Requires an authenticated session. Idempotent if already a member.
// ===========================================================

import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { applySeatEntitlement } from "@/lib/organizations";

interface RouteContext {
  params: Promise<{ token: string }>;
}

/** Thrown inside the seat transaction to map to a specific HTTP status. */
class SeatError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function POST(_req: Request, context: RouteContext) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: { message: "Please sign in to accept this invitation." } }, { status: 401 });
  }

  const { token } = await context.params;
  const user = await db.user.upsert({
    where: { clerkId },
    update: {},
    create: { clerkId, email: `${clerkId}@placeholder.humanize-it.app`, plan: "FREE", wordsUsed: 0 },
  });

  const invite = await db.invitation.findUnique({ where: { token } });
  if (!invite) {
    return NextResponse.json({ error: { message: "This invitation link is invalid." } }, { status: 404 });
  }

  // Already a member of this org? Treat as success (idempotent).
  const existingHere = await db.membership.findUnique({
    where: { organizationId_userId: { organizationId: invite.organizationId, userId: user.id } },
  });
  if (existingHere) {
    if (invite.status === "PENDING") await db.invitation.update({ where: { id: invite.id }, data: { status: "ACCEPTED" } });
    return NextResponse.json({ success: true, organizationId: invite.organizationId });
  }

  if (invite.status !== "PENDING" || invite.expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: { message: "This invitation has expired or was already used." } }, { status: 410 });
  }

  // Resolve the caller's real Clerk email; backfill a placeholder DB email.
  let realEmail: string | null = null;
  try {
    const cu = await currentUser();
    realEmail = cu?.primaryEmailAddress?.emailAddress?.trim().toLowerCase() ?? null;
    if (realEmail && user.email !== realEmail && user.email.endsWith("@placeholder.humanize-it.app")) {
      await db.user.update({ where: { id: user.id }, data: { email: realEmail } });
      user.email = realEmail;
    }
  } catch { /* best-effort */ }

  // The seat belongs to the invited person: require the email to match when known.
  if (realEmail && realEmail !== invite.email.toLowerCase()) {
    return NextResponse.json(
      { error: { message: `This invitation was sent to ${invite.email}. Sign in with that email to accept.` } },
      { status: 403 }
    );
  }

  // Snapshot the member's current personal plan so leaving the seat restores it.
  const priorPlan = user.plan;
  const priorPlanExpiresAt = user.planExpiresAt;

  // Claim the seat atomically: lock the org row so concurrent accepts can't
  // oversubscribe, re-count seats and re-check single-org membership inside the
  // transaction, then create the membership.
  try {
    await db.$transaction(async (tx) => {
      // Lock both the org row (serializes seat accounting) and the user row
      // (serializes this user's accepts so they can't land in two orgs at once).
      await tx.$queryRaw`SELECT id FROM "Organization" WHERE id = ${invite.organizationId} FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${user.id} FOR UPDATE`;

      const org = await tx.organization.findUnique({
        where: { id: invite.organizationId },
        select: { seatsTotal: true },
      });
      if (!org) throw new SeatError("This organization no longer exists.", 404);

      const activeMembers = await tx.membership.count({
        where: { organizationId: invite.organizationId, seatActive: true },
      });
      if (activeMembers >= org.seatsTotal) {
        throw new SeatError("This organization has no seats available.", 402);
      }

      const stillElsewhere = await tx.membership.findFirst({
        where: { userId: user.id, seatActive: true },
        select: { id: true },
      });
      if (stillElsewhere) {
        throw new SeatError("You're already part of another organization. Leave it first.", 409);
      }

      await tx.membership.create({
        data: {
          organizationId: invite.organizationId,
          userId: user.id,
          role: invite.role,
          seatActive: true,
          priorPlan,
          priorPlanExpiresAt,
        },
      });
      await tx.invitation.update({ where: { id: invite.id }, data: { status: "ACCEPTED" } });
    });
  } catch (e) {
    if (e instanceof SeatError) {
      return NextResponse.json({ error: { message: e.message } }, { status: e.status });
    }
    console.error("[invitations/accept] transaction failed:", e);
    return NextResponse.json({ error: { message: "Could not accept the invitation. Please try again." } }, { status: 500 });
  }

  // Member gets TEAM-tier features immediately.
  await applySeatEntitlement(user.id);

  return NextResponse.json({ success: true, organizationId: invite.organizationId });
}
