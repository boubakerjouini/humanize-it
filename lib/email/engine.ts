// ===========================================================
// lib/email/engine.ts — Runs due sequence steps (spec §5.2).
//
// processDueEnrollments (daily job) works in three phases:
//   1. plan     each active enrollment due within the 12h look-ahead: exit,
//               complete, wait, skip (late or condition) or prepare the email
//   2. deliver  one deliverBatch() call within the bulk budget
//   3. advance  by outcome: sent/duplicate/skipped/permanent failure move on;
//               deferred and retryable failures leave the enrollment as it is
// processEnrollmentNow does the same for one enrollment with no look-ahead and
// the inline pool (the welcome email right after signup).
//
// At most one step per enrollment per run, and the advance is conditional on
// the step index we read, so a cron run racing a "Run now" or an inline send
// can never skip or repeat a step. The dedupe key seq:<enrollmentId>:<stepKey>
// makes the send itself idempotent.
// ===========================================================

import { randomInt } from "node:crypto";
import { db } from "@/lib/db";
import type { Prisma, SequenceEnrollment } from "@/app/generated/prisma/client";
import { emailHash, emailDomain, normalizeEmail } from "@/lib/email/address";
import { remainingBudget, type SendPool } from "@/lib/email/budget";
import { TEMPLATES, type TemplateKey, type TemplateProps } from "@/lib/email/catalog";
import type { SkipReason } from "@/lib/email/eligibility";
import { isFlowEnabled } from "@/lib/email/enroll";
import { CRON_LOOKAHEAD_HOURS, dueAt } from "@/lib/email/schedule";
import { deliverBatch, deliverOne, prepareEmail, type Prepared, type SendOutcome } from "@/lib/email/send";
import {
  TRIAL_PASS_DAYS,
  TRIAL_PASS_REDEEM_HOURS,
  WINBACK_BONUS_WORDS,
  actionForOutcome,
  getSequence,
  parseEnrollmentContext,
  planEnrollmentStep,
  type EngineSequence,
  type EngineStep,
  type EnrollmentContext,
  type SequenceContext,
  type StepEffect,
} from "@/lib/email/sequences";
import { grantBonusWords } from "@/lib/crm/bonus";
import { recordEvent } from "@/lib/crm/events";
import { emailSendingMode, trialPassesPerMonth } from "@/lib/growth/flags";
import { isUniqueViolation, logGrowthError } from "@/lib/growth/safe";
import { effectivePlanId } from "@/lib/quota";

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const DEFAULT_RUN_LIMIT = 500;
/** Subscription statuses that count as paying (past_due is still a customer). */
export const PAYING_STATUSES = ["active", "on_trial", "past_due"];
/** Crockford base32 without I, L, O, U: readable when typed from an email. */
const PASS_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export type EngineStats = {
  considered: number;
  sent: number;
  duplicate: number;
  failed: number;
  advanced: number;
  held: number;
  completed: number;
  skipped: Record<string, number>;
  deferred: Record<string, number>;
  exited: Record<string, number>;
  errors: number;
  stoppedReason: string | null;
};

function emptyStats(): EngineStats {
  return {
    considered: 0,
    sent: 0,
    duplicate: 0,
    failed: 0,
    advanced: 0,
    held: 0,
    completed: 0,
    skipped: {},
    deferred: {},
    exited: {},
    errors: 0,
    stoppedReason: null,
  };
}

const bump = (bag: Record<string, number>, key: string) => {
  bag[key] = (bag[key] ?? 0) + 1;
};

// ── Context ─────────────────────────────────────────────────────────────────

type Loaded = { ctx: SequenceContext; email: string | null };

async function loadContext(enr: SequenceEnrollment, now: Date): Promise<Loaded | null> {
  const contact = await db.contact.findUnique({
    where: { id: enr.contactId },
    select: {
      id: true,
      email: true,
      userId: true,
      subscribedTopics: true,
      lifecycleEmails: true,
      magnets: true,
      firstDocumentAt: true,
      lastActiveAt: true,
      user: { select: { plan: true, planExpiresAt: true, createdAt: true, subscription: { select: { status: true } } } },
    },
  });
  if (!contact) return null;
  const seq = enr.sequenceKey;

  let wordsUsed30d = 0;
  if (seq === "grant_expiry" && contact.userId) {
    const agg = await db.document.aggregate({
      where: { userId: contact.userId, createdAt: { gte: new Date(now.getTime() - 30 * DAY_MS) } },
      _sum: { wordCount: true },
    });
    wordsUsed30d = agg._sum.wordCount ?? 0;
  }
  let checkoutSinceEnrollment = false;
  if (seq === "quota_upgrade") {
    const checkout = await db.contactEvent.findFirst({
      where: { contactId: contact.id, type: "checkout_started", occurredAt: { gte: enr.enrolledAt } },
      select: { id: true },
    });
    checkoutSinceEnrollment = !!checkout;
  }

  const user = contact.user;
  const ctx: SequenceContext = {
    now,
    enrollment: {
      id: enr.id,
      sequenceKey: enr.sequenceKey as SequenceContext["enrollment"]["sequenceKey"],
      cycle: enr.cycle,
      anchorAt: enr.anchorAt,
      enrolledAt: enr.enrolledAt,
      stepIndex: enr.stepIndex,
      context: parseEnrollmentContext(enr.context),
    },
    contact: {
      id: contact.id,
      userId: contact.userId,
      subscribedTopics: contact.subscribedTopics,
      lifecycleEmails: contact.lifecycleEmails,
      magnets: contact.magnets,
      firstDocumentAt: contact.firstDocumentAt,
      lastActiveAt: contact.lastActiveAt,
    },
    user: user
      ? { plan: user.plan, effectivePlan: effectivePlanId(user), planExpiresAt: user.planExpiresAt, createdAt: user.createdAt }
      : null,
    hasActivePaidSubscription: !!user?.subscription && PAYING_STATUSES.includes(user.subscription.status),
    wordsUsed30d,
    checkoutSinceEnrollment,
  };
  return { ctx, email: normalizeEmail(contact.email) };
}

async function saveContext(enrollmentId: string, ctx: SequenceContext, patch: Partial<EnrollmentContext>): Promise<void> {
  const next = { ...ctx.enrollment.context, ...patch };
  await db.sequenceEnrollment.update({ where: { id: enrollmentId }, data: { context: next as Prisma.InputJsonValue } });
  ctx.enrollment.context = next;
}

// ── Step effects ────────────────────────────────────────────────────────────

type EffectResult = { ok: true } | { ok: false; reason: SkipReason };

function passCode(): string {
  let s = "";
  for (let i = 0; i < 6; i++) s += PASS_ALPHABET[randomInt(PASS_ALPHABET.length)];
  return `PASS-${s}`;
}

/** PASS- codes created in the last 30 days, the pool TRIAL_PASSES_PER_MONTH caps. */
export async function passesIssuedLast30Days(now: Date = new Date()): Promise<number> {
  return db.discountCode.count({ where: { code: { startsWith: "PASS-" }, createdAt: { gte: new Date(now.getTime() - 30 * DAY_MS) } } });
}

/**
 * One 7-day Pro pass per enrollment, stored in its context so a retry reuses
 * it. The monthly cap is what makes "I fund a limited number of passes" true.
 */
async function issuePass(enr: SequenceEnrollment, ctx: SequenceContext, now: Date): Promise<EffectResult> {
  if (ctx.enrollment.context.trialCode) return { ok: true };
  if ((await passesIssuedLast30Days(now)) >= trialPassesPerMonth()) return { ok: false, reason: "trial_cap" };
  const expiresAt = new Date(now.getTime() + TRIAL_PASS_REDEEM_HOURS * HOUR_MS);
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = passCode();
    try {
      await db.discountCode.create({ data: { code, plan: "PRO", maxUses: 1, grantDays: TRIAL_PASS_DAYS, expiresAt } });
    } catch (err) {
      if (isUniqueViolation(err)) continue;
      throw err;
    }
    await saveContext(enr.id, ctx, { trialCode: code, trialExpiresAt: expiresAt.toISOString() });
    await recordEvent({
      contactId: enr.contactId,
      type: "trial_code_issued",
      dedupeKey: `trial_code:${enr.id}`,
      props: { sequence: enr.sequenceKey, days: TRIAL_PASS_DAYS },
    });
    return { ok: true };
  }
  throw new Error("could not allocate a unique pass code");
}

/** The win-back bonus is granted before the email that announces it. */
async function grantWinbackBonus(enr: SequenceEnrollment, ctx: SequenceContext): Promise<EffectResult> {
  if (ctx.enrollment.context.bonusGranted) return { ok: true };
  const dedupeKey = `bonus:winback:${enr.id}`;
  const granted = await grantBonusWords(enr.contactId, WINBACK_BONUS_WORDS, "winback", dedupeKey);
  if (!granted) {
    // false is also a duplicate: an earlier attempt already paid.
    const prior = await db.contactEvent.findUnique({ where: { dedupeKey }, select: { id: true } });
    if (!prior) return { ok: false, reason: "condition" };
  }
  await saveContext(enr.id, ctx, { bonusGranted: true });
  return { ok: true };
}

function runEffect(effect: StepEffect, enr: SequenceEnrollment, ctx: SequenceContext, now: Date): Promise<EffectResult> {
  return effect === "trial_pass" ? issuePass(enr, ctx, now) : grantWinbackBonus(enr, ctx);
}

// ── Enrollment writes ───────────────────────────────────────────────────────

export const stepDedupeKey = (enrollmentId: string, stepKey: string) => `seq:${enrollmentId}:${stepKey}`;

/** A skipped step leaves a trace under its dedupe key (per-step stats, and it can't be sent later). */
async function recordStepSkip(enr: SequenceEnrollment, step: EngineStep, email: string | null, reason: SkipReason): Promise<void> {
  const meta = TEMPLATES[step.template];
  const dedupeKey = stepDedupeKey(enr.id, step.key);
  try {
    await db.emailMessage.create({
      data: {
        contactId: enr.contactId,
        toEmailHash: email ? emailHash(email) : "",
        toDomain: email ? emailDomain(email) : null,
        template: step.template,
        stream: meta.stream,
        topic: meta.topic,
        sequenceKey: enr.sequenceKey,
        stepKey: step.key,
        enrollmentId: enr.id,
        dedupeKey,
        status: "skipped",
        skipReason: reason,
      },
    });
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    await db.emailMessage.updateMany({
      where: { dedupeKey, status: { in: ["queued", "failed"] } },
      data: { status: "skipped", skipReason: reason, error: null },
    });
  }
}

/** Move past the current step; conditional on the index we read, so it can't double-advance. */
async function advance(enr: SequenceEnrollment, seq: EngineSequence, now: Date): Promise<boolean> {
  const next = seq.steps[enr.stepIndex + 1];
  const res = await db.sequenceEnrollment.updateMany({
    where: { id: enr.id, status: "active", stepIndex: enr.stepIndex },
    data: {
      stepIndex: enr.stepIndex + 1,
      lastStepAt: now,
      nextRunAt: next ? dueAt(next, enr.anchorAt) : null,
      ...(next ? {} : { status: "completed" }),
    },
  });
  return res.count === 1;
}

async function exitOne(enr: SequenceEnrollment, reason: string, now: Date): Promise<void> {
  await db.sequenceEnrollment.updateMany({
    where: { id: enr.id, status: { in: ["active", "paused"] } },
    data: { status: "exited", exitedAt: now, exitReason: reason.slice(0, 100), nextRunAt: null },
  });
}

// ── Planning ────────────────────────────────────────────────────────────────

type Pending = { enr: SequenceEnrollment; seq: EngineSequence };
type StepResult =
  | { kind: "done" }
  | (Pending & { kind: "prepared"; prepared: Prepared })
  | (Pending & { kind: "outcome"; outcome: SendOutcome });

type StepOpts = { now: Date; lookAheadHours: number; pool: SendPool; canSend: boolean };

async function stepEnrollment(enr: SequenceEnrollment, o: StepOpts, stats: EngineStats): Promise<StepResult> {
  stats.considered++;
  const seq = getSequence(enr.sequenceKey);
  if (!seq) {
    await exitOne(enr, "unknown_sequence", o.now);
    bump(stats.exited, "unknown_sequence");
    return { kind: "done" };
  }
  // A flow switched off pauses its enrollments in place; switching it back on resumes them.
  if (!(await isFlowEnabled(seq.key))) {
    bump(stats.deferred, "flow_off");
    return { kind: "done" };
  }
  const loaded = await loadContext(enr, o.now);
  if (!loaded) {
    await exitOne(enr, "contact_missing", o.now);
    bump(stats.exited, "contact_missing");
    return { kind: "done" };
  }
  const plan = planEnrollmentStep(seq, enr, loaded.ctx, o.now, o.lookAheadHours);
  switch (plan.kind) {
    case "idle":
      return { kind: "done" };
    case "exit":
      await exitOne(enr, plan.reason, o.now);
      bump(stats.exited, plan.reason);
      return { kind: "done" };
    case "complete":
      await db.sequenceEnrollment.updateMany({ where: { id: enr.id, status: "active" }, data: { status: "completed", nextRunAt: null } });
      stats.completed++;
      return { kind: "done" };
    case "wait":
      if (enr.nextRunAt?.getTime() !== plan.nextRunAt.getTime()) {
        await db.sequenceEnrollment.updateMany({ where: { id: enr.id, status: "active" }, data: { nextRunAt: plan.nextRunAt } });
      }
      return { kind: "done" };
    case "hold":
      stats.held++;
      return { kind: "done" };
    case "skip":
      await recordStepSkip(enr, plan.step, loaded.email, plan.reason);
      bump(stats.skipped, plan.reason);
      if (await advance(enr, seq, o.now)) stats.advanced++;
      return { kind: "done" };
    case "send": {
      if (!o.canSend) {
        bump(stats.deferred, "budget");
        return { kind: "done" };
      }
      if (plan.step.effect) {
        const effect = await runEffect(plan.step.effect, enr, loaded.ctx, o.now);
        if (!effect.ok) {
          await recordStepSkip(enr, plan.step, loaded.email, effect.reason);
          bump(stats.skipped, effect.reason);
          if (await advance(enr, seq, o.now)) stats.advanced++;
          return { kind: "done" };
        }
      }
      const props = (plan.step.props ? plan.step.props(loaded.ctx) : {}) as TemplateProps[TemplateKey];
      const prepared = await prepareEmail({
        contactId: enr.contactId,
        template: plan.step.template,
        props,
        dedupeKey: stepDedupeKey(enr.id, plan.step.key),
        pool: o.pool,
        sequenceKey: enr.sequenceKey,
        stepKey: plan.step.key,
        enrollmentId: enr.id,
      });
      if (!prepared.ok) return { kind: "outcome", enr, seq, outcome: prepared.outcome };
      return { kind: "prepared", enr, seq, prepared: prepared.prepared };
    }
  }
}

/** Phase 3 for one outcome. Returns the reason to stop the run, if any. */
async function applyOutcome(p: Pending & { outcome: SendOutcome }, now: Date, stats: EngineStats): Promise<string | null> {
  const o = p.outcome;
  if (o.status === "sent") stats.sent++;
  else if (o.status === "duplicate") stats.duplicate++;
  else if (o.status === "skipped") bump(stats.skipped, o.reason);
  else if (o.status === "deferred") bump(stats.deferred, o.reason);
  else stats.failed++;

  const action = actionForOutcome(o);
  if (action === "advance") {
    if (await advance(p.enr, p.seq, now)) stats.advanced++;
    return null;
  }
  if (action === "hold") {
    stats.held++;
    return null;
  }
  if (o.status === "deferred") return o.reason;
  return o.status === "failed" && o.quotaExceeded ? "quota_exceeded" : "stopped";
}

// ── Entry points ────────────────────────────────────────────────────────────

/**
 * Daily job step: run every active enrollment due within the look-ahead, at
 * most one step each. With sending off nothing is touched at all, so a step
 * isn't skipped or advanced while the kill switch is down.
 */
export async function processDueEnrollments(opts: { now?: Date; deadlineMs?: number; limit?: number } = {}): Promise<EngineStats> {
  const now = opts.now ?? new Date();
  const stats = emptyStats();
  if (emailSendingMode() === "off") {
    stats.stoppedReason = "sending_off";
    return stats;
  }
  const rows = await db.sequenceEnrollment.findMany({
    where: { status: "active", nextRunAt: { lte: new Date(now.getTime() + CRON_LOOKAHEAD_HOURS * HOUR_MS) } },
    orderBy: { nextRunAt: "asc" },
    take: opts.limit ?? DEFAULT_RUN_LIMIT,
  });

  // prepareEmail checks the budget against what has already left; reserve slots so one batch can't overshoot it.
  let slots = await remainingBudget("bulk", now);
  const batch: (Pending & { prepared: Prepared })[] = [];

  for (const enr of rows) {
    if (opts.deadlineMs && Date.now() > opts.deadlineMs) {
      stats.stoppedReason = "deadline";
      break;
    }
    try {
      const r = await stepEnrollment(enr, { now, lookAheadHours: CRON_LOOKAHEAD_HOURS, pool: "bulk", canSend: slots > 0 }, stats);
      if (r.kind === "prepared") {
        batch.push(r);
        slots--;
      } else if (r.kind === "outcome") {
        const stop = await applyOutcome(r, now, stats);
        if (stop) {
          stats.stoppedReason = stop;
          break;
        }
      }
    } catch (err) {
      stats.errors++;
      logGrowthError(`engine:${enr.sequenceKey}`, err);
    }
  }

  if (batch.length > 0) {
    const outcomes = await deliverBatch(batch.map((b) => b.prepared));
    for (let i = 0; i < batch.length; i++) {
      try {
        const stop = await applyOutcome({ ...batch[i], outcome: outcomes[i] }, now, stats);
        if (stop && !stats.stoppedReason) stats.stoppedReason = stop;
      } catch (err) {
        stats.errors++;
        logGrowthError("engine-advance", err);
      }
    }
  }
  return stats;
}

/**
 * Run one enrollment's due step right now (no look-ahead, inline pool): the
 * welcome email after signup. Never throws.
 */
export async function processEnrollmentNow(enrollmentId: string): Promise<EngineStats> {
  const now = new Date();
  const stats = emptyStats();
  try {
    if (emailSendingMode() === "off") {
      stats.stoppedReason = "sending_off";
      return stats;
    }
    const enr = await db.sequenceEnrollment.findUnique({ where: { id: enrollmentId } });
    if (!enr || enr.status !== "active") return stats;
    const canSend = (await remainingBudget("inline", now)) > 0;
    const r = await stepEnrollment(enr, { now, lookAheadHours: 0, pool: "inline", canSend }, stats);
    if (r.kind === "prepared") {
      const outcome = await deliverOne(r.prepared);
      stats.stoppedReason = await applyOutcome({ ...r, outcome }, now, stats);
    } else if (r.kind === "outcome") {
      stats.stoppedReason = await applyOutcome(r, now, stats);
    }
  } catch (err) {
    stats.errors++;
    logGrowthError("engine-inline", err);
  }
  return stats;
}
