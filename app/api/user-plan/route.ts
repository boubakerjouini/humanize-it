import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ plan: "FREE" });

  const user = await db.user.findUnique({ where: { clerkId }, select: { plan: true, email: true, name: true } });
  return NextResponse.json({ plan: user?.plan ?? "FREE", email: user?.email, name: user?.name });
}
