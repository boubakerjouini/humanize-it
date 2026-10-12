// ===========================================================
// POST /api/public/leads — Public lead capture: lead magnets (magnet page,
// exit intent, blog box), the emailed detector report, the Chrome extension
// waitlist and the Founding 100 list.
//
// Order matters: size limit → schema → bot check (fake success, no writes) →
// per-IP limits → address quality → per-recipient caps → contact upsert →
// pending consent → send budget → recipient check → global send cap →
// delivery (or hold). Topics stay *pending* until the person clicks
// an explicit confirm button on a page linked from the email; nothing here or
// on page load confirms them. The response never reveals whether the address
// was already known, and magnets are downloadable immediately either way.
//
// Anyone can type any address here, so these sends are stricter than other
// transactional mail: an address that bounced, complained or opted out of
// anything gets nothing (with the same answer), and anonymous captures share
// a global daily cap so they can never eat the budget welcome and account
// emails need. Past that cap, or past the day's send budget, the email is held
// rather than dropped: a queued EmailMessage the daily job sends
// (lib/growth/daily-job.ts), plus one high-priority CRM task that day.
// ===========================================================

import { NextResponse } from "next/server";
import type { Prisma } from "@/app/generated/prisma/client";
import { canonicalHash, emailDomain, emailHash } from "@/lib/email/address";
import { remainingBudget } from "@/lib/email/budget";
import { TEMPLATES, type TemplateKey } from "@/lib/email/catalog";
import { genericConfirmUrl, magnetConfirmUrl, magnetDownloadUrl, waitlistConfirmUrl } from "@/lib/email/links";
import { canSendInline, checkSendable, sendEmail, type PrepareInput } from "@/lib/email/send";
import { clientIp, ipBucket } from "@/lib/client-ip";
import { grantTopics } from "@/lib/crm/consent";
import { upsertLeadContact } from "@/lib/crm/contacts";
import { recordEvent } from "@/lib/crm/events";
import { recomputeContact } from "@/lib/crm/recompute";
import { db } from "@/lib/db";
import { parsePageTouch, touchEventProps } from "@/lib/growth/attribution";
import { firstTouchOf, readAttribution, withPageTouch, type AttributionSnapshot } from "@/lib/growth/attribution-server";
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
import { isUniqueViolation, logGrowthError, runAfter } from "@/lib/growth/safe";
import { trackServer } from "@/lib/posthog";
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

type Delivery = "email" | "queued" | "link" | "unavailable" | "pending";
type LeadResponse = { ok: true; delivery: Delivery; downloadUrl?: string };

/** What the visitor is told about the email: sent now, held for the daily run, or none. */
type EmailAnswer = "email" | "queued" | "none";

/** Why a lead email waits for the daily run: the global lead cap, or the day's send budget. */
type HoldReason = "lead_cap" | "budget";

/** The email each kind of capture sends. */
const LEAD_TEMPLATES: Record<LeadKind, TemplateKey> = {
  magnet: "magnet_delivery",
  report: "detector_report",
  waitlist: "waitlist_confirm",
  founding: "founding_confirm",
};

function errorJson(code: string, message: string, status: number, headers?: Record<string, string>) {
  return NextResponse.json({ error: { code, message } }, { status, headers });
}

/** What the page shows when no email goes out. Magnets always come with the PDF link. */
function fallbackDelivery(kind: LeadKind): Delivery {
  if (kind === "magnet") return "link";
  if (kind === "report") return "unavailable";
  return "pending";
}

function respond(kind: LeadKind, input: Pick<LeadRequest, "magnet">, email: EmailAnswer): NextResponse<LeadResponse> {
  const body: LeadResponse = { ok: true, delivery: email === "none" ? fallbackDelivery(kind) : email };
  if (kind === "magnet" && input.magnet) body.downloadUrl = magnetPdfPath(input.magnet);
  return NextResponse.json(body);
}

function utcMinuteKey(now: Date): string {
  return now.toISOString().slice(0, 16);
}

/**
 * Split the optional `touch` (the page's in-memory attribution, see
 * parsePageTouch) off the body, so the strict lead schema never sees it.
 */
function splitPageTouch(json: unknown): { lead: unknown; touch: unknown } {
  if (!json || typeof json !== "object" || Array.isArray(json)) return { lead: json, touch: undefined };
  const { touch, ...lead } = json as Record<string, unknown>;
  return { lead, touch };
}

/**
 * The email a capture sends, built the same way whether it goes out now or is
 * held, so a held row and a later inline send share one dedupe key. Null when
 * there is nothing to ask (the topic is already confirmed).
 */
function leadEmail(kind: LeadKind, input: LeadRequest, contactId: string, pending: Topic[], now: Date): PrepareInput | null {
  const day = utcDay(now).toISOString().slice(0, 10);
  switch (kind) {
    case "magnet": {
      const magnet = input.magnet!;
      return {
        contactId,
        template: "magnet_delivery",
        props: {
          magnet,
          confirmUrl: magnetConfirmUrl(contactId, magnet),
          downloadUrl: magnetDownloadUrl(magnet),
          consentPending: pending.includes("tips"),
        },
        dedupeKey: `magnet:${contactId}:${magnet}:${day}`,
        pool: "inline",
      } satisfies PrepareInput<"magnet_delivery">;
    }
    case "report": {
      const ctx = input.context!;
      return {
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
      } satisfies PrepareInput<"detector_report">;
    }
    case "waitlist":
      // Already confirmed: nothing to ask, and the answer must not reveal it.
      if (!pending.includes("extension_launch")) return null;
      return {
        contactId,
        template: "waitlist_confirm",
        props: { confirmUrl: waitlistConfirmUrl(contactId) },
        dedupeKey: `waitlist:${contactId}`,
        pool: "inline",
      } satisfies PrepareInput<"waitlist_confirm">;
    case "founding":
      if (pending.length === 0) return null;
      return {
        contactId,
        template: "founding_confirm",
        props: { confirmUrl: genericConfirmUrl(contactId) },
        dedupeKey: `doi:${contactId}:founding:${day}`,
        pool: "inline",
      } satisfies PrepareInput<"founding_confirm">;
  }
}

/**
 * canSendInline said no: is a spent budget the reason? Sending switched off, the
 * flow switched off or the allowlist mean no email at all, so nothing is held.
 * Contact-level skips don't count here; the recipient check answers those.
 */
async function onlyBudgetBlocks(contactId: string, template: TemplateKey): Promise<boolean> {
  try {
    const gate = await checkSendable({ contactId, template });
    if (!gate.ok && gate.outcome.status === "deferred") return false;
    return (await remainingBudget("inline")) <= 0;
  } catch (err) {
    logGrowthError("leads:budget-check", err);
    return false;
  }
}

/**
 * Hold a lead email for the daily job: a queued EmailMessage under the dedupe
 * key it would have been sent with, props stored like any retry. A later
 * inline send of the same email takes the row over instead of sending twice.
 * True when the email is (or already was) recorded.
 */
async function holdLeadEmail(mail: PrepareInput, email: string, reason: HoldReason): Promise<boolean> {
  const meta = TEMPLATES[mail.template];
  try {
    await db.emailMessage.create({
      data: {
        contactId: mail.contactId,
        toEmailHash: emailHash(email),
        toDomain: emailDomain(email),
        template: mail.template,
        stream: meta.stream,
        topic: meta.topic,
        props: JSON.parse(JSON.stringify(mail.props)) as Prisma.InputJsonValue,
        dedupeKey: mail.dedupeKey,
        status: "queued",
        error: `held_${reason}`,
      },
    });
    return true;
  } catch (err) {
    if (isUniqueViolation(err)) return true;
    logGrowthError("leads:hold", err);
    return false;
  }
}

/** One high-priority task a day while lead email is held (the inbound_capped pattern). */
async function openHeldTask(now: Date): Promise<void> {
  const day = utcDay(now).toISOString().slice(0, 10);
  try {
    await db.crmTask.create({
      data: {
        contactId: null,
        title: `Lead emails held on ${day}: daily email limit reached`,
        body:
          `Lead emails (magnet copies, detector reports, waitlist and Founding confirmations) passed today's limit: ` +
          `${leadSendsPerDay()} lead emails a day, or the EMAIL_DAILY_CAP send budget. They are queued, not lost: ` +
          `the daily run at 08:00 UTC sends them, and visitors already have their downloads. The queued rows are in ` +
          `/admin/email-log. If this keeps happening, raising EMAIL_DAILY_CAP needs a bigger Resend plan than the free 100 a day.`,
        kind: "email",
        priority: "high",
        source: "rule",
        ruleKey: "lead_email_held",
        dedupeKey: `lead_email_held:${day}`,
        dueAt: now,
        createdBy: "system",
      },
    });
  } catch (err) {
    if (!isUniqueViolation(err)) logGrowthError("leads:held-task", err);
  }
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

  // 2. Schema. The page's touch travels beside the lead fields and is parsed
  //    on its own (step 7).
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return errorJson("INVALID_JSON", "Invalid request body.", 400);
  }
  const { lead: leadJson, touch: rawTouch } = splitPageTouch(json);
  const parsed = leadRequestSchema.safeParse(leadJson);
  if (!parsed.success) return errorJson("INVALID_INPUT", firstIssueMessage(parsed.error), 400);
  const input = parsed.data;
  const kind = leadKind(input.source);

  // 3. Bots get the same success shape a person gets, and nothing is written.
  if (isLikelyBot(input)) return respond(kind, input, "email");

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

  // 7. Contact. Attribution comes from the hz_ft / hz_lt cookies, or, for a
  //    visitor who gets none (GPC, consent-region time zone), from the touch
  //    the page kept in memory and sent with the form.
  const now = new Date();
  let contactId: string;
  let attribution: AttributionSnapshot | null = null;
  try {
    attribution = withPageTouch(await readAttribution(), parsePageTouch(rawTouch, now.getTime()));
    const lead = await upsertLeadContact({ email, source: input.source, magnet: input.magnet, attribution });
    if (!lead) return errorJson("INVALID_EMAIL", "Please enter a valid email address.", 400);
    contactId = lead.contactId;
  } catch (err) {
    logGrowthError("leads:upsert", err);
    // A magnet is still a public PDF: don't make the visitor pay for our outage.
    if (kind === "magnet") return respond(kind, input, "none");
    return errorJson("DB_ERROR", "We couldn't save that right now. Please try again in a minute.", 503);
  }

  // 8. Pending consent, one record per topic with the wording shown next to it.
  const userAgent = req.headers.get("user-agent");
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

  const touch = firstTouchOf(attribution);
  runAfter("leads:events", async () => {
    const day = utcDay(now).toISOString().slice(0, 10);
    const captured = await recordEvent({
      contactId,
      type: "lead_captured",
      props: { source: input.source, magnet: input.magnet ?? null, topics: input.topics },
      dedupeKey: `lead_captured:${contactId}:${input.magnet ?? input.source}:${day}`,
    });
    if (captured) {
      await bumpDailyMetric(`lead.captured.${input.source}`);
      // Counted like the daily metric. PostHog gets the contact id, never the address or a name.
      trackServer(contactId, "lead_captured", {
        source: input.source,
        magnet: input.magnet ?? null,
        topics: input.topics,
        ...touchEventProps(touch),
        $process_person_profile: false,
      });
    }
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

  // 9. Per-recipient caps: past them nothing is sent, with the usual answer.
  if (!mayEmail) return respond(kind, input, canSend ? "email" : "none");

  // 10. Send budget. Spent, the email is held for the daily run; any other
  //     reason not to send (switches, allowlist) means no email at all.
  let held: HoldReason | null = null;
  if (!canSend) {
    if (!(await onlyBudgetBlocks(contactId, LEAD_TEMPLATES[kind]))) return respond(kind, input, "none");
    held = "budget";
  }

  // 11. Recipient check. A blocked address gets the answer a deliverable one
  //     gets at this point (sent, or held while the budget is spent).
  try {
    if (!(await recipientAcceptsLeadMail(contactId, email))) return respond(kind, input, held ? "queued" : "email");
  } catch (err) {
    logGrowthError("leads:recipient", err);
    return respond(kind, input, "none");
  }

  // 12. Global cap on anonymous lead email. Past it the email is held too; the
  //     visitor keeps the instant download either way.
  if (!held && !(await checkDailyLimit("lead:send:global", leadSendsPerDay())).ok) held = "lead_cap";

  // 13. Delivery, or a queued row the daily job sends.
  const mail = leadEmail(kind, input, contactId, pending, now);
  if (!mail) return respond(kind, input, held ? "queued" : "email");
  if (held) {
    if (!(await holdLeadEmail(mail, email, held))) return respond(kind, input, "none");
    runAfter("leads:held-task", () => openHeldTask(now));
    return respond(kind, input, "queued");
  }
  runAfter(`leads:send-${kind}`, () => sendEmail(mail));
  return respond(kind, input, "email");
}
