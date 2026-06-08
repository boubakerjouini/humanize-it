// ===========================================================
// DELETE /api/organizations/members?id=<membershipId>
// Remove a member from the org, freeing their seat. Managers only.
// ===========================================================

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getActiveMembership, isOrgManager, restorePersonalPlan, applySeatEntitlement } from "@/lib/organizations";

export async function DELETE(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: { message: "Authentication required." } }, { status: 401 });

  const user = await db.user.findUnique({ where: { clerkId } });
  if (!user) return NextResponse.json({ error: { message: "User not found." } }, { status: 401 });

  const membership = await getActiveMembership(user.id);
  if (!membership || !isOrgManager(membership.role)) {
    return NextResponse.json({ error: { message: "Only owners and admins can remove members." } }, { status: 403 });
  }

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: { message: "Membership id is required." } }, { status: 400 });

  const target = await db.membership.findUnique({ where: { id } });
  if (!target || target.organizationId !== membership.organizationId) {
    return NextResponse.json({ error: { message: "Member not found." } }, { status: 404 });
  }
  if (target.role === "OWNER") {
    return NextResponse.json({ error: { message: "The owner can't be removed." } }, { status: 400 });
  }

  const removedUserId = target.userId;
  await db.membership.delete({ where: { id } });

  // If they still hold a seat elsewhere keep TEAM; otherwise restore the plan
  // snapshot captured when the seat was granted (preserving a valid personal grant).
  const stillSeated = await db.membership.findFirst({
    where: { userId: removedUserId, seatActive: true },
    select: { id: true },
  });
  if (stillSeated) {
    await applySeatEntitlement(removedUserId);
  } else {
    await restorePersonalPlan(removedUserId, target.priorPlan, target.priorPlanExpiresAt);
  }

  return NextResponse.json({ success: true });
}
