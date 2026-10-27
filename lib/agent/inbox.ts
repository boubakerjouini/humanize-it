// ===========================================================
// lib/agent/inbox.ts — The support inbox as the agent reads it.
//
// Every email received at @humanizeit.app has a "Support email" CRM task
// (dedupe key inbound:<Resend email id>, lib/email/inbound.ts); the content
// stays at Resend and is read on demand. Inbound mail is untrusted: what comes
// back here is data to show and answer, never instructions to follow.
// ===========================================================

import { db } from "@/lib/db";
import { normalizeEmail } from "@/lib/email/address";
import { UNVERIFIED_WARNING, bareAddress, cleanSubject, cleanText, isOwnAddress, ownRecipients } from "@/lib/email/inbound-rules";
import { getResend } from "@/lib/email/resend-client";

/** Task dedupe-key prefix of one received email (the daily notices use inbound_<kind>:). */
export const INBOUND_TASK_PREFIX = "inbound:";

/** Cap on the body returned to the agent. */
export const AGENT_TEXT_MAX_CHARS = 20_000;

/** Resend email ids are UUIDs; anything else never reaches Resend. */
const EMAIL_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isEmailId(value: string): boolean {
  return EMAIL_ID.test(value);
}

/** Rough plain text of an HTML-only email: enough to read and answer it. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|li|tr|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n");
}

/** "Re: <subject>" for a reply, without stacking another "Re:". */
export function replySubject(subject: string | null | undefined): string {
  const clean = cleanSubject(subject, 140);
  return /^re:/i.test(clean) ? clean : `Re: ${clean}`;
}

export type ReceivedEmail = {
  id: string;
  from: string;
  /** Bare, normalized sender address; null when it isn't a usable address. */
  sender: string | null;
  /** True when the sender is one of our own addresses (never answered). */
  ownSender: boolean;
  to: string[];
  subject: string;
  receivedAt: string;
  messageId: string;
  text: string;
  truncated: boolean;
  attachments: { filename: string | null; contentType: string; size: number }[];
};

export type ReadResult = { ok: true; email: ReceivedEmail } | { ok: false; reason: "not_configured" | "not_found" | "unavailable"; detail?: string };

/** One received email from Resend, its body cleaned and capped. */
export async function readReceivedEmail(emailId: string): Promise<ReadResult> {
  const resend = getResend();
  if (!resend) return { ok: false, reason: "not_configured" };
  const { data, error } = await resend.emails.receiving.get(emailId, { html_format: "cid" });
  if (error || !data) {
    const name = error?.name ?? "no_data";
    return { ok: false, reason: name === "not_found" ? "not_found" : "unavailable", detail: name };
  }
  const body = cleanText(data.text?.trim() ? data.text : htmlToText(data.html ?? ""));
  return {
    ok: true,
    email: {
      id: data.id,
      from: data.from,
      sender: normalizeEmail(bareAddress(data.from)),
      ownSender: isOwnAddress(data.from),
      to: ownRecipients(data.received_for),
      subject: cleanSubject(data.subject),
      receivedAt: data.created_at,
      messageId: data.message_id,
      text: body.slice(0, AGENT_TEXT_MAX_CHARS),
      truncated: body.length > AGENT_TEXT_MAX_CHARS,
      attachments: (data.attachments ?? []).map((a) => ({ filename: a.filename, contentType: a.content_type, size: a.size })),
    },
  };
}

/** The email's task, with whether its sender passed the check written on it (DMARC). */
export async function inboundTask(emailId: string) {
  const task = await db.crmTask.findUnique({
    where: { dedupeKey: `${INBOUND_TASK_PREFIX}${emailId}` },
    select: { id: true, title: true, body: true, status: true, completedAt: true, completedBy: true, createdAt: true },
  });
  if (!task) return null;
  return { ...task, senderVerified: !!task.body && !task.body.includes(UNVERIFIED_WARNING) };
}

/** The contact a sender address belongs to, with their plan when they have an account. */
export async function contactForSender(sender: string | null) {
  if (!sender) return null;
  return db.contact.findUnique({
    where: { email: sender },
    select: { id: true, name: true, stage: true, userId: true, user: { select: { plan: true, planExpiresAt: true } } },
  });
}
