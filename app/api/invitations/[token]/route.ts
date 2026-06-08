// ===========================================================
// GET /api/invitations/[token] — public: view an invitation's details
// ===========================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

interface RouteContext {
  params: Promise<{ token: string }>;
}

export async function GET(_req: Request, context: RouteContext) {
  const { token } = await context.params;

  const invite = await db.invitation.findUnique({
    where: { token },
    include: { organization: { select: { name: true } } },
  });

  if (!invite) {
    return NextResponse.json({ error: { message: "This invitation link is invalid." } }, { status: 404 });
  }

  const expired = invite.expiresAt.getTime() < Date.now();
  const usable = invite.status === "PENDING" && !expired;

  return NextResponse.json({
    organizationName: invite.organization.name,
    email: invite.email,
    role: invite.role,
    status: expired && invite.status === "PENDING" ? "EXPIRED" : invite.status,
    usable,
  });
}
