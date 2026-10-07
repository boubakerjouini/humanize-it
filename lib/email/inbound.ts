// ===========================================================
// lib/email/inbound.ts — Forwards mail sent to @humanizeit.app to the founder.
//
// Each email.received webhook opens a CRM task (deduped per email) BEFORE the
// slow part, so no support email is ever lost without a trace: a skip or a
// permanent failure is written on the task and the webhook still answers 200.
// The forward is an ordinary send from our verified domain: a plain-text
// banner (sender, SPF/DKIM/DMARC, task link) and the quoted plain-text body,
// with the original attached as original.eml unless its attachments look
// unsafe, Reply-To set to the real sender. Inbound mail is untrusted: nothing
// here acts on its body, the sender check reads only our receiving server's
// Authentication-Results from the raw message, a DMARC fail is never
// forwarded, and machine mail (auto-replies, bounces, lists) never uses a send.
//
// Order matters: own-domain guard, read the message, machine-mail filter,
// then (until the task records it) the claims: per-sender limit, global
// forward cap, global task cap, and the task itself, marked as claimed. A
// retry finds the mark and never claims twice; a fallback task written by a
// failed read carries no mark, so its retry still claims. Then the original is
// downloaded (its headers give the sender check), the DMARC-fail stop, the
// shared send budget, and the send, which reuses its idempotency key.
// A forward that later bounces is written back on its task by the webhook
// (noteForwardNotDelivered).
// ===========================================================

import { db } from "@/lib/db";
import { founderEmail } from "@/lib/admin";
import { PLACEHOLDER_EMAIL_DOMAIN } from "@/lib/user";
import { canonicalHash, normalizeEmail } from "@/lib/email/address";
import { forwardsToday, remainingBudget } from "@/lib/email/budget";
import { classifyResendError, getResend, type ResendErrorLike } from "@/lib/email/resend-client";
import { bumpDailyMetric, utcDay } from "@/lib/growth/daily-metrics";
import { appUrl } from "@/lib/growth/flags";
import { isUniqueViolation, logGrowthError } from "@/lib/growth/safe";
import { checkDailyLimit } from "@/lib/rate-limit";
import {
  FORWARD_STREAM_TAG,
  INBOUND_DAILY_CAP,
  INBOUND_ID_TAG,
  INBOUND_INLINE_RESERVE,
  INBOUND_SENDER_DAILY_CAP,
  INBOUND_TASK_DAILY_CAP,
  ORIGINAL_MAX_BYTES,
  RESEND_INBOX_HINT,
  automatedReason,
  bareAddress,
  cleanSubject,
  forwardBanner,
  forwardFrom,
  forwardTargets,
  hasRiskyAttachment,
  inboundTaskBody,
  inboundTaskTitle,
  isOwnAddress,
  ownRecipients,
  rawHeaderBlock,
  senderAuth,
  threadingHeaders,
} from "@/lib/email/inbound-rules";

const DAY_MS = 86_400_000;
const DOWNLOAD_TIMEOUT_MS = 15_000;
/** Enough of an over-size original to read its header block for the sender check. */
const HEAD_BYTES = 64 * 1024;

/** createdBy of a per-email task whose claims were taken; a fallback task has the other value. */
const CLAIMED_BY = "inbound-email";
const UNCLAIMED_BY = "inbound-email:unclaimed";

/** Resend errors that mean the key or the forward's sender is wrong: every email would fail the same way. */
const MISCONFIGURED = new Set(["restricted_api_key", "invalid_api_key", "missing_api_key", "invalid_from_address"]);

export type InboundEnvelope = {
  emailId: string;
  /** From the webhook; the message read from Resend wins when they differ. */
  from: string | null;
  subject: string | null;
};

export type InboundSkipReason =
  | "own_domain"
  | "automated"
  | "not_configured"
  | "unreadable"
  | "sender_cap"
  | "daily_cap"
  | "task_cap"
  | "dmarc_fail"
  | "no_budget"
  | "quota"
  | "rejected";

export type InboundResult =
  | { status: "forwarded"; forwardId: string | null }
  | { status: "skipped"; reason: InboundSkipReason };

type TaskFields = { title: string; body: string; contactId: string | null; priority?: string; claimed?: boolean };

const today = () => utcDay().toISOString().slice(0, 10);

/** Log a skip by email id and reason only: never the address. */
function skipped(emailId: string, reason: InboundSkipReason, detail?: string): InboundResult {
  console.info(`[growth:inbound] ${emailId} not forwarded: ${reason}${detail ? ` (${detail})` : ""}`);
  return { status: "skipped", reason };
}

/**
 * Create the task, or refresh it when it already exists (a retry). The claimed
 * mark is only ever added, never removed. Never throws.
 */
async function saveTask(dedupeKey: string, fields: TaskFields): Promise<void> {
  try {
    await db.crmTask.create({
      data: {
        contactId: fields.contactId,
        title: fields.title,
        body: fields.body,
        kind: "email",
        priority: fields.priority ?? "normal",
        source: "rule",
        ruleKey: "inbound_email",
        dedupeKey,
        dueAt: new Date(Date.now() + DAY_MS),
        createdBy: fields.claimed === false ? UNCLAIMED_BY : CLAIMED_BY,
      },
    });
  } catch (err) {
    if (!isUniqueViolation(err)) return logGrowthError("inbound-task", err);
    if (dedupeKey.startsWith("inbound:")) await updateTask(dedupeKey, fields);
  }
}

async function updateTask(dedupeKey: string, fields: TaskFields): Promise<void> {
  await db.crmTask
    .update({
      where: { dedupeKey },
      data: {
        title: fields.title,
        body: fields.body,
        contactId: fields.contactId,
        ...(fields.claimed ? { createdBy: CLAIMED_BY } : {}),
      },
    })
    .catch((err: unknown) => logGrowthError("inbound-task", err));
}

/** Write the outcome under the task's base body. Never throws. */
async function noteOnTask(dedupeKey: string, base: string, note: string): Promise<void> {
  await db.crmTask
    .update({ where: { dedupeKey }, data: { body: `${base}\n${note}` } })
    .catch((err: unknown) => logGrowthError("inbound-task", err));
}

/** True for a Resend error that a retry can't fix (bad key, unknown id, unverified from, bad payload). */
function isPermanent(error: ResendErrorLike): boolean {
  const cls = classifyResendError(error);
  return !cls.retryable || (cls.definitelyNotSent && !cls.quotaExceeded && error?.name !== "rate_limit_exceeded");
}

/** One high-priority task a day when the key or the forward's sender is wrong. */
async function flagMisconfigured(name: string): Promise<void> {
  if (!MISCONFIGURED.has(name)) return;
  await saveTask(`inbound_misconfigured:${today()}`, {
    title: `Support inbox can't forward: Resend refused it (${name})`,
    body:
      `Resend answered ${name}. Check that RESEND_API_KEY has full access (reading received mail needs more than a ` +
      `sending-only key) and that INBOUND_FORWARD_FROM is on a verified sending domain. Until then read support mail in ${RESEND_INBOX_HINT}.`,
    contactId: null,
    priority: "high",
  });
}

/** One task a day once a global limit stops new support mail. */
async function saveCappedTask(): Promise<void> {
  const day = today();
  await saveTask(`inbound_capped:${day}`, {
    title: `Support inbox cap reached on ${day}`,
    body:
      `The support inbox hit a daily limit (${INBOUND_DAILY_CAP} forwards or ${INBOUND_TASK_DAILY_CAP} new emails); ` +
      `later emails weren't forwarded or tracked. Read them in ${RESEND_INBOX_HINT}.`,
    contactId: null,
    priority: "high",
  });
}

/**
 * Take this email's share of the limits: per sender first (so one sender can't
 * use up the global caps), then the forward cap, then the task cap. Returns the
 * reason it was stopped, or null.
 */
async function claimLimits(sender: string | null): Promise<InboundSkipReason | null> {
  if (sender) {
    // Canonical: jane+1@ and j.ane@gmail.com are one sender.
    const senderKey = canonicalHash(sender);
    if (!(await checkDailyLimit(`inbound:${senderKey}`, INBOUND_SENDER_DAILY_CAP)).ok) {
      await saveTask(`inbound_sender_capped:${senderKey.slice(0, 16)}:${today()}`, {
        title: `More mail from ${sender} today (not forwarded)`.slice(0, 180),
        body: `This sender passed ${INBOUND_SENDER_DAILY_CAP} emails today; later ones weren't forwarded. Read them in ${RESEND_INBOX_HINT}.`,
        contactId: null,
      });
      return "sender_cap";
    }
  }
  if ((await forwardsToday()) >= INBOUND_DAILY_CAP) {
    await saveCappedTask();
    return "daily_cap";
  }
  // Forwards only count successes: without this, a spam run from fresh
  // addresses on a day nothing is forwarded would open a task per email.
  if (!(await checkDailyLimit("inbound:tasks", INBOUND_TASK_DAILY_CAP)).ok) {
    await saveCappedTask();
    return "task_cap";
  }
  return null;
}

type Original = { bytes: Buffer } | { skipped: "too_large"; head: Buffer } | { skipped: "unavailable" };

/**
 * The raw message, read with a size cap so a huge email can't exhaust memory.
 * An over-size one still yields its first bytes, enough for the header block.
 */
async function downloadOriginal(url: string | null | undefined): Promise<Original> {
  if (!url) return { skipped: "unavailable" };
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
    if (!res.ok || !res.body) return { skipped: "unavailable" };
    const declaredTooLarge = Number(res.headers.get("content-length") ?? 0) > ORIGINAL_MAX_BYTES;
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (!done) {
        chunks.push(value);
        size += value.byteLength;
      }
      if (size > ORIGINAL_MAX_BYTES || (declaredTooLarge && (done || size >= HEAD_BYTES))) {
        if (!done) await reader.cancel().catch(() => {});
        return { skipped: "too_large", head: Buffer.concat(chunks).subarray(0, HEAD_BYTES) };
      }
      if (done) return { bytes: Buffer.concat(chunks) };
    }
  } catch {
    return { skipped: "unavailable" };
  }
}

function headerBlockOf(original: Original): string | null {
  const bytes = "bytes" in original ? original.bytes : "head" in original ? original.head : null;
  return bytes ? rawHeaderBlock(bytes.subarray(0, HEAD_BYTES).toString("utf8")) : null;
}

/**
 * Forward one received email to the founder and track it with a reply task.
 * Throws only for a retryable Resend failure, so the webhook answers 500 and
 * Resend retries; the task already exists by then, so nothing is lost if every
 * retry fails too.
 */
export async function forwardInbound(envelope: InboundEnvelope): Promise<InboundResult> {
  const { emailId } = envelope;
  if (envelope.from && isOwnAddress(envelope.from)) return skipped(emailId, "own_domain");

  const taskKey = `inbound:${emailId}`;
  const existing = await db.crmTask.findUnique({ where: { dedupeKey: taskKey }, select: { createdBy: true } });
  const fallbackTask: TaskFields = {
    title: inboundTaskTitle(envelope.from ?? "(unknown sender)", envelope.subject),
    body: inboundTaskBody({ receivedFor: [], auth: null }),
    contactId: null,
    claimed: false,
  };

  const resend = getResend();
  if (!resend) {
    await saveTask(taskKey, fallbackTask);
    await noteOnTask(taskKey, fallbackTask.body, `Not forwarded: Resend isn't configured. Read it in ${RESEND_INBOX_HINT}.`);
    return skipped(emailId, "not_configured", "resend");
  }

  // cid: inline images stay references instead of coming back as data URIs we never use.
  const { data: email, error: readError } = await resend.emails.receiving.get(emailId, { html_format: "cid" });
  if (readError || !email) {
    await saveTask(taskKey, fallbackTask);
    const name = readError?.name ?? "no_data";
    if (readError && isPermanent(readError)) {
      await noteOnTask(taskKey, fallbackTask.body, `Not forwarded: Resend refused it (${name}). Read it in ${RESEND_INBOX_HINT}.`);
      await flagMisconfigured(name);
      return skipped(emailId, "unreadable", name);
    }
    await noteOnTask(taskKey, fallbackTask.body, `Couldn't read the message yet (${name}); Resend will retry.`);
    throw new Error(`inbound read failed: ${name}`);
  }

  const from = email.from || envelope.from || "";
  const sender = normalizeEmail(bareAddress(from));
  if (from && isOwnAddress(from)) return skipped(emailId, "own_domain");

  // Machine mail never gets its own task or a send (an out-of-office reply to
  // a campaign would otherwise open a task each time); one task a day says
  // some arrived, so a vendor notice from a noreply@ isn't silently lost.
  const automated = automatedReason(email.headers, from);
  if (automated) {
    if (existing) await noteOnTask(taskKey, fallbackTask.body, `Not forwarded: machine-sent mail (${automated}).`);
    await saveTask(`inbound_automated:${today()}`, {
      title: `Machine-sent mail received on ${today()} (not forwarded)`,
      body: `Machine-sent mail (auto-replies, bounces, lists, no-reply senders) was received and not forwarded today; review it in ${RESEND_INBOX_HINT}.`,
      contactId: null,
      priority: "low",
    });
    return skipped(emailId, "automated", automated);
  }

  const subject = email.subject || envelope.subject;
  const title = inboundTaskTitle(from || "(unknown sender)", subject);
  const receivedFor = ownRecipients(email.received_for);

  if (existing?.createdBy !== CLAIMED_BY) {
    const stopped = await claimLimits(sender);
    if (stopped) return skipped(emailId, stopped);
    // Saved right after the claims so a retry sees the mark and never claims twice.
    await saveTask(taskKey, { title, body: inboundTaskBody({ receivedFor, auth: null }), contactId: null, claimed: true });
  }

  const original = await downloadOriginal(email.raw?.download_url);
  const auth = senderAuth(headerBlockOf(original), from, process.env.INBOUND_AUTHSERV_ID);
  // Never linked to a contact yet: the sender check rests on INBOUND_AUTHSERV_ID,
  // which must first be confirmed against a real received message. Once it is,
  // link only when auth.verified.
  const base = inboundTaskBody({ receivedFor, auth });
  await updateTask(taskKey, { title, body: base, contactId: null, claimed: true });

  if (auth.dmarc === "fail") {
    await noteOnTask(taskKey, base, `Not forwarded: the sender failed DMARC (likely forged). Read it in ${RESEND_INBOX_HINT}.`);
    return skipped(emailId, "dmarc_fail");
  }

  const targets = forwardTargets(process.env.INBOUND_FORWARD_TO, founderEmail(), PLACEHOLDER_EMAIL_DOMAIN);
  const fromAddress = forwardFrom(process.env.INBOUND_FORWARD_FROM, process.env.EMAIL_FROM);
  if (targets.length === 0 || !fromAddress || !sender) {
    const why = !sender ? "the sender address is invalid" : "no forward target or sender is configured";
    await noteOnTask(taskKey, base, `Not forwarded: ${why}.`);
    return skipped(emailId, "not_configured", !sender ? "sender" : "targets");
  }
  if ((await remainingBudget("inline")) - targets.length < INBOUND_INLINE_RESERVE) {
    await noteOnTask(taskKey, base, "Not forwarded: today's email send budget is used up.");
    return skipped(emailId, "no_budget");
  }

  const withheld = hasRiskyAttachment(email.attachments);
  const attach = !withheld && "bytes" in original;
  const { data, error } = await resend.emails.send(
    {
      from: fromAddress,
      to: targets,
      replyTo: sender,
      subject: cleanSubject(subject),
      text: forwardBanner({
        sender,
        subject: cleanSubject(subject),
        auth,
        receivedFor,
        tasksUrl: `${appUrl()}/admin/tasks`,
        attachment: withheld ? "withheld" : "bytes" in original ? "attached" : original.skipped,
        text: email.text,
      }),
      attachments: attach ? [{ filename: "original.eml", content: original.bytes.toString("base64"), contentType: "message/rfc822" }] : undefined,
      headers: { "Auto-Submitted": "auto-generated", "X-HumanizeIt-Inbound-Id": emailId, ...threadingHeaders(email.message_id) },
      tags: [FORWARD_STREAM_TAG, { name: INBOUND_ID_TAG, value: emailId }],
    },
    { idempotencyKey: `inbound-forward/${emailId}` }
  );

  if (error || !data) {
    const cls = classifyResendError(error);
    const name = error?.name ?? "no_data";
    // 409 on our key: an earlier attempt was accepted, so it is forwarded.
    if (!cls.alreadyAccepted) {
      if (cls.quotaExceeded) {
        await noteOnTask(taskKey, base, "Not forwarded: Resend's sending quota is used up.");
        return skipped(emailId, "quota", name);
      }
      if (error && isPermanent(error)) {
        await noteOnTask(taskKey, base, `Not forwarded: Resend refused it (${name}). Read it in ${RESEND_INBOX_HINT}.`);
        await flagMisconfigured(name);
        return skipped(emailId, "rejected", name);
      }
      await noteOnTask(taskKey, base, `Forward failed (${name}); Resend will retry.`);
      throw new Error(`inbound forward failed: ${name}`);
    }
  }

  // Resend's quota counts recipients, not requests.
  await bumpDailyMetric("inbound.forwarded", targets.length);
  await noteOnTask(taskKey, base, "Forwarded to your inbox.");
  return { status: "forwarded", forwardId: data?.id ?? null };
}

export type ForwardFailure = "bounced" | "failed" | "suppressed";

/**
 * A forward Resend accepted never arrived: write it on the email's task, and
 * open one high-priority task a day, since a bounce can put the founder's
 * address on the suppression list and drop every later forward. Idempotent,
 * never throws.
 */
export async function noteForwardNotDelivered(inboundId: string | null, failure: ForwardFailure): Promise<void> {
  const day = today();
  await saveTask(`inbound_forward_bouncing:${day}`, {
    title: `Support forwards are not arriving (${day})`,
    body:
      `A support forward to your inbox was ${failure}. If your address is on Resend's suppression list, remove it ` +
      `(Resend > Suppressions) or every forward will be dropped. Until then read support mail in ${RESEND_INBOX_HINT}.`,
    contactId: null,
    priority: "high",
  });
  if (!inboundId) return;
  const dedupeKey = `inbound:${inboundId}`;
  const note = `Forward did NOT arrive (${failure}): read it in ${RESEND_INBOX_HINT}.`;
  try {
    const task = await db.crmTask.findUnique({ where: { dedupeKey }, select: { body: true } });
    if (!task || task.body?.includes(note)) return;
    await db.crmTask.update({ where: { dedupeKey }, data: { body: task.body ? `${task.body}\n${note}` : note } });
  } catch (err) {
    logGrowthError("inbound-task", err);
  }
}
