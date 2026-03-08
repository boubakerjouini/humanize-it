// ===========================================================
// DELETE /api/keys/[id] — Revoke an API key (soft delete)
// ===========================================================

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Authentication required." } },
        { status: 401 }
      );
    }

    const { id } = await params;

    const user = await db.user.findUnique({ where: { clerkId } });
    if (!user) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "User not found." } },
        { status: 404 }
      );
    }

    // Verify key belongs to user
    const apiKey = await db.apiKey.findUnique({ where: { id } });
    if (!apiKey || apiKey.userId !== user.id) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "API key not found." } },
        { status: 404 }
      );
    }

    if (apiKey.revokedAt) {
      return NextResponse.json(
        { error: { code: "ALREADY_REVOKED", message: "This key has already been revoked." } },
        { status: 400 }
      );
    }

    // Soft delete
    await db.apiKey.update({
      where: { id },
      data: { revokedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[api/keys/[id]] DELETE error:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Something went wrong." } },
      { status: 500 }
    );
  }
}
