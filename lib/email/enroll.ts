// ===========================================================
// lib/email/enroll.ts — Flow toggles and sequence enrollment.
//
// Every flow is OFF until the founder enables it in /admin/sequences, and a
// missing EmailFlowSetting row means OFF. Toggles are cached per instance for
// 60s (call invalidateFlowCache after writing one). Enrollment is idempotent:
// one row per (contact, sequence, cycle), so a retried trigger can't enroll
// anyone twice. A new enrollment's nextRunAt is its first step's due time, so
// one anchored ahead (grant_expiry) isn't picked up by every run until then.
// ===========================================================

import { db } from "@/lib/db";
import type { Prisma, SequenceEnrollment } from "@/app/generated/prisma/client";
import type { FlowKey, SequenceKey } from "@/lib/email/catalog";
import { dueAt, type SequenceStep } from "@/lib/email/schedule";
import { isUniqueViolation, logGrowthError } from "@/lib/growth/safe";

const FLOW_CACHE_TTL_MS = 60_000;
const DAY_MS = 24 * 60 * 60 * 1000;

const flowCache = new Map<string, { enabled: boolean; at: number }>();

/** Is this flow switched on? A missing row or a DB error reads as OFF. */
export async function isFlowEnabled(key: FlowKey): Promise<boolean> {
  const now = Date.now();
  const hit = flowCache.get(key);
  if (hit && now - hit.at < FLOW_CACHE_TTL_MS) return hit.enabled;
  try {
    const row = await db.emailFlowSetting.findUnique({ where: { key }, select: { enabled: true } });
    const enabled = row?.enabled === true;
    flowCache.set(key, { enabled, at: now });
    return enabled;
  } catch (err) {
    logGrowthError("flow-setting", err);
    return false;
  }
}

/** Drop cached toggles on this instance (other instances refresh within 60s). */
export function invalidateFlowCache(key?: FlowKey): void {
  if (key) flowCache.delete(key);
  else flowCache.clear();
}

export type EnrollOptions = {
  /** Step offsets are relative to this; may be in the future (grant expiry). */
  anchorAt: Date;
  /** The sequence's steps (its SequenceDef.steps): nextRunAt becomes the first step's due time. */
  steps: readonly Pick<SequenceStep<unknown>, "offsetHours">[];
  /** Distinguishes repeat enrollments (e.g. the UTC date, a grant's expiry). */
  cycle?: string;
  context?: Prisma.InputJsonValue;
  actor?: string;
  /** Refuse when this sequence was entered within the last N days, whatever the cycle. */
  cooldownDays?: number;
};

/**
 * Enroll a contact. Returns null when the flow is off, the contact is already
 * enrolled in this cycle, or the cooldown is active.
 */
export async function enroll(contactId: string, key: SequenceKey, opts: EnrollOptions): Promise<SequenceEnrollment | null> {
  if (!(await isFlowEnabled(key))) return null;
  const now = new Date();
  if (opts.cooldownDays && opts.cooldownDays > 0) {
    const recent = await db.sequenceEnrollment.findFirst({
      where: { contactId, sequenceKey: key, enrolledAt: { gte: new Date(now.getTime() - opts.cooldownDays * DAY_MS) } },
      select: { id: true },
    });
    if (recent) return null;
  }
  try {
    return await db.sequenceEnrollment.create({
      data: {
        contactId,
        sequenceKey: key,
        cycle: opts.cycle ?? "1",
        status: "active",
        stepIndex: 0,
        anchorAt: opts.anchorAt,
        // A first step already past due is picked up right away (and skipped as late if too old).
        nextRunAt: opts.steps.length > 0 ? dueAt(opts.steps[0], opts.anchorAt) : now,
        context: opts.context,
        enrolledBy: opts.actor ?? "system",
      },
    });
  } catch (err) {
    if (isUniqueViolation(err)) return null;
    throw err;
  }
}

/** Exit active or paused enrollments (all, or only `keys`). Returns how many exited. */
export async function exitEnrollments(contactId: string, opts: { keys?: SequenceKey[]; reason: string }): Promise<number> {
  const res = await db.sequenceEnrollment.updateMany({
    where: {
      contactId,
      status: { in: ["active", "paused"] },
      ...(opts.keys ? { sequenceKey: { in: opts.keys } } : {}),
    },
    data: { status: "exited", exitedAt: new Date(), exitReason: opts.reason.slice(0, 100), nextRunAt: null },
  });
  return res.count;
}
