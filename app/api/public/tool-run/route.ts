// ===========================================================
// POST /api/public/tool-run — The browser's note that an instant AI check
// ran. The instant detector and the blog widget run entirely in the browser,
// so the server would never see them otherwise. Body: { tool:
// "detector_instant", page, wordCount, score, band? }. Metadata only, never
// the text (lib/growth/tool-runs.ts); anonymous visitors are stored with no
// IP or id, signed-in ones with their user id. Bounded per IP with the same
// short-lived counters as the other free tools. Always 204, even when the
// note is dropped, so there is nothing to probe.
// ===========================================================

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { clientIp } from "@/lib/client-ip";
import { firstTouchOf, readAttribution } from "@/lib/growth/attribution-server";
import { TOOL_RUN_BANDS, cleanToolPage, recordToolRun, toolRunSource } from "@/lib/growth/tool-runs";
import { checkDailyLimit, checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PER_MINUTE = 20;
const PER_DAY = 300;

const bodySchema = z.object({
  tool: z.literal("detector_instant"),
  page: z.string().max(200),
  wordCount: z.number().int().min(1).max(20_000),
  score: z.number().min(0).max(100),
  band: z.enum(TOOL_RUN_BANDS).optional(),
});

const done = () => new NextResponse(null, { status: 204 });

/** The signed-in visitor's user id, without creating a user; null when signed out. */
async function signedInUserId(): Promise<string | null> {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return null;
    return (await db.user.findUnique({ where: { clerkId }, select: { id: true } }))?.id ?? null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return done();
  }
  const parsed = bodySchema.safeParse(body);
  const page = parsed.success ? cleanToolPage(parsed.data.page) : null;
  if (!parsed.success || !page) return done();

  const ip = clientIp(req);
  if (!(await checkRateLimit(`toolrun:min:${ip}`, PER_MINUTE)).ok) return done();
  if (!(await checkDailyLimit(`toolrun:day:${ip}`, PER_DAY)).ok) return done();

  const [userId, attribution] = await Promise.all([signedInUserId(), readAttribution()]);
  await recordToolRun({
    tool: parsed.data.tool,
    page,
    wordCount: parsed.data.wordCount,
    score: parsed.data.score,
    band: parsed.data.band ?? null,
    userId,
    source: toolRunSource(firstTouchOf(attribution)),
  });
  return done();
}
