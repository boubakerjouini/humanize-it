// ===========================================================
// /api/voice-profiles/:id — Rename (PATCH { name }) or delete one of the
// signed-in user's voice profiles. Allowed on any plan, so a user who
// downgraded can still tidy up profiles that are now locked.
// ===========================================================

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ensureUser } from "@/lib/user";
import { MAX_NAME_CHARS } from "../shared";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

const renameSchema = z.object({ name: z.string().trim().min(1, "Give the voice a name.").max(MAX_NAME_CHARS) });

function error(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

async function ownerId(): Promise<string | null> {
  const { userId: clerkId } = await auth();
  if (!clerkId) return null;
  return (await ensureUser(clerkId)).id;
}

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const userId = await ownerId();
    if (!userId) return error("UNAUTHORIZED", "Authentication required.", 401);
    const { id } = await context.params;

    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return error("INVALID_JSON", "Invalid JSON body.", 400);
    }
    const parsed = renameSchema.safeParse(raw);
    if (!parsed.success) return error("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input.", 400);

    // Scoped by userId: someone else's id simply matches nothing.
    const res = await db.voiceProfile.updateMany({ where: { id, userId }, data: { name: parsed.data.name } });
    if (res.count === 0) return error("NOT_FOUND", "Voice profile not found.", 404);
    return NextResponse.json({ ok: true, name: parsed.data.name });
  } catch (err) {
    console.error("[voice-profiles] PATCH failed:", err);
    return error("INTERNAL_ERROR", "Something went wrong.", 500);
  }
}

export async function DELETE(_req: Request, context: RouteContext) {
  try {
    const userId = await ownerId();
    if (!userId) return error("UNAUTHORIZED", "Authentication required.", 401);
    const { id } = await context.params;

    const res = await db.voiceProfile.deleteMany({ where: { id, userId } });
    if (res.count === 0) return error("NOT_FOUND", "Voice profile not found.", 404);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[voice-profiles] DELETE failed:", err);
    return error("INTERNAL_ERROR", "Something went wrong.", 500);
  }
}
