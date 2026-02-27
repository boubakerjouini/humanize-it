// ===========================================================
// GET/DELETE /api/documents/[id] — Single document
// ===========================================================

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, context: RouteContext) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Authentication required." } },
        { status: 401 }
      );
    }

    const user = await db.user.findUnique({ where: { clerkId } });
    if (!user) {
      return NextResponse.json(
        { error: { code: "USER_NOT_FOUND", message: "User not found." } },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    const document = await db.document.findUnique({ where: { id } });

    if (!document || document.userId !== user.id) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Document not found." } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: document.id,
      originalText: document.originalText,
      analysisResult: document.analysisResult,
      overallScore: document.overallScore,
      rewrittenText: document.rewrittenText,
      rewriteModel: document.rewriteModel,
      wordCount: document.wordCount,
      createdAt: document.createdAt,
    });
  } catch (err) {
    console.error("[documents/id GET] error:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Something went wrong." } },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: Request, context: RouteContext) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Authentication required." } },
        { status: 401 }
      );
    }

    const user = await db.user.findUnique({ where: { clerkId } });
    if (!user) {
      return NextResponse.json(
        { error: { code: "USER_NOT_FOUND", message: "User not found." } },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    const document = await db.document.findUnique({ where: { id } });

    if (!document || document.userId !== user.id) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Document not found." } },
        { status: 404 }
      );
    }

    await db.document.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[documents/id DELETE] error:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Something went wrong." } },
      { status: 500 }
    );
  }
}
