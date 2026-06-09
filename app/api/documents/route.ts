// ===========================================================
// GET /api/documents — Paginated document list
// ===========================================================

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureUser } from "@/lib/user";

export async function GET(req: Request) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Authentication required." } },
        { status: 401 }
      );
    }

    const user = await ensureUser(clerkId);

    const isFree = user.plan === "FREE";

    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
    const rawLimit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") ?? "10", 10)));
    // FREE users: cap at 5 docs total
    const limit = isFree ? Math.min(rawLimit, 5) : rawLimit;
    const skip = isFree ? 0 : (page - 1) * limit;

    let truncatedDocuments: Record<string, unknown>[] = [];
    let total = 0;

    try {
      const [documents, count] = await Promise.all([
        db.document.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
          select: {
            id: true,
            title: true,
            originalText: true,
            overallScore: true,
            humanizedScore: true,
            wordCount: true,
            rewrittenText: true,
            tone: true,
            createdAt: true,
            status: true,
          },
        }),
        db.document.count({ where: { userId: user.id } }),
      ]);

      total = count;
      truncatedDocuments = documents.map((doc) => ({
        ...doc,
        originalText: doc.originalText.slice(0, 200),
      }));
    } catch (dbErr) {
      console.error("[documents] failed to query documents (table may not exist):", dbErr);
      return NextResponse.json({
        documents: [],
        pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
        plan: user.plan,
        totalAll: 0,
      });
    }

    const effectiveTotal = isFree ? Math.min(total, 5) : total;

    return NextResponse.json({
      documents: truncatedDocuments,
      pagination: {
        page: isFree ? 1 : page,
        limit,
        total: effectiveTotal,
        totalPages: isFree ? 1 : Math.ceil(total / limit),
      },
      plan: user.plan,
      totalAll: total,
    });
  } catch (err) {
    console.error("[documents] error:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Something went wrong." } },
      { status: 500 }
    );
  }
}
