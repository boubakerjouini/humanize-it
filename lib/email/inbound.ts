// ===========================================================
// lib/email/inbound.ts — Forwards mail sent to @humanizeit.app to the founder.
//
// Each email.received webhook opens a CRM task (deduped per email) BEFORE the
// slow part, so no support email is ever lost without a trace: a skip or a
// permanent failure is written on the task and the webhook still answers 200.
// The forward is an ordinary send from our verified domain: a plain-text
// banner (sender, SPF/DKIM/DMARC, task link) with the original attached as
// original.eml, Reply-To set to the real sender. Inbound mail is untrusted:
// nothing here reads or acts on its body, the From is trusted (linked to a
// contact) only when DMARC passed, and machine mail (auto-replies, bounces,
// lists) is dropped before it can use a send.
//
// Order matters: own-domain guard, read the message, machine-mail filter,
// then (first attempt only) the per-sender limit, then the global cap, then
// the task, then the shared send budget, then the send. A retry of the same
// email finds its task and goes straight to the forward, so it never burns
// the sender's limit twice; the send reuses its idempotency key.
// ===========================================================

import { db } from "@/lib/db";
import { founderEmail } from "@/lib/admin";
import { PLACEHOLDER_EMAIL_DOMAIN } from "@/lib/user";
import { emailHash, normalizeEmail } from "@/lib/email/address";
import { forwardsToday, remainingBudget } from "@/lib/email/budget";
import { classifyResendError, getResend } from "@/lib/email/resend-client";
import { bumpDailyMetric, utcDay } from "@/lib/growth/daily-metrics";
import { appUrl } from "@/lib/growth/flags";
import { isUniqueViolation, logGrowthError } from "@/lib/growth/safe";
import { checkDailyLimit } from "@/lib/rate-limit";
import {
  FORWARD_STREAM_TAG,
  INBOUND_DAILY_CAP,
  INBOUND_SENDER_DAILY_CAP,
  ORIGINAL_MAX_BYTES,
  RESEND_INBOX_HINT,
  automatedReason,
  bareAddress,
  cleanSubject,
  forwardBanner,
  forwardFrom,
  forwardTargets,
  inboundTaskBody,
  inboundTaskTitle,
  isOwnAddress,
  ownRecipients,
  senderAuth,
} from "@/lib/email/inbound-rules";

const DAY_MS = 86_400_000;
const DOWNLOAD_TIMEOUT_MS = 15_000;

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
  | "no_budget"
  | "quota"
  | "rejected";

export type InboundResult =
  | { status: "forwarded"; forwardId: string | null }
  | { status: "skipped"; reason: InboundSkipReason };

type TaskFields = { title: string; body: string; contactId: string | null; priority?: string };

/** Log a skip by email id and reason only: never the address. */
function skipped(emailId: string, reason: InboundSkipReason, detail?: string): InboundResult {
  console.info(`[growth:inbound] ${emailId} not forwarded: ${reason}${detail ? ` (${detail})` : ""}`);
  return { status: "skipped", reason };
}

/** Create the task, or refresh it when this email already has one (a retry). Never throws. */
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
        createdBy: "inbound-email",
      },
    });
  } catch (err) {
    if (!isUniqueViolation(err)) return logGrowthError("inbound-task", err);
    if (dedupeKey.startsWith("inbound:")) {
      await db.crmTask
        .update({ where: { dedupeKey }, data: { title: fields.title, body: fields.body, contactId: fields.contactId } })
        .catch((e: unknown) => logGrowthError("inbound-task", e));
    }
  }
}

/** Write the outcome under the task's base body. Never throws. */
async function noteOnTask(dedupeKey: string, base: string, note: string): Promise<void> {
  await db.crmTask
    .update({ where: { dedupeKey }, data: { body: `${base}\n${note}` } })
    .catch((err: unknown) => logGrowthError("inbound-task", err));
}

async function taskExists(dedupeKey: string): Promise<boolean> {
  return !!(await db.crmTask.findUnique({ where: { dedupeKey }, select: { id: true } }));
}

type Original = { content: string } | { skipped: "too_large" | "unavailable" };

/** The raw message as base64, read with a size cap so a huge email can't exhaust memory. */
async function downloadOriginal(url: string | null | undefined): Promise<Original> {
  if (!url) return { skipped: "unavailable" };
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
    if (!res.ok || !res.body) return { skipped: "unavailable" };
    if (Number(res.headers.get("content-length") ?? 0) > ORIGINAL_MAX_BYTES) {
      await res.body.cancel().catch(() => {});
      return { skipped: "too_large" };
    }
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > ORIGINAL_MAX_BYTES) {
        await reader.cancel().catch(() => {});
        return { skipped: "too_large" };
      }
      chunks.push(value);
    }
    return { content: Buffer.concat(chunks).toString("base64") };
  } catch {
    return { skipped: "unavailable" };
  }
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
  const retry = await taskExists(taskKey);
  const fallbackTask: TaskFields = {
    title: inboundTaskTitle(envelope.from ?? "(unknown sender)", envelope.subject),
    body: inboundTaskBody({ receivedFor: [], auth: null }),
    contactId: null,
  };

  const resend = getResend();
  if (!resend) {
    await saveTask(taskKey, fallbackTask);
    await noteOnTask(taskKey, fallbackTask.body, `Not forwarded: Resend isn't configured. Read it in ${RESEND_INBOX_HINT}.`);
    return skipped(emailId, "not_configured", "resend");
  }

  const { data: email, error: readError } = await resend.emails.receiving.get(emailId);
  if (readError || !email) {
    await saveTask(taskKey, fallbackTask);
    const name = readError?.name ?? "no_data";
    if (classifyResendError(readError).retryable) {
      await noteOnTask(taskKey, fallbackTask.body, `Couldn't read the message yet (${name}); Resend will retry.`);
      throw new Error(`inbound read failed: ${name}`);
    }
    await noteOnTask(taskKey, fallbackTask.body, `Not forwarded: couldn't read the message (${name}).`);
    return skipped(emailId, "unreadable", name);
  }

  const from = email.from || envelope.from || "";
  const sender = normalizeEmail(bareAddress(from));
  if (from && isOwnAddress(from)) return skipped(emailId, "own_domain");

  // Machine mail never gets a task or a send (an out-of-office reply to a
  // campaign would otherwise open a task each time). A retry already has one.
  const automated = automatedReason(email.headers, from);
  if (automated) {
    if (retry) await noteOnTask(taskKey, fallbackTask.body, `Not forwarded: machine-sent mail (${automated}).`);
    return skipped(emailId, "automated", automated);
  }

  const auth = senderAuth(email.headers, from);
  const subject = email.subject || envelope.subject;
  const receivedFor = ownRecipients(email.received_for);

  if (!retry && sender) {
    // Sender first: one sender hitting their limit must not use up the global cap.
    const senderKey = emailHash(sender);
    const limit = await checkDailyLimit(`inbound:${senderKey}`, INBOUND_SENDER_DAILY_CAP);
    if (!limit.ok) {
      await saveTask(`inbound_sender_capped:${senderKey.slice(0, 16)}:${utcDay().toISOString().slice(0, 10)}`, {
        title: `More mail from ${sender} today (not forwarded)`.slice(0, 180),
        body: `This sender passed ${INBOUND_SENDER_DAILY_CAP} emails today; later ones weren't forwarded. Read them in ${RESEND_INBOX_HINT}.`,
        contactId: null,
      });
      return skipped(emailId, "sender_cap");
    }
    if ((await forwardsToday()) >= INBOUND_DAILY_CAP) {
      const day = utcDay().toISOString().slice(0, 10);
      await saveTask(`inbound_capped:${day}`, {
        title: `Support inbox cap reached on ${day}`,
        body: `${INBOUND_DAILY_CAP} emails were forwarded today; later ones weren't. Read them in ${RESEND_INBOX_HINT}.`,
        contactId: null,
        priority: "high",
      });
      return skipped(emailId, "daily_cap");
    }
  }

  // Anyone can forge a From: only a DMARC pass links the task to a real contact.
  const contactId =
    auth.verified && sender ? ((await db.contact.findUnique({ where: { email: sender }, select: { id: true } }))?.id ?? null) : null;
  const base = inboundTaskBody({ receivedFor, auth });
  await saveTask(taskKey, { title: inboundTaskTitle(from || "(unknown sender)", subject), body: base, contactId });

  const targets = forwardTargets(process.env.INBOUND_FORWARD_TO, founderEmail(), PLACEHOLDER_EMAIL_DOMAIN);
  const fromAddress = forwardFrom(process.env.INBOUND_FORWARD_FROM, process.env.EMAIL_FROM);
  if (targets.length === 0 || !fromAddress || !sender) {
    const why = !sender ? "the sender address is invalid" : "no forward target or sender is configured";
    await noteOnTask(taskKey, base, `Not forwarded: ${why}.`);
    return skipped(emailId, "not_configured", !sender ? "sender" : "targets");
  }
  if ((await remainingBudget("inline")) <= 0) {
    await noteOnTask(taskKey, base, "Not forwarded: today's email send budget is used up.");
    return skipped(emailId, "no_budget");
  }

  const original = await downloadOriginal(email.raw?.download_url);
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
        attachment: "content" in original ? "attached" : original.skipped,
      }),
      attachments: "content" in original ? [{ filename: "original.eml", content: original.content, contentType: "message/rfc822" }] : undefined,
      headers: { "Auto-Submitted": "auto-generated", "X-HumanizeIt-Inbound-Id": emailId },
      tags: [FORWARD_STREAM_TAG],
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
      if (cls.retryable) {
        await noteOnTask(taskKey, base, `Forward failed (${name}); Resend will retry.`);
        throw new Error(`inbound forward failed: ${name}`);
      }
      await noteOnTask(taskKey, base, `Not forwarded: Resend refused it (${name}).`);
      return skipped(emailId, "rejected", name);
    }
  }

  await bumpDailyMetric("inbound.forwarded");
  await noteOnTask(taskKey, base, "Forwarded to your inbox.");
  return { status: "forwarded", forwardId: data?.id ?? null };
}
