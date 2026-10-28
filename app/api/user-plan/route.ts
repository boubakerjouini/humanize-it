import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdminUser } from "@/lib/admin";
import { describePlan, isOnFree } from "@/lib/plan-status";

export async function GET() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ plan: "FREE", isAdmin: false, organization: null });

  const user = await db.user.findUnique({
    where: { clerkId },
    select: {
      plan: true,
      planExpiresAt: true,
      subscription: { select: { status: true } },
      email: true,
      name: true,
      role: true,
      memberships: {
        where: { seatActive: true },
        select: { role: true, organization: { select: { id: true, name: true, slug: true } } },
        take: 1,
      },
    },
  });

  const membership = user?.memberships?.[0] ?? null;
  // A gift that has ended reads as Free right away, like /api/usage, instead of
  // staying Pro in the editor until the next request downgrades the row.
  const lapsed =
    !!user &&
    isOnFree(describePlan({ plan: user.plan, planExpiresAt: user.planExpiresAt?.toISOString() ?? null, subscriptionStatus: user.subscription?.status ?? null }));

  return NextResponse.json({
    plan: lapsed ? "FREE" : (user?.plan ?? "FREE"),
    email: user?.email,
    name: user?.name,
    isAdmin: isAdminUser(user),
    organization: membership
      ? { id: membership.organization.id, name: membership.organization.name, slug: membership.organization.slug, role: membership.role }
      : null,
  });
}
