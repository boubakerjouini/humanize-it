// ===========================================================
// POST /api/public/leads/confirm — The double opt-in click.
//
// Called only from an explicit button press ("Yes, send me tips", "Confirm my
// spot") on the pages linked from our emails, never on page load: link
// scanners such as Microsoft Safe Links open those pages and run their
// scripts, and must not be able to consent for anyone. The signed confirm
// token proves the inbox; the click proves the intent. Idempotent: a repeat
// call confirms nothing new and reports the topics already confirmed.
// ===========================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp } from "@/lib/client-ip";
import { confirmPendingTopics } from "@/lib/crm/consent";
import { recordEvent } from "@/lib/crm/events";
import { recomputeContact } from "@/lib/crm/recompute";
import { db } from "@/lib/db";
import { verifyToken } from "@/lib/email/tokens";
import { isTopic, type Topic } from "@/lib/growth/constants";
import { bumpDailyMetric } from "@/lib/growth/daily-metrics";
import { magnetPdfPath } from "@/lib/growth/magnets";
import { logGrowthError, runAfter } from "@/lib/growth/safe";
import { onLeadConfirmed, onWaitlistConfirmed } from "@/lib/growth/triggers";
import { checkRateLimit, rateLimitHeaders } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ t: z.string().min(1).max(2048) }).strict();

function errorJson(code: string, message: string, status: number, headers?: Record<string, string>) {
  return NextResponse.json({ error: { code, message } }, { status, headers });
}

export async function POST(req: Request) {
  const ip = clientIp(req);
  const limit = await checkRateLimit(`lead:confirm:ip:${ip}`, 10);
  if (!limit.ok) {
    return errorJson("RATE_LIMITED", "Too many requests. Please wait a minute and try again.", 429, {
      ...rateLimitHeaders(limit),
      "Retry-After": String(limit.retryAfterSeconds),
    });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return errorJson("INVALID_JSON", "Invalid request body.", 400);
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return errorJson("INVALID_INPUT", "Missing confirmation token.", 400);

  const token = verifyToken(parsed.data.t, "confirm");
  if (!token) return errorJson("INVALID_TOKEN", "This confirmation link is invalid or has expired.", 400);
  const contactId = token.c;
  const magnet = token.m;

  try {
    const contact = await db.contact.findUnique({ where: { id: contactId }, select: { id: true } });
    if (!contact) return errorJson("INVALID_TOKEN", "This confirmation link is invalid or has expired.", 400);

    const { confirmed } = await confirmPendingTopics(contactId, {
      source: magnet ? `confirm:${magnet}` : "confirm",
      ip,
      userAgent: req.headers.get("user-agent"),
    });
    const current = await db.contact.findUnique({ where: { id: contactId }, select: { subscribedTopics: true } });
    const topicsConfirmed: Topic[] = (current?.subscribedTopics ?? []).filter(isTopic);

    runAfter("leads:confirm", async () => {
      if (confirmed.length > 0) {
        await recordEvent({ contactId, type: "email_confirmed", props: { topics: confirmed, magnet: magnet ?? null } });
        await bumpDailyMetric("lead.confirmed");
      }
      if (magnet) {
        await recordEvent({
          contactId,
          type: "magnet_downloaded",
          props: { magnet },
          dedupeKey: `magnet_downloaded:${contactId}:${magnet}`,
        });
      }
      if (confirmed.includes("tips")) await onLeadConfirmed(contactId, magnet);
      if (confirmed.includes("extension_launch")) await onWaitlistConfirmed(contactId);
      await recomputeContact(contactId);
    });

    return NextResponse.json({
      ok: true,
      topicsConfirmed,
      ...(magnet ? { downloadUrl: magnetPdfPath(magnet) } : {}),
    });
  } catch (err) {
    logGrowthError("leads:confirm", err);
    return errorJson("DB_ERROR", "We couldn't confirm that right now. Please try again in a minute.", 503);
  }
}
