import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { signExtensionToken } from "@/lib/extension-auth";

export async function POST() {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await db.user.findUnique({ where: { clerkId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const iat = Math.floor(Date.now() / 1000);
    const token = signExtensionToken({
      clerkId,
      email: user.email,
      plan: user.plan,
      iat,
      exp: iat + 7 * 24 * 3600,
    });

    return NextResponse.json({ token });
  } catch {
    // Includes the fail-closed case where EXTENSION_TOKEN_SECRET is unset.
    return NextResponse.json(
      { error: "Extension tokens are not available (server misconfigured)." },
      { status: 500 }
    );
  }
}
