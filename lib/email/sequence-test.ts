// ===========================================================
// lib/email/sequence-test.ts — The test-first rule for automated sequences.
//
// A sequence only switches on once every step's current content went to an
// admin's own inbox as a "[TEST]": sendStepTest() records the send under a key
// carrying the step's content digest, and untestedSteps() lists the steps with
// no such test in the last week. The digest comes from a canonical render
// (fixed sample date, no recipient), so it moves only when the template copy
// or the step's props builder changes, never with the day or the admin.
// Tests share the personal-email test cap (lib/email/personal.ts).
// ===========================================================

import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import type { SequenceKey, TemplateKey, TemplateProps } from "@/lib/email/catalog";
import { PERSONAL_DAILY_LIMIT, PERSONAL_TEST_LIMIT_KEY } from "@/lib/email/personal";
import { TemplateNotImplementedError, buildRenderCtx, renderEmail } from "@/lib/email/render";
import { sendEmail, type SendOutcome } from "@/lib/email/send";
import { findStep, getSequence, sampleContext, type EngineStep } from "@/lib/email/sequences";
import { checkDailyLimit } from "@/lib/rate-limit";

/** How long a step test keeps the flow switchable on. */
export const SEQUENCE_TEST_TTL_MS = 7 * 86_400_000;

/** Fixed "now" of the canonical render: dates in the props must not move the digest. */
const CANONICAL_NOW = new Date("2026-01-01T09:00:00Z");

/** Statuses that mean the test reached Resend (later webhooks move sent → delivered or bounced). */
const TEST_WENT_OUT = ["sent", "delivered"];

function stepProps(key: SequenceKey, step: EngineStep, now: Date): TemplateProps[TemplateKey] {
  return (step.props ? step.props(sampleContext(key, now)) : {}) as TemplateProps[TemplateKey];
}

/** Short digest of the step's canonical render. Null when its template isn't built. */
export async function stepDigest(key: SequenceKey, step: EngineStep): Promise<string | null> {
  const ctx = buildRenderCtx({ contactId: null, template: step.template, firstName: null, sentAt: CANONICAL_NOW });
  try {
    const { subject, text } = await renderEmail(step.template, stepProps(key, step, CANONICAL_NOW), ctx);
    return createHash("sha256").update(`${subject}|${text}`).digest("hex").slice(0, 16);
  } catch (err) {
    if (err instanceof TemplateNotImplementedError) return null;
    throw err;
  }
}

export function stepTestPrefix(key: string, stepKey: string, digest: string): string {
  return `test:seq:${key}:${stepKey}:${digest}:`;
}

export type StepTestState = { key: string; tested: boolean; testedAt: Date | null };

/** Each step of the sequence, tested or not for its current content. */
export async function stepTestStates(key: SequenceKey, now: Date = new Date()): Promise<StepTestState[]> {
  const seq = getSequence(key);
  if (!seq) return [];
  const [digests, tests] = await Promise.all([
    Promise.all(seq.steps.map((s) => stepDigest(key, s))),
    db.emailMessage.findMany({
      where: {
        dedupeKey: { startsWith: `test:seq:${key}:` },
        status: { in: TEST_WENT_OUT },
        queuedAt: { gte: new Date(now.getTime() - SEQUENCE_TEST_TTL_MS) },
      },
      select: { dedupeKey: true, queuedAt: true },
      orderBy: { queuedAt: "desc" },
    }),
  ]);
  return seq.steps.map((s, i) => {
    const digest = digests[i];
    const hit = digest ? tests.find((t) => t.dedupeKey.startsWith(stepTestPrefix(key, s.key, digest))) : undefined;
    return { key: s.key, tested: !!hit, testedAt: hit?.queuedAt ?? null };
  });
}

/** Steps whose current content has no recent test; empty means the flow may switch on. */
export async function untestedSteps(key: SequenceKey, now: Date = new Date()): Promise<string[]> {
  return (await stepTestStates(key, now)).filter((s) => !s.tested).map((s) => s.key);
}

export type StepTestResult = { status: "unknown_step" } | { status: "template_missing" } | { status: "rate_limited" } | { status: "done"; result: SendOutcome };

/** Send one step, "[TEST]" in the subject and today's sample data, to the admin's own contact. */
export async function sendStepTest(ownContactId: string, key: SequenceKey, stepKey: string, now: Date = new Date()): Promise<StepTestResult> {
  const step = findStep(key, stepKey);
  if (!step) return { status: "unknown_step" };
  const digest = await stepDigest(key, step);
  if (!digest) return { status: "template_missing" };
  const limit = await checkDailyLimit(PERSONAL_TEST_LIMIT_KEY, PERSONAL_DAILY_LIMIT);
  if (!limit.ok) return { status: "rate_limited" };
  // No sequenceKey/stepKey on the row: a test must not count in the step's stats.
  const result = await sendEmail({
    contactId: ownContactId,
    template: step.template,
    props: stepProps(key, step, now),
    dedupeKey: `${stepTestPrefix(key, step.key, digest)}${now.getTime()}`,
    pool: "inline",
    isTest: true,
  });
  return { status: "done", result };
}
