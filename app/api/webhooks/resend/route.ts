// ===========================================================
// POST /api/webhooks/resend — Resend delivery events (spec §5.6)
//
// Order matters: the svix signature is checked on the raw body before any
// database work (400 when a header is missing or the signature is wrong), then
// the WebhookEvent ledger ("resend:" + svix-id) makes retries no-ops. If
// processing fails the ledger row is removed and we answer 500, so Resend's
// retry gets a clean second attempt.
//
//   email.delivered            message delivered
//   email.bounced (permanent)  message bounced, contact bounced, "all" suppression, exit sequences
//   email.bounced (other)      noted on the message only
//   email.complained           message complained, contact complained, "nonessential"
//                              suppression, every topic withdrawn, exit sequences
//   email.failed               message failed (not retried: Resend gave up)
//   email.suppressed           message suppressed, "all" suppression (provider)
//   email.received             mail sent to @humanizeit.app: reply task + forward
//                              to the founder (lib/email/inbound.ts)
//   anything else              acknowledged and ignored
//
// Delivery events of those forwards (tag stream=inbound_forward) never touch
// message, contact or suppression state: their recipient is the founder, so a
// complaint or bounce on one must never suppress the founder's address or
// touch a customer's message. A bounced, failed or suppressed forward is still
// written on the email's task (tag inbound=<received id>) with a high-priority
// alert, so the task never claims "Forwarded" for mail that didn't arrive.
// ===========================================================

import { NextResponse } from "next/server";
import { Resend } from "resend";
import { db } from "@/lib/db";
import type { Prisma } from "@/app/generated/prisma/client";
import { emailHash, normalizeEmail } from "@/lib/email/address";
import { getResend } from "@/lib/email/resend-client";
import {
  classifyEvent,
  contactEffect,
  eventTag,
  eventTime,
  messageRef,
  nextContactStatus,
  nextMessageStatus,
  type ResendEventLike,
  type WebhookAction,
} from "@/lib/email/webhook-handler";
import { withdrawTopics } from "@/lib/crm/consent";
import { recomputeContact } from "@/lib/crm/recompute";
import { onEmailBounced } from "@/lib/growth/triggers";
import { forwardInbound, noteForwardNotDelivered, type ForwardFailure } from "@/lib/email/inbound";
import { FORWARD_STREAM_TAG, INBOUND_ID_TAG } from "@/lib/email/inbound-rules";
import { isUniqueViolation, logGrowthError, runAfter } from "@/lib/growth/safe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// An inbound forward reads the message, downloads the original and sends it.
export const maxDuration = 60;

const MAX_BODY_BYTES = 256 * 1024;
const MAX_ATTEMPTS = 3;
const RESEND_ID = /^[A-Za-z0-9_-]{1,100}$/;

/** Delivery events of a support forward that mean it never reached the founder. */
const FORWARD_FAILURES = new Map<string, ForwardFailure>([
  ["email.bounced", "bounced"],
  ["email.failed", "failed"],
  ["email.suppressed", "suppressed"],
]);

function fail(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

/** Message status this action moves to (null = timestamps or notes only). */
function incomingStatus(action: WebhookAction): string | null {
  switch (action.kind) {
    case "delivered":
      return "delivered";
    case "bounced":
      return action.permanent ? "bounced" : null;
    case "complained":
      return "complained";
    case "failed":
      return "failed";
    case "suppressed":
      return "suppressed";
    case "ignore":
      return null;
  }
}

async function applyEvent(evt: ResendEventLike): Promise<{ contactId: string | null }> {
  const action = classifyEvent(evt);
  if (action.kind === "ignore") return { contactId: null };
  const ref = messageRef(evt);
  const at = eventTime(evt);

  const select = { id: true, status: true, contactId: true, toEmailHash: true, deliveredAt: true, bouncedAt: true, complainedAt: true } as const;
  let message = ref.messageId ? await db.emailMessage.findUnique({ where: { id: ref.messageId }, select }) : null;
  if (!message && ref.resendId) message = await db.emailMessage.findUnique({ where: { resendId: ref.resendId }, select });

  if (message) {
    const status = incomingStatus(action);
    const next = status ? nextMessageStatus(message.status, status) : null;
    const data: Prisma.EmailMessageUpdateInput = {};
    if (next) data.status = next;
    if (action.kind === "delivered" && !message.deliveredAt) data.deliveredAt = at;
    if (action.kind === "bounced" && action.permanent && !message.bouncedAt) data.bouncedAt = at;
    if (action.kind === "complained" && !message.complainedAt) data.complainedAt = at;
    if (action.kind === "bounced" && !action.permanent) data.error = `soft_bounce: ${action.detail}`;
    if ((action.kind === "failed" || action.kind === "suppressed") && next) {
      data.error = action.detail;
      data.attempts = MAX_ATTEMPTS;
    }
    if (Object.keys(data).length > 0) await db.emailMessage.update({ where: { id: message.id }, data });
  }

  const effect = contactEffect(action);
  const to = normalizeEmail(ref.to);
  let contactId = message?.contactId ?? null;
  if (!contactId && to && (effect.emailStatus || effect.withdrawTopics || effect.exitSequences)) {
    contactId = (await db.contact.findUnique({ where: { email: to }, select: { id: true } }))?.id ?? null;
  }
  const hash = message?.toEmailHash || (to ? emailHash(to) : null);

  if (effect.suppression && hash) {
    await db.emailSuppression.upsert({
      where: { emailHash_scope: { emailHash: hash, scope: effect.suppression.scope } },
      create: { emailHash: hash, scope: effect.suppression.scope, reason: effect.suppression.reason, source: "resend_webhook" },
      update: {},
    });
  }
  if (contactId && effect.emailStatus) {
    const contact = await db.contact.findUnique({ where: { id: contactId }, select: { emailStatus: true } });
    const nextStatus = contact ? nextContactStatus(contact.emailStatus, effect.emailStatus) : null;
    if (nextStatus) await db.contact.update({ where: { id: contactId }, data: { emailStatus: nextStatus } });
  }
  if (contactId && effect.withdrawTopics) {
    await withdrawTopics(contactId, "all", { method: "webhook", source: "resend:complaint" });
  }
  if (contactId && effect.exitSequences) await onEmailBounced(contactId);
  return { contactId };
}

export async function POST(req: Request) {
  const id = req.headers.get("svix-id");
  const timestamp = req.headers.get("svix-timestamp");
  const signature = req.headers.get("svix-signature");
  if (!id || !timestamp || !signature) return fail("INVALID_SIGNATURE", "Missing signature headers.", 400);
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim();
  if (!secret) {
    logGrowthError("resend-webhook", new Error("RESEND_WEBHOOK_SECRET is not set"));
    return fail("NOT_CONFIGURED", "Webhook secret is not configured.", 500);
  }

  const payload = await req.text();
  if (payload.length > MAX_BODY_BYTES) return fail("INVALID_INPUT", "Payload too large.", 413);

  let evt: ResendEventLike;
  try {
    // Verification is local (svix HMAC); the API key is never used here.
    const client = getResend() ?? new Resend("re_webhook_verify_only");
    evt = client.webhooks.verify({ payload, headers: { id, timestamp, signature }, webhookSecret: secret }) as unknown as ResendEventLike;
  } catch {
    return fail("INVALID_SIGNATURE", "Invalid signature.", 400);
  }
  if (eventTag(evt, FORWARD_STREAM_TAG.name) === FORWARD_STREAM_TAG.value) {
    const failure = FORWARD_FAILURES.get(evt.type ?? "");
    if (!failure) return NextResponse.json({ ok: true, ignored: true });
    const inboundId = eventTag(evt, INBOUND_ID_TAG);
    // Idempotent on its own (one note per task, one alert per day): no ledger needed.
    await noteForwardNotDelivered(inboundId && RESEND_ID.test(inboundId) ? inboundId : null, failure);
    return NextResponse.json({ ok: true, noted: true });
  }

  const eventId = `resend:${id}`;
  try {
    await db.webhookEvent.create({ data: { eventId, source: "resend" } });
  } catch (err) {
    if (isUniqueViolation(err)) return NextResponse.json({ ok: true, duplicate: true });
    logGrowthError("resend-webhook-ledger", err);
    return fail("DB_ERROR", "Could not record the event.", 500);
  }

  if (evt.type === "email.received") {
    const data = evt.data as { email_id?: unknown; from?: unknown; subject?: unknown } | undefined;
    const emailId = typeof data?.email_id === "string" && RESEND_ID.test(data.email_id) ? data.email_id : null;
    if (!emailId) {
      // Nothing to look up: acknowledge so Resend doesn't retry a malformed event.
      logGrowthError("resend-inbound", new Error("email.received without a usable email_id"));
      return NextResponse.json({ ok: true });
    }
    try {
      await forwardInbound({
        emailId,
        from: typeof data?.from === "string" ? data.from : null,
        subject: typeof data?.subject === "string" ? data.subject : null,
      });
    } catch (err) {
      logGrowthError("resend-inbound", err);
      // The reply task already exists, and the retry reuses the send's
      // idempotency key, so the forward can't be doubled.
      await db.webhookEvent.deleteMany({ where: { eventId } }).catch(() => {});
      return fail("INTERNAL_ERROR", "Could not forward the email.", 500);
    }
    return NextResponse.json({ ok: true });
  }

  try {
    const { contactId } = await applyEvent(evt);
    if (contactId) runAfter("resend-webhook-recompute", () => recomputeContact(contactId));
  } catch (err) {
    logGrowthError("resend-webhook", err);
    // Let Resend's retry run the event again from scratch.
    await db.webhookEvent.deleteMany({ where: { eventId } }).catch(() => {});
    return fail("INTERNAL_ERROR", "Could not process the event.", 500);
  }
  return NextResponse.json({ ok: true });
}
