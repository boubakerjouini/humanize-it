// ===========================================================
// GET  /api/admin/documents  — list/search documents (admin only)
// ===========================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { resolveIdentities } from "@/lib/clerk-identity";

function adminError(err: unknown) {
  const status = (err as { status?: number })?.status ?? 500;
  const message = status === 500 ? "Something went wrong." : (err as Error).message;
  return NextResponse.json({ error: { message } }, { status });
}

export async function GET(req: Request) {
  try {
    await requireAdmin();
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim();
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
    const limit = 25;

    const where = q
      ? { title: { contains: q, mode: "insensitive" as const } }
      : {};

    const [documents, total] = await Promise.all([
      db.document.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          title: true,
          wordCount: true,
          overallScore: true,
          humanizedScore: true,
          status: true,
          createdAt: true,
          user: { select: { id: true, clerkId: true, email: true, name: true } },
        },
      }),
      db.document.count({ where }),
    ]);

    // The DB email/name may be a placeholder; show the REAL identity from Clerk.
    const identities = await resolveIdentities(documents.map((d) => d.user.clerkId));
    const enriched = documents.map(({ user, ...d }) => {
      const id = identities.get(user.clerkId);
      return {
        ...d,
        user: { id: user.id, email: id?.email ?? user.email, name: id?.name ?? user.name },
      };
    });

    return NextResponse.json({ documents: enriched, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    return adminError(err);
  }
}
