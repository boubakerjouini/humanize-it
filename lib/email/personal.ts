// ===========================================================
// lib/email/personal.ts — The test-first rule for 1:1 founder emails.
//
// A personal email only goes to a contact after the sender sent the exact same
// subject and body to their own inbox: sendPersonalTest() records a "[TEST]"
// send under a key carrying the content digest, and sendPersonalNote() refuses
// a send with no such test in the last day. Any edit changes the digest, so it
// needs a new test. Both the admin composer (/api/admin/email/personal) and the
// founder's agent (/api/agent/email, /api/agent/inbox) go through here, and
// share one daily cap.
// ===========================================================

import { createHash } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { sendEmail, type SendOutcome } from "@/lib/email/send";
import { checkDailyLimit } from "@/lib/rate-limit";

/** How long a test keeps the same content sendable. */
export const PERSONAL_TEST_TTL_MS = 24 * 3_600_000;

/** Daily cap on personal emails, and separately on their tests, whoever sends them. */
export const PERSONAL_DAILY_LIMIT = 40;

/** Statuses that mean the test reached Resend (later webhooks move sent → delivered or bounced). */
const TEST_WENT_OUT = ["sent", "delivered"];

export const personalEmailSchema = z.object({
  subject: z.string().trim().min(1).max(150),
  bodyMd: z.string().trim().min(1).max(10_000),
});

export type PersonalEmail = z.infer<typeof personalEmailSchema>;

/** Short content digest of a personal email (subject and body as sent, trimmed). */
export function personalDigest(subject: string, bodyMd: string): string {
  return createHash("sha256").update(`${subject}|${bodyMd}`).digest("hex").slice(0, 16);
}

/** Dedupe key of a test send: unique per click, so the same content can be tested again. */
export function personalTestKey(digest: string, now: Date = new Date()): string {
  return `${personalTestPrefix(digest)}${now.getTime()}`;
}

function personalTestPrefix(digest: string): string {
  return `test:personal:${digest}:`;
}

/** True when this admin's own inbox got a test of this exact content within the last day. */
export async function hasRecentPersonalTest(adminContactId: string, digest: string, now: Date = new Date()): Promise<boolean> {
  const test = await db.emailMessage.findFirst({
    where: {
      contactId: adminContactId,
      dedupeKey: { startsWith: personalTestPrefix(digest) },
      status: { in: TEST_WENT_OUT },
      queuedAt: { gte: new Date(now.getTime() - PERSONAL_TEST_TTL_MS) },
    },
    select: { id: true },
  });
  return !!test;
}

/** Send the "[TEST]" copy to the sender's own contact. Null when today's test cap is used up. */
export async function sendPersonalTest(ownContactId: string, email: PersonalEmail): Promise<SendOutcome | null> {
  const limit = await checkDailyLimit("admin:personal-test", PERSONAL_DAILY_LIMIT);
  if (!limit.ok) return null;
  return sendEmail({
    contactId: ownContactId,
    template: "personal_note",
    props: { subject: email.subject, bodyMd: email.bodyMd },
    dedupeKey: personalTestKey(personalDigest(email.subject, email.bodyMd)),
    pool: "inline",
    isTest: true,
  });
}

export type PersonalSendResult = { status: "test_required" } | { status: "rate_limited" } | { status: "done"; result: SendOutcome };

/**
 * Send to a contact once the sender's own inbox got a test of this exact
 * subject and body. inReplyTo (a Message-ID) threads it as a reply; it isn't
 * part of the tested content. Deduplicated per recipient and content.
 */
export async function sendPersonalNote(input: {
  ownContactId: string;
  contactId: string;
  email: PersonalEmail;
  inReplyTo?: string;
}): Promise<PersonalSendResult> {
  const { subject, bodyMd } = input.email;
  const digest = personalDigest(subject, bodyMd);
  if (!(await hasRecentPersonalTest(input.ownContactId, digest))) return { status: "test_required" };
  const limit = await checkDailyLimit("admin:personal", PERSONAL_DAILY_LIMIT);
  if (!limit.ok) return { status: "rate_limited" };
  const result = await sendEmail({
    contactId: input.contactId,
    template: "personal_note",
    props: { subject, bodyMd, ...(input.inReplyTo ? { inReplyTo: input.inReplyTo } : {}) },
    dedupeKey: `personal:${input.contactId}:${digest}`,
    pool: "inline",
  });
  return { status: "done", result };
}

const DEFER_MESSAGES: Record<string, string> = {
  allowlist: "Your inbox isn't on the allowlist, so the test was held back.",
  budget: "Today's email budget is used up. Try again tomorrow.",
  disabled: "Email sending is switched off.",
  not_configured: "Resend isn't configured.",
};

/** What happened to a test send, in words for the person who asked for it. */
export function testOutcomeMessage(result: SendOutcome, to: string): string {
  switch (result.status) {
    case "sent":
      return `Test sent to ${to}. Check your inbox, then send it.`;
    case "deferred":
      return DEFER_MESSAGES[result.reason] ?? "The test was held back.";
    case "skipped":
      return `The test was skipped (${result.reason.replace(/_/g, " ")}).`;
    case "failed":
      return `The test failed: ${result.error}`;
    default:
      return "The test was not sent.";
  }
}
