// ===========================================================
// POST /api/public/leads — Public lead capture: lead magnets (magnet page,
// exit intent, blog box), the emailed detector report, the Chrome extension
// waitlist and the Founding 100 list.
//
// Order matters: size limit → schema → bot check (fake success, no writes) →
// per-IP limits → address quality → per-recipient caps → contact upsert →
// pending consent → recipient check → global send cap → delivery. Topics stay *pending* until the person clicks
// an explicit confirm button on a page linked from the email; nothing here or
// on page load confirms them. The response never reveals whether the address
// was already known, and magnets are downloadable immediately either way.
//
// Anyone can type any address here, so these sends are stricter than other
// transactional mail: an address that bounced, complained or opted out of
// anything gets nothing (with the same answer), and anonymous captures share
// a global daily cap so they can never eat the budget welcome and account
// emails need.
// ===========================================================

import { NextResponse } from "next/server";
import { canonicalHash, emailHash } from "@/lib/email/address";
import { genericConfirmUrl, magnetConfirmUrl, magnetDownloadUrl, waitlistConfirmUrl } from "@/lib/email/links";
import { canSendInline, sendEmail } from "@/lib/email/send";
import { clientIp, ipBucket } from "@/lib/client-ip";
import { grantTopics } from "@/lib/crm/consent";
import { upsertLeadContact } from "@/lib/crm/contacts";
import { recordEvent } from "@/lib/crm/events";
import { recomputeContact } from "@/lib/crm/recompute";
import { db } from "@/lib/db";
import { readAttribution } from "@/lib/growth/attribution-server";
import { bumpDailyMetric, utcDay } from "@/lib/growth/daily-metrics";
import {
  LEAD_MAX_BODY_BYTES,
  checkEmailQuality,
  checkMailDomain,
  deliveryFlow,
  firstIssueMessage,
  isLikelyBot,
  leadKind,
  leadRequestSchema,
  recipientLimitKey,
  type LeadKind,
  type LeadRequest,
} from "@/lib/growth/lead-validation";
import { magnetPdfPath } from "@/lib/growth/magnets";
import { patternLabel } from "@/lib/growth/pattern-fixes";
import { emailDailyCap } from "@/lib/growth/flags";
import { logGrowthError, runAfter } from "@/lib/growth/safe";
import { checkDailyLimit, checkRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { consentWordingFor, type Topic } from "@/lib/growth/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IP_PER_MINUTE = 3;
const IP_PER_DAY = 10;
/** Emails one inbox can trigger per day across every form (anti subscription-bombing). */
const INBOX_PER_DAY = 3;

/**
 * Lead emails per UTC day across all visitors: a third of EMAIL_DAILY_CAP, at
 * most 30, so the rest of the day's budget stays for signups and account mail.
 */
function leadSendsPerDay(): number {
  return Math.max(1, Math.min(30, Math.floor(emailDailyCap() / 3)));
}

/**
 * May an address someone typed on a public form get mail from us? Not if it
 * ever bounced, complained or opted out of anything: the requester is not
 * verified, so we never use the form to reach someone who told us to stop.
 */
async function recipientAcceptsLeadMail(contactId: string, email: string): Promise<boolean> {
  const [contact, suppressed] = await Promise.all([
    db.contact.findUnique({ where: { id: contactId }, select: { emailStatus: true } }),
    db.emailSuppression.count({ where: { emailHash: emailHash(email) } }),
  ]);
  return !!contact && contact.emailStatus === "ok" && suppressed === 0;
}

type Delivery = "email" | "link" | "unavailable" | "pending";
type LeadResponse = { ok: true; delivery: Delivery; downloadUrl?: string };

function errorJson(code: string, message: string, status: number, headers?: Record<string, string>) {
  return NextResponse.json({ error: { code, message } }, { status, headers });
}

/** What the page shows when no email goes out. Magnets always come with the PDF link. */
function fallbackDelivery(kind: LeadKind): Delivery {
  if (kind === "magnet") return "link";
  if (kind === "report") return "unavailable";
  return "pending";
}

function respond(kind: LeadKind, input: Pick<LeadRequest, "magnet">, emailWillSend: boolean): NextResponse<LeadResponse> {
  const body: LeadResponse = { ok: true, delivery: emailWillSend ? "email" : fallbackDelivery(kind) };
  if (kind === "magnet" && input.magnet) body.downloadUrl = magnetPdfPath(input.magnet);
  return NextResponse.json(body);
}

function utcMinuteKey(now: Date): string {
  return now.toISOString().slice(0, 16);
}

export async function POST(req: Request) {
  // 1. Size limit (read as text so an oversized body never reaches JSON.parse).
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > LEAD_MAX_BODY_BYTES) return errorJson("PAYLOAD_TOO_LARGE", "Request too large.", 413);
  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return errorJson("INVALID_JSON", "Invalid request body.", 400);
  }
  if (Buffer.byteLength(raw, "utf8") > LEAD_MAX_BODY_BYTES) return errorJson("PAYLOAD_TOO_LARGE", "Request too large.", 413);

  // 2. Schema.
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return errorJson("INVALID_JSON", "Invalid request body.", 400);
  }
  const parsed = leadRequestSchema.safeParse(json);
  if (!parsed.success) return errorJson("INVALID_INPUT", firstIssueMessage(parsed.error), 400);
  const input = parsed.data;
  const kind = leadKind(input.source);

  // 3. Bots get the same success shape a person gets, and nothing is written.
  if (isLikelyBot(input)) return respond(kind, input, true);

  // 4. Per-IP limits.
  const ip = clientIp(req);
  const ipKey = ipBucket(ip);
  const burst = await checkRateLimit(`lead:min:ip:${ipKey}`, IP_PER_MINUTE);
  if (!burst.ok) {
    return errorJson("RATE_LIMITED", "Too many requests. Please wait a minute and try again.", 429, {
      ...rateLimitHeaders(burst),
      "Retry-After": String(burst.retryAfterSeconds),
    });
  }
  const daily = await checkDailyLimit(`lead:day:ip:${ipKey}`, IP_PER_DAY);
  if (!daily.ok) {
    return errorJson("RATE_LIMITED", "Too many requests today. Please try again tomorrow.", 429, {
      ...rateLimitHeaders(daily),
      "Retry-After": String(daily.retryAfterSeconds),
    });
  }

  // 5. Address quality.
  const quality = checkEmailQuality(input.email);
  if (!quality.ok) return errorJson(quality.code, quality.message, 400);
  if ((await checkMailDomain(quality.domain)) === "invalid") {
    return errorJson("EMAIL_DOMAIN_INVALID", "That email domain can't receive mail. Please check for a typo.", 400);
  }
  const email = quality.email;

  // 6. Per-recipient caps: one email per inbox per thing per day, and a few per
  // inbox per day overall. Over the cap we still answer success, just send nothing.
  const inboxKey = canonicalHash(email);
  const perThing = await checkDailyLimit(recipientLimitKey(inboxKey, input.source, input.magnet), 1);
  const perInbox = perThing.ok ? await checkDailyLimit(`lead:to:${inboxKey}:all`, INBOX_PER_DAY) : perThing;
  const mayEmail = perThing.ok && perInbox.ok;

  const flow = deliveryFlow(kind);
  // Decided from mode, allowlist, flow toggle and budget only, so the answer
  // is the same for a new and a known address.
  const canSend = await canSendInline(flow, email);

  // 7. Contact.
  let contactId: string;
  try {
    const attribution = await readAttribution();
    const lead = await upsertLeadContact({ email, source: input.source, magnet: input.magnet, attribution });
    if (!lead) return errorJson("INVALID_EMAIL", "Please enter a valid email address.", 400);
    contactId = lead.contactId;
  } catch (err) {
    logGrowthError("leads:upsert", err);
    // A magnet is still a public PDF: don't make the visitor pay for our outage.
    if (kind === "magnet") return respond(kind, input, false);
    return errorJson("DB_ERROR", "We couldn't save that right now. Please try again in a minute.", 503);
  }

  // 8. Pending consent, one record per topic with the wording shown next to it.
  const userAgent = req.headers.get("user-agent");
  const now = new Date();
  let pending: Topic[] = [];
  try {
    for (const topic of input.topics) {
      await grantTopics(contactId, [topic], {
        pending: true,
        method: "checkbox",
        wording: consentWordingFor(topic, input.source),
        source: input.path ?? input.source,
        ip,
        userAgent,
      });
    }
    const row = await db.contact.findUnique({ where: { id: contactId }, select: { pendingTopics: true } });
    pending = (row?.pendingTopics ?? []).filter((t): t is Topic => input.topics.includes(t as Topic));
  } catch (err) {
    logGrowthError("leads:consent", err);
  }

  runAfter("leads:events", async () => {
    const day = utcDay(now).toISOString().slice(0, 10);
    const captured = await recordEvent({
      contactId,
      type: "lead_captured",
      props: { source: input.source, magnet: input.magnet ?? null, topics: input.topics },
      dedupeKey: `lead_captured:${contactId}:${input.magnet ?? input.source}:${day}`,
    });
    if (captured) await bumpDailyMetric(`lead.captured.${input.source}`);
    if (kind === "waitlist" || kind === "founding") {
      await recordEvent({
        contactId,
        type: "waitlist_joined",
        props: { list: kind === "waitlist" ? "extension" : "founding" },
        dedupeKey: `waitlist_joined:${contactId}:${kind}`,
      });
    }
    await recomputeContact(contactId);
  });

  // 9. Recipient check. A blocked address gets the same answer as a sent
  //    email, so the response says nothing about it.
  if (!canSend || !mayEmail) return respond(kind, input, canSend);
  try {
    if (!(await recipientAcceptsLeadMail(contactId, email))) return respond(kind, input, true);
  } catch (err) {
    logGrowthError("leads:recipient", err);
    return respond(kind, input, false);
  }

  // 10. Global cap on anonymous lead email. Past it the visitor gets the
  //     no-email fallback (the PDF link for magnets); it is the same for everyone.
  const global = await checkDailyLimit("lead:send:global", leadSendsPerDay());
  if (!global.ok) return respond(kind, input, false);

  // 11. Delivery.
  switch (kind) {
    case "magnet": {
      const magnet = input.magnet!;
      runAfter("leads:send-magnet", () =>
        sendEmail({
          contactId,
          template: "magnet_delivery",
          props: {
            magnet,
            confirmUrl: magnetConfirmUrl(contactId, magnet),
            downloadUrl: magnetDownloadUrl(magnet),
            consentPending: pending.includes("tips"),
          },
          dedupeKey: `magnet:${contactId}:${magnet}:${utcDay(now).toISOString().slice(0, 10)}`,
          pool: "inline",
        })
      );
      break;
    }
    case "report": {
      const ctx = input.context!;
      runAfter("leads:send-report", () =>
        sendEmail({
          contactId,
          template: "detector_report",
          props: {
            instantScore: Math.round(ctx.instantScore),
            deepScore: ctx.deepScore === undefined ? undefined : Math.round(ctx.deepScore),
            confidence: ctx.confidence,
            // Labels from our own catalog; an id we don't know is dropped.
            patterns: ctx.patterns.flatMap((x) => {
              const label = patternLabel(x.id);
              return label ? [{ id: x.id, label, hits: x.hits }] : [];
            }),
            wordCount: ctx.wordCount,
            confirmUrl: pending.includes("tips") ? genericConfirmUrl(contactId) : undefined,
          },
          dedupeKey: `report:${contactId}:${utcMinuteKey(now)}`,
          pool: "inline",
        })
      );
      break;
    }
    case "waitlist": {
      // Already confirmed: nothing to ask, and the answer must not reveal it.
      if (pending.includes("extension_launch")) {
        runAfter("leads:send-waitlist", () =>
          sendEmail({
            contactId,
            template: "waitlist_confirm",
            props: { confirmUrl: waitlistConfirmUrl(contactId) },
            dedupeKey: `waitlist:${contactId}`,
            pool: "inline",
          })
        );
      }
      break;
    }
    case "founding": {
      if (pending.length > 0) {
        runAfter("leads:send-founding", () =>
          sendEmail({
            contactId,
            template: "founding_confirm",
            props: { confirmUrl: genericConfirmUrl(contactId) },
            dedupeKey: `doi:${contactId}:founding:${utcDay(now).toISOString().slice(0, 10)}`,
            pool: "inline",
          })
        );
      }
      break;
    }
  }
  return respond(kind, input, true);
}
