// ===========================================================
// GET /api/offers — What the signed-in user can buy once, and whether they
// are a Founding member (for the badge).
// → { founding: { configured, open, left, member }, wordPack: { available, … } }
// ===========================================================

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { foundingStatus, wordPackStatus } from "./shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } }, { status: 401 });
    }

    const [founding, member] = await Promise.all([
      foundingStatus(),
      db.purchase
        .count({ where: { kind: "founding", user: { clerkId } } })
        .then((n) => n > 0)
        .catch(() => false),
    ]);

    return NextResponse.json({
      founding: { configured: founding.configured, open: founding.open, left: founding.left, member },
      wordPack: wordPackStatus(),
    });
  } catch (err) {
    console.error("[offers] GET failed:", err);
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Something went wrong." } }, { status: 500 });
  }
}
