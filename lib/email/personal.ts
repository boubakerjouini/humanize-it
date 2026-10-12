// ===========================================================
// lib/email/personal.ts — The test-first rule for 1:1 founder emails.
//
// A personal email only goes to a contact after the admin sent the exact same
// subject and body to their own inbox: POST /api/admin/email/personal/test
// records a "[TEST]" send under a key carrying the content digest, and
// POST /api/admin/email/personal refuses a send with no such test in the last
// day. Any edit changes the digest, so it needs a new test.
// ===========================================================

import { createHash } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";

/** How long a test keeps the same content sendable. */
export const PERSONAL_TEST_TTL_MS = 24 * 3_600_000;

/** Statuses that mean the test reached Resend (later webhooks move sent → delivered or bounced). */
const TEST_WENT_OUT = ["sent", "delivered"];

export const personalEmailSchema = z.object({
  subject: z.string().trim().min(1).max(150),
  bodyMd: z.string().trim().min(1).max(10_000),
});

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
