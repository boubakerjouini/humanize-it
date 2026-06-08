import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdminUser } from "@/lib/admin";

export async function GET() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ plan: "FREE", isAdmin: false, organization: null });

  const user = await db.user.findUnique({
    where: { clerkId },
    select: {
      plan: true,
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

  return NextResponse.json({
    plan: user?.plan ?? "FREE",
    email: user?.email,
    name: user?.name,
    isAdmin: isAdminUser(user),
    organization: membership
      ? { id: membership.organization.id, name: membership.organization.name, slug: membership.organization.slug, role: membership.role }
      : null,
  });
}
