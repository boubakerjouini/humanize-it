// ===========================================================
// lib/email/send.ts — The only path an email takes to Resend.
//
// prepareEmail() runs the gates in a fixed order:
//   1. kill switch (EMAIL_SENDING_ENABLED): off means NO database access at all
//   2. contact lookup              3. allowlist mode (non-production, EMAIL_ALLOWLIST)
//   4. flow toggle                 5. eligibility (skips are recorded with the dedupe key)
//   6. daily budget                7. claim the EmailMessage row by its dedupe key
//   8. render                      9. payload: from, reply-to, RFC 8058 headers, tags
// The dedupe key is unique per recipient and step, and doubles as Resend's
// idempotency key, so a retried run can never email anyone twice.
// ===========================================================

import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import type { Prisma } from "@/app/generated/prisma/client";
import { adminEmails } from "@/lib/admin";
import { emailDomain, emailHash, normalizeEmail } from "@/lib/email/address";
import { remainingBudget, type SendPool } from "@/lib/email/budget";
import { TEMPLATES, isTemplateKey, type FlowKey, type TemplateKey, type TemplateProps } from "@/lib/email/catalog";
import { checkEligibility, usesOneClickUnsubscribe, type SkipReason, type SuppressionScope } from "@/lib/email/eligibility";
import { isFlowEnabled } from "@/lib/email/enroll";
import { oneClickUrl } from "@/lib/email/links";
import { TemplateNotImplementedError, buildRenderCtx, firstNameFrom, renderEmail, unsubscribeScopeFor } from "@/lib/email/render";
import { classifyResendError, describeResendError, getResend, type ResendErrorLike } from "@/lib/email/resend-client";
import { isTopic, type EmailStream, type Topic } from "@/lib/growth/constants";
import { emailSendingMode, isAllowlisted, postalAddress } from "@/lib/growth/flags";
import { isUniqueViolation, logGrowthError } from "@/lib/growth/safe";

export type { SendPool } from "@/lib/email/budget";

export type DeferReason = "disabled" | "allowlist" | "flow_off" | "budget" | "not_configured" | "error";

export type SendOutcome =
  | { status: "sent"; messageId: string; resendId: string }
  | { status: "duplicate"; messageId: string }
  | { status: "skipped"; reason: SkipReason; messageId?: string }
  | { status: "deferred"; reason: DeferReason }
  | { status: "failed"; messageId: string; error: string; retryable: boolean; quotaExceeded?: boolean };

export type PrepareInput<K extends TemplateKey = TemplateKey> = {
  contactId: string;
  template: K;
  props: TemplateProps[K];
  /** Unique per recipient and step, e.g. "seq:<enrollmentId>:<stepKey>". */
  dedupeKey: string;
  pool: SendPool;
  sequenceKey?: string;
  stepKey?: string;
  enrollmentId?: string;
  campaignId?: string;
  /** Marketing topic for templates without a fixed one (campaigns). */
  topicOverride?: Topic;
  /** Admin test send: skips the flow toggle and eligibility, prefixes the subject. */
  isTest?: boolean;
};

export type EmailPayload = {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  headers?: Record<string, string>;
  tags: { name: string; value: string }[];
};

export type Prepared = {
  messageId: string;
  contactId: string;
  dedupeKey: string;
  template: TemplateKey;
  stream: EmailStream;
  pool: SendPool;
  isTest: boolean;
  idempotencyKey: string;
  payload: EmailPayload;
};

type PrepareResult = { ok: true; prepared: Prepared } | { ok: false; outcome: SendOutcome };

const MAX_ATTEMPTS = 3;
const BATCH_SIZE = 100;
const RETRYABLE_STATUSES = ["queued", "failed"];

const deferred = (reason: DeferReason): PrepareResult => ({ ok: false, outcome: { status: "deferred", reason } });

/** Resend tag values allow only ASCII letters, digits, "_" and "-". */
function tagValue(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 256) || "none";
}

function idempotencyKeyFor(dedupeKey: string): string {
  return dedupeKey.length <= 256 ? dedupeKey : createHash("sha256").update(dedupeKey).digest("hex");
}

function fromFor(stream: EmailStream): string {
  const base = process.env.EMAIL_FROM?.trim() ?? "";
  if (stream === "marketing") return process.env.EMAIL_FROM_MARKETING?.trim() || base;
  if (stream === "personal") return process.env.EMAIL_FROM_PERSONAL?.trim() || base;
  return base;
}

/** Props kept for retries, minus the first name (re-derived from the contact). */
function storableProps(props: unknown): Prisma.InputJsonValue | undefined {
  if (!props || typeof props !== "object") return undefined;
  const { firstName: _firstName, ...rest } = props as Record<string, unknown>;
  void _firstName;
  return JSON.parse(JSON.stringify(rest)) as Prisma.InputJsonValue;
}

async function loadSuppressions(email: string): Promise<SuppressionScope[]> {
  const rows = await db.emailSuppression.findMany({ where: { emailHash: emailHash(email) }, select: { scope: true } });
  return rows.map((r) => r.scope).filter((s): s is SuppressionScope => s === "all" || s === "nonessential" || s === "marketing");
}

type MessageFields = {
  contactId: string;
  toEmailHash: string;
  toDomain: string | null;
  template: string;
  stream: string;
  topic: string | null;
  sequenceKey: string | null;
  stepKey: string | null;
  enrollmentId: string | null;
  campaignId: string | null;
};

function messageFields(i: PrepareInput, email: string | null, stream: EmailStream, topic: Topic | null): MessageFields {
  return {
    contactId: i.contactId,
    toEmailHash: email ? emailHash(email) : "",
    toDomain: email ? emailDomain(email) : null,
    template: i.template,
    stream,
    topic,
    sequenceKey: i.sequenceKey ?? null,
    stepKey: i.stepKey ?? null,
    enrollmentId: i.enrollmentId ?? null,
    campaignId: i.campaignId ?? null,
  };
}

/** Record an eligibility skip under the dedupe key; an already-sent row reads as a duplicate. */
async function recordSkip(i: PrepareInput, fields: MessageFields, reason: SkipReason): Promise<SendOutcome> {
  try {
    const row = await db.emailMessage.create({
      data: { ...fields, dedupeKey: i.dedupeKey, status: "skipped", skipReason: reason },
      select: { id: true },
    });
    return { status: "skipped", reason, messageId: row.id };
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
  }
  // A queued campaign row (or a failed earlier attempt) becomes the skip record.
  await db.emailMessage.updateMany({
    where: { dedupeKey: i.dedupeKey, status: { in: RETRYABLE_STATUSES } },
    data: { status: "skipped", skipReason: reason, error: null },
  });
  const existing = await db.emailMessage.findUnique({ where: { dedupeKey: i.dedupeKey }, select: { id: true, status: true } });
  if (!existing) return { status: "skipped", reason };
  if (existing.status === "skipped" || existing.status === "cancelled") return { status: "skipped", reason, messageId: existing.id };
  return { status: "duplicate", messageId: existing.id };
}

type Claim = { kind: "claimed"; messageId: string; queuedAt: Date } | { kind: "duplicate"; messageId: string };

/** Create the row in "sending", or take over a queued/failed one with attempts left. */
async function claimMessage(i: PrepareInput, fields: MessageFields): Promise<Claim> {
  const props = storableProps(i.props);
  try {
    const row = await db.emailMessage.create({
      data: { ...fields, dedupeKey: i.dedupeKey, status: "sending", attempts: 1, props },
      select: { id: true, queuedAt: true },
    });
    return { kind: "claimed", messageId: row.id, queuedAt: row.queuedAt };
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
  }
  const res = await db.emailMessage.updateMany({
    where: { dedupeKey: i.dedupeKey, status: { in: RETRYABLE_STATUSES }, attempts: { lt: MAX_ATTEMPTS } },
    data: {
      status: "sending",
      attempts: { increment: 1 },
      error: null,
      skipReason: null,
      toEmailHash: fields.toEmailHash,
      toDomain: fields.toDomain,
      ...(props !== undefined ? { props } : {}),
    },
  });
  const row = await db.emailMessage.findUnique({ where: { dedupeKey: i.dedupeKey }, select: { id: true, queuedAt: true } });
  if (!row) throw new Error("email message vanished during claim");
  return res.count === 1 ? { kind: "claimed", messageId: row.id, queuedAt: row.queuedAt } : { kind: "duplicate", messageId: row.id };
}

async function markFailed(messageId: string, error: string, retryable: boolean, extra: { quotaExceeded?: boolean; subject?: string } = {}): Promise<SendOutcome> {
  try {
    await db.emailMessage.update({
      where: { id: messageId },
      data: { status: "failed", error: error.slice(0, 500), ...(extra.subject ? { subject: extra.subject } : {}) },
    });
  } catch (err) {
    logGrowthError("email-mark-failed", err);
  }
  return { status: "failed", messageId, error, retryable, ...(extra.quotaExceeded ? { quotaExceeded: true } : {}) };
}

export async function prepareEmail<K extends TemplateKey>(i: PrepareInput<K>): Promise<PrepareResult> {
  // 1. Kill switch first: with sending off, nothing below touches the database.
  const mode = emailSendingMode();
  if (mode === "off") return deferred("disabled");
  if (!getResend()) return deferred("not_configured");

  const meta = TEMPLATES[i.template];
  const stream = meta.stream;
  const topic = i.topicOverride ?? meta.topic;
  const isTest = i.isTest === true;

  // 2. Contact.
  const contact = await db.contact.findUnique({
    where: { id: i.contactId },
    select: {
      id: true,
      email: true,
      name: true,
      userId: true,
      lifecycleEmails: true,
      subscribedTopics: true,
      emailVerifiedAt: true,
      emailStatus: true,
    },
  });
  if (!contact) return { ok: false, outcome: { status: "skipped", reason: "contact_missing" } };
  const email = normalizeEmail(contact.email);

  // 3. Outside production (or while EMAIL_ALLOWLIST is set) only allowlisted inboxes get mail.
  if (mode === "allowlist" && !isAllowlisted(email, adminEmails())) return deferred("allowlist");

  // 4. Flow toggle (campaigns, personal notes and tests have none to check).
  if (meta.flow && !isTest && !(await isFlowEnabled(meta.flow))) return deferred("flow_off");

  // 5. Eligibility; a skip is recorded so the step isn't retried forever.
  const fields = messageFields(i, email, stream, topic);
  const verdict = checkEligibility({
    contact: { ...contact, email },
    stream,
    topic,
    suppressions: email ? await loadSuppressions(email) : [],
    now: new Date(),
    postalAddressConfigured: postalAddress() !== null,
    isTest,
  });
  if (!verdict.ok) return { ok: false, outcome: await recordSkip(i, fields, verdict.reason) };
  if (!email) return { ok: false, outcome: await recordSkip(i, fields, "no_email") };

  // 6. Daily budget.
  if ((await remainingBudget(i.pool)) <= 0) return deferred("budget");

  // 7. Claim the row (this also claims pre-queued campaign rows).
  const claim = await claimMessage(i, fields);
  if (claim.kind === "duplicate") return { ok: false, outcome: { status: "duplicate", messageId: claim.messageId } };

  // 8. Render. sentAt is pinned to queuedAt so a retry renders byte-identical content.
  const ctx = buildRenderCtx({
    contactId: contact.id,
    template: i.template,
    stream,
    topic,
    firstName: i.props.firstName ?? firstNameFrom(contact.name),
    sentAt: claim.queuedAt,
  });
  let rendered: Awaited<ReturnType<typeof renderEmail>>;
  try {
    rendered = await renderEmail(i.template, i.props, ctx);
  } catch (err) {
    const missing = err instanceof TemplateNotImplementedError;
    const message = missing ? "template_missing" : `render_error: ${err instanceof Error ? err.message : String(err)}`;
    return { ok: false, outcome: await markFailed(claim.messageId, message, false) };
  }

  // 9. Payload.
  const headers = usesOneClickUnsubscribe(stream)
    ? {
        "List-Unsubscribe": `<${oneClickUrl(contact.id, unsubscribeScopeFor(stream))}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      }
    : undefined;
  const replyTo = process.env.EMAIL_REPLY_TO?.trim() || undefined;
  const subject = isTest ? `[TEST] ${rendered.subject}` : rendered.subject;

  return {
    ok: true,
    prepared: {
      messageId: claim.messageId,
      contactId: contact.id,
      dedupeKey: i.dedupeKey,
      template: i.template,
      stream,
      pool: i.pool,
      isTest,
      idempotencyKey: idempotencyKeyFor(i.dedupeKey),
      payload: {
        from: fromFor(stream),
        to: email,
        subject,
        html: rendered.html,
        text: rendered.text,
        ...(replyTo ? { replyTo } : {}),
        ...(headers ? { headers } : {}),
        tags: [
          { name: "m", value: tagValue(claim.messageId) },
          { name: "stream", value: tagValue(stream) },
          { name: "tpl", value: tagValue(i.template) },
        ],
      },
    },
  };
}

async function markSent(p: Prepared, resendId: string | null): Promise<void> {
  const now = new Date();
  await db.emailMessage.update({
    where: { id: p.messageId },
    data: { status: "sent", resendId, sentAt: now, subject: p.payload.subject, error: null },
  });
  try {
    await db.contact.update({ where: { id: p.contactId }, data: { lastEmailedAt: now } });
  } catch (err) {
    logGrowthError("email-last-emailed", err);
  }
}

async function settleError(p: Prepared, error: ResendErrorLike): Promise<SendOutcome> {
  const cls = classifyResendError(error);
  if (cls.alreadyAccepted) {
    // An earlier request with this idempotency key went through: it was sent.
    await markSent(p, null);
    return { status: "duplicate", messageId: p.messageId };
  }
  return markFailed(p.messageId, describeResendError(error), cls.retryable, {
    quotaExceeded: cls.quotaExceeded,
    subject: p.payload.subject,
  });
}

export async function deliverOne(p: Prepared): Promise<SendOutcome> {
  const resend = getResend();
  if (!resend) return markFailed(p.messageId, "not_configured", true, { subject: p.payload.subject });
  try {
    const { data, error } = await resend.emails.send(p.payload, { idempotencyKey: p.idempotencyKey });
    if (error || !data) return settleError(p, error);
    await markSent(p, data.id);
    return { status: "sent", messageId: p.messageId, resendId: data.id };
  } catch (err) {
    // Transport failure: unknown whether Resend got it; the idempotency key makes a retry safe.
    return markFailed(p.messageId, `network_error: ${err instanceof Error ? err.message : String(err)}`, true, {
      subject: p.payload.subject,
    });
  }
}

/**
 * Send many prepared emails, 100 per Resend batch call. Resend returns ids in
 * request order. A batch Resend rejected outright falls back to one call per
 * email; an ambiguous failure (5xx, network) is marked retryable instead, since
 * resending per item under new idempotency keys could deliver twice. A quota
 * error stops the rest of the run.
 */
export async function deliverBatch(ps: Prepared[]): Promise<SendOutcome[]> {
  const outcomes: SendOutcome[] = new Array(ps.length);
  const resend = getResend();
  let quotaExceeded = false;

  for (let start = 0; start < ps.length; start += BATCH_SIZE) {
    const chunk = ps.slice(start, start + BATCH_SIZE);
    const settle = (j: number, outcome: SendOutcome) => {
      outcomes[start + j] = outcome;
    };

    if (!resend || quotaExceeded) {
      for (let j = 0; j < chunk.length; j++) {
        const reason = quotaExceeded ? "quota_exceeded" : "not_configured";
        settle(j, await markFailed(chunk[j].messageId, reason, true, { quotaExceeded, subject: chunk[j].payload.subject }));
      }
      continue;
    }

    if (chunk.length === 1) {
      const outcome = await deliverOne(chunk[0]);
      if (outcome.status === "failed" && outcome.quotaExceeded) quotaExceeded = true;
      settle(0, outcome);
      continue;
    }

    const ids = chunk.map((p) => p.messageId).sort();
    const idempotencyKey = `batch/${createHash("sha256").update(ids.join(",")).digest("hex")}`;
    let result: Awaited<ReturnType<typeof resend.batch.send>> | null = null;
    let transportError: unknown = null;
    try {
      result = await resend.batch.send(
        chunk.map((p) => p.payload),
        { idempotencyKey, batchValidation: "strict" }
      );
    } catch (err) {
      transportError = err;
    }

    if (result && !result.error && result.data) {
      const sent = result.data.data;
      for (let j = 0; j < chunk.length; j++) {
        const id = sent[j]?.id;
        if (id) {
          await markSent(chunk[j], id);
          settle(j, { status: "sent", messageId: chunk[j].messageId, resendId: id });
        } else {
          settle(j, await markFailed(chunk[j].messageId, "batch_missing_id", true, { subject: chunk[j].payload.subject }));
        }
      }
      continue;
    }

    const cls = result?.error ? classifyResendError(result.error) : null;
    if (cls?.quotaExceeded) {
      quotaExceeded = true;
      for (let j = 0; j < chunk.length; j++) {
        settle(j, await markFailed(chunk[j].messageId, describeResendError(result?.error), true, { quotaExceeded: true, subject: chunk[j].payload.subject }));
      }
      continue;
    }
    if (cls?.definitelyNotSent && result?.error?.name !== "rate_limit_exceeded") {
      // Rejected as a whole (one bad item in strict mode): isolate it.
      for (let j = 0; j < chunk.length; j++) {
        const outcome = await deliverOne(chunk[j]);
        if (outcome.status === "failed" && outcome.quotaExceeded) quotaExceeded = true;
        settle(j, outcome);
      }
      continue;
    }
    const reason = result?.error
      ? describeResendError(result.error)
      : `network_error: ${transportError instanceof Error ? transportError.message : String(transportError)}`;
    for (let j = 0; j < chunk.length; j++) {
      settle(j, await markFailed(chunk[j].messageId, reason, true, { subject: chunk[j].payload.subject }));
    }
  }
  return outcomes;
}

/** prepareEmail + deliverOne. Never throws: an unexpected error comes back as deferred "error". */
export async function sendEmail<K extends TemplateKey>(i: PrepareInput<K>): Promise<SendOutcome> {
  try {
    const prepared = await prepareEmail(i);
    if (!prepared.ok) return prepared.outcome;
    return await deliverOne(prepared.prepared);
  } catch (err) {
    logGrowthError(`send:${i.template}`, err);
    return { status: "deferred", reason: "error" };
  }
}

/**
 * Would an inline send of this flow go out right now? Mode, allowlist, flow
 * toggle and budget only; no writes. Lets an API promise "check your inbox"
 * only when that is true. Never throws.
 */
export async function canSendInline(flow: FlowKey, email: string): Promise<boolean> {
  try {
    const mode = emailSendingMode();
    if (mode === "off" || !getResend()) return false;
    if (mode === "allowlist" && !isAllowlisted(normalizeEmail(email), adminEmails())) return false;
    if (!(await isFlowEnabled(flow))) return false;
    return (await remainingBudget("inline")) > 0;
  } catch (err) {
    logGrowthError("can-send-inline", err);
    return false;
  }
}

/**
 * Rebuild the input of a stored message so the daily job can retry it with the
 * props it was first sent with. Null when the row can't be retried that way
 * (no contact, unknown template, or no stored props, e.g. a queued campaign row
 * whose content lives on the campaign).
 */
export function buildRetryInput(
  m: {
    contactId: string | null;
    template: string;
    props: Prisma.JsonValue | null;
    dedupeKey: string;
    topic: string | null;
    sequenceKey: string | null;
    stepKey: string | null;
    enrollmentId: string | null;
    campaignId: string | null;
  },
  pool: SendPool = "bulk"
): PrepareInput | null {
  if (!m.contactId || !isTemplateKey(m.template)) return null;
  if (!m.props || typeof m.props !== "object" || Array.isArray(m.props)) return null;
  return {
    contactId: m.contactId,
    template: m.template,
    props: m.props as unknown as TemplateProps[TemplateKey],
    dedupeKey: m.dedupeKey,
    pool,
    sequenceKey: m.sequenceKey ?? undefined,
    stepKey: m.stepKey ?? undefined,
    enrollmentId: m.enrollmentId ?? undefined,
    campaignId: m.campaignId ?? undefined,
    topicOverride: isTopic(m.topic) && TEMPLATES[m.template].topic === null ? m.topic : undefined,
  };
}
