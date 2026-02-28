// ===========================================================
// GET /api/documents — Paginated document list
// ===========================================================

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Authentication required." } },
        { status: 401 }
      );
    }

    const user = await db.user.upsert({
      where: { clerkId },
      update: {},
      create: {
        clerkId,
        email: `${clerkId}@placeholder.humanize-it.app`,
        plan: "FREE",
        wordsUsed: 0,
      },
    });

    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") ?? "10", 10)));
    const skip = (page - 1) * limit;

    const [documents, total] = await Promise.all([
      db.document.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          originalText: true,
          overallScore: true,
          wordCount: true,
          rewrittenText: true,
          createdAt: true,
        },
      }),
      db.document.count({ where: { userId: user.id } }),
    ]);

    const truncatedDocuments = documents.map((doc) => ({
      ...doc,
      originalText: doc.originalText.slice(0, 200),
    }));

    return NextResponse.json({
      documents: truncatedDocuments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("[documents] error:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Something went wrong." } },
      { status: 500 }
    );
  }
}
