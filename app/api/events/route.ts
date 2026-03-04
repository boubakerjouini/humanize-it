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

    const user = await db.user.findUnique({ where: { clerkId } });
    if (!user) {
      return NextResponse.json({ events: [], stats: null });
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 100);
    const offset = parseInt(searchParams.get("offset") || "0", 10);
    const type = searchParams.get("type");

    const where = {
      userId: user.id,
      ...(type ? { type } : {}),
    };

    const [events, total] = await Promise.all([
      db.userEvent.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      db.userEvent.count({ where }),
    ]);

    // Compute stats
    const [analyzedCount, humanizedCount, avgScoreResult] = await Promise.all([
      db.userEvent.count({ where: { userId: user.id, type: "document.analyzed" } }),
      db.userEvent.count({ where: { userId: user.id, type: "document.humanized" } }),
      db.document.aggregate({
        where: { userId: user.id },
        _avg: { overallScore: true },
      }),
    ]);

    return NextResponse.json({
      events,
      total,
      stats: {
        totalAnalyzed: analyzedCount,
        totalHumanized: humanizedCount,
        avgScore: avgScoreResult._avg.overallScore ?? 0,
      },
    });
  } catch (err) {
    console.error("[events] error:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Something went wrong." } },
      { status: 500 }
    );
  }
}
