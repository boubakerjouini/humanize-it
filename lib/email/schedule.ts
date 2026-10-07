// ===========================================================
// lib/email/schedule.ts — Sequence types and due-step logic (pure).
//
// A sequence is code: ordered steps with an hour offset from the enrollment's
// anchor (negative offsets run before it, e.g. "14 days before the grant
// ends"). The daily cron looks 12 hours ahead so each step goes out in the run
// nearest its due time; inline processing looks 0 hours ahead. A step more
// than maxLateHours overdue is skipped rather than sent days late.
// ===========================================================

import type { SequenceKey, TemplateKey } from "@/lib/email/catalog";

export const CRON_LOOKAHEAD_HOURS = 12;
export const DEFAULT_MAX_LATE_HOURS = 48;

const HOUR_MS = 60 * 60 * 1000;

export type StepDecision = "send" | "skip" | "wait";

export type SequenceStep<C> = {
  key: string;
  offsetHours: number;
  template: TemplateKey;
  /** Hours past due before the step is skipped as late (default 48). */
  maxLateHours?: number;
  when?: (ctx: C) => StepDecision;
  props?: (ctx: C) => unknown;
};

export type SequenceDef<C> = {
  key: SequenceKey;
  name: string;
  description: string;
  audience: "user" | "lead" | "any";
  trigger: string;
  /** Ascending offsetHours. */
  steps: SequenceStep<C>[];
  /** Exit reason when the enrollment should stop, else null. */
  exitWhen?: (ctx: C) => string | null;
};

export type EnrollmentState = { status: string; stepIndex: number; anchorAt: Date };

export type DueStep<C> =
  | { kind: "idle" }
  | { kind: "complete" }
  | { kind: "wait"; nextRunAt: Date }
  | { kind: "skip_late"; step: SequenceStep<C> }
  | { kind: "send"; step: SequenceStep<C> };

export function dueAt(step: Pick<SequenceStep<unknown>, "offsetHours">, anchorAt: Date): Date {
  return new Date(anchorAt.getTime() + step.offsetHours * HOUR_MS);
}

export function nextDueStep<C>(
  def: Pick<SequenceDef<C>, "steps">,
  enr: EnrollmentState,
  now: Date,
  opts: { lookAheadHours?: number } = {}
): DueStep<C> {
  if (enr.status !== "active") return { kind: "idle" };
  const step = def.steps[enr.stepIndex];
  if (!step) return { kind: "complete" };

  const due = dueAt(step, enr.anchorAt);
  const lookAheadMs = (opts.lookAheadHours ?? 0) * HOUR_MS;
  if (now.getTime() + lookAheadMs < due.getTime()) return { kind: "wait", nextRunAt: due };

  const maxLateMs = (step.maxLateHours ?? DEFAULT_MAX_LATE_HOURS) * HOUR_MS;
  if (now.getTime() - due.getTime() > maxLateMs) return { kind: "skip_late", step };
  return { kind: "send", step };
}

/** When the step after `stepIndex` is due, or null when the sequence is finished. */
export function nextRunAfter<C>(def: Pick<SequenceDef<C>, "steps">, stepIndex: number, anchorAt: Date): Date | null {
  const next = def.steps[stepIndex + 1];
  return next ? dueAt(next, anchorAt) : null;
}

export type GrantExpiryExitInput = {
  /** The enrollment anchor: planExpiresAt at enrollment time. */
  anchorAt: Date;
  now: Date;
  /** Stored plan (not the effective one). */
  plan: string;
  planExpiresAt: Date | null;
  hasActivePaidSubscription: boolean;
};

/**
 * Exit rule for grant_expiry. checkAndResetQuota clears planExpiresAt and sets
 * FREE when a grant lapses, so "FREE with no expiry, after the anchor" is the
 * normal post-expiry state and must keep running (grant_ended, grant_feedback).
 * Exit only on a paid subscription, a different expiry (new grant), or a
 * change before the anchor (revoked early or made permanent).
 */
export function grantExpiryExitReason(i: GrantExpiryExitInput): "converted" | "grant_changed" | null {
  if (i.hasActivePaidSubscription) return "converted";
  if (i.planExpiresAt) {
    return i.planExpiresAt.getTime() === i.anchorAt.getTime() ? null : "grant_changed";
  }
  if (i.plan === "FREE" && i.now.getTime() >= i.anchorAt.getTime()) return null;
  return "grant_changed";
}
