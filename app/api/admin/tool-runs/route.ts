// ===========================================================
// GET /api/admin/tool-runs — Free-tool runs (lib/growth/tool-runs.ts) for the
// admin Documents page: every use of the public detector (instant and deep),
// the blog widget and the free humanizer, with the page it ran on.
// ?days=1|7|30|90 (default 7), ?tool=, ?page=<path>, ?p=<page number>.
// Returns the runs (50 a page, newest first, signed-in ones with their user)
// and, for the whole window, counts per page and per tool.
// ===========================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import type { Prisma } from "@/app/generated/prisma/client";
import { requireAdmin } from "@/lib/admin";
import { TOOL_RUN_TOOLS } from "@/lib/growth/tool-runs";
import { handleError } from "@/app/api/admin/email/_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;
const DAY_MS = 86_400_000;

const querySchema = z.object({
  days: z.coerce.number().pipe(z.union([z.literal(1), z.literal(7), z.literal(30), z.literal(90)])).default(7),
  tool: z.enum(TOOL_RUN_TOOLS).optional(),
  page: z.string().trim().min(1).max(200).optional(),
  p: z.coerce.number().int().min(1).max(10_000).default(1),
});

export async function GET(req: Request) {
  try {
    await requireAdmin();
    const query = querySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
    const since = new Date(Date.now() - query.days * DAY_MS);
    const window: Prisma.ToolRunWhereInput = { createdAt: { gte: since } };
    const where: Prisma.ToolRunWhereInput = {
      ...window,
      ...(query.tool ? { tool: query.tool } : {}),
      ...(query.page ? { page: query.page } : {}),
    };

    const [runs, total, byPageTool, signedInByPage] = await Promise.all([
      db.toolRun.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.p - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          id: true,
          tool: true,
          page: true,
          wordCount: true,
          score: true,
          scoreAfter: true,
          band: true,
          source: true,
          createdAt: true,
          user: { select: { id: true, email: true, name: true } },
        },
      }),
      db.toolRun.count({ where }),
      db.toolRun.groupBy({ by: ["page", "tool"], where: window, _count: { _all: true } }),
      db.toolRun.groupBy({ by: ["page"], where: { ...window, userId: { not: null } }, _count: { _all: true } }),
    ]);

    const pages = new Map<string, { page: string; total: number; detector_instant: number; detector_deep: number; humanizer_free: number; signedIn: number }>();
    for (const row of byPageTool) {
      const entry = pages.get(row.page) ?? { page: row.page, total: 0, detector_instant: 0, detector_deep: 0, humanizer_free: 0, signedIn: 0 };
      entry.total += row._count._all;
      if (row.tool === "detector_instant" || row.tool === "detector_deep" || row.tool === "humanizer_free") entry[row.tool] += row._count._all;
      pages.set(row.page, entry);
    }
    for (const row of signedInByPage) {
      const entry = pages.get(row.page);
      if (entry) entry.signedIn = row._count._all;
    }
    const byTool = Object.fromEntries(TOOL_RUN_TOOLS.map((tool) => [tool, byPageTool.filter((r) => r.tool === tool).reduce((n, r) => n + r._count._all, 0)]));

    return NextResponse.json({
      days: query.days,
      runs,
      total,
      totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      byPage: [...pages.values()].sort((a, b) => b.total - a.total),
      byTool,
    });
  } catch (err) {
    return handleError("admin-tool-runs", err);
  }
}
