// ===========================================================
// lib/email/circuit-breaker.ts — Stop marketing email before it hurts the domain.
//
// Gmail and Yahoo start filtering a sender at roughly 0.3% spam complaints,
// and a bounce rate above a few percent marks a dirty list. Once there are at
// least 20 marketing sends in 7 days, crossing 4% bounces or 0.3% complaints
// switches off every marketing-led sequence and pauses campaign draining. The
// founder turns flows back on by hand after looking at the email log; nothing
// re-enables itself.
// ===========================================================

import { db } from "@/lib/db";
import { SEQUENCE_KEYS, TEMPLATES, templatesOfFlow, type SequenceKey } from "@/lib/email/catalog";
import { invalidateFlowCache } from "@/lib/email/enroll";
import { logAudit } from "@/lib/audit";

export const BREAKER_MIN_SENDS = 20;
export const BREAKER_WINDOW_DAYS = 7;
export const BOUNCE_TRIP_RATE = 0.04;
export const COMPLAINT_TRIP_RATE = 0.003;
/** Amber warnings in the deliverability tab. */
export const BOUNCE_WARN_RATE = 0.02;
export const COMPLAINT_WARN_RATE = 0.001;

export type BreakerMetrics = { sent: number; bounced: number; complained: number };
export type BreakerState = BreakerMetrics & {
  bounceRate: number;
  complaintRate: number;
  tripped: boolean;
  reason: "bounces" | "complaints" | null;
};

/** Pure: is the breaker tripped for these 7-day marketing numbers? */
export function evaluateBreaker(m: BreakerMetrics): BreakerState {
  const bounceRate = m.sent > 0 ? m.bounced / m.sent : 0;
  const complaintRate = m.sent > 0 ? m.complained / m.sent : 0;
  let reason: BreakerState["reason"] = null;
  if (m.sent >= BREAKER_MIN_SENDS) {
    if (complaintRate > COMPLAINT_TRIP_RATE) reason = "complaints";
    else if (bounceRate > BOUNCE_TRIP_RATE) reason = "bounces";
  }
  return { ...m, bounceRate, complaintRate, tripped: reason !== null, reason };
}

/** Pure: "ok" | "warn" | "bad" for a rate, with the deliverability thresholds. */
export function rateLevel(kind: "bounce" | "complaint", rate: number): "ok" | "warn" | "bad" {
  const [warn, bad] = kind === "bounce" ? [BOUNCE_WARN_RATE, BOUNCE_TRIP_RATE] : [COMPLAINT_WARN_RATE, COMPLAINT_TRIP_RATE];
  if (rate >= bad) return "bad";
  if (rate >= warn) return "warn";
  return "ok";
}

/**
 * Sequences where most templates are marketing. Lifecycle-led flows
 * (onboarding, grant notices) keep running: their marketing steps are still
 * held back by consent, and account notices must not stop over a list problem.
 */
export const MARKETING_SEQUENCES: SequenceKey[] = SEQUENCE_KEYS.filter((key) => {
  const templates = templatesOfFlow(key);
  const marketing = templates.filter((t) => TEMPLATES[t].stream === "marketing").length;
  return marketing * 2 > templates.length;
});

export async function breakerMetrics(now: Date = new Date()): Promise<BreakerMetrics> {
  const since = new Date(now.getTime() - BREAKER_WINDOW_DAYS * 24 * 3_600_000);
  const where = { stream: "marketing", sentAt: { gte: since } };
  const [sent, bounced, complained] = await Promise.all([
    db.emailMessage.count({ where }),
    db.emailMessage.count({ where: { ...where, bouncedAt: { not: null } } }),
    db.emailMessage.count({ where: { ...where, complainedAt: { not: null } } }),
  ]);
  return { sent, bounced, complained };
}

export async function breakerState(now: Date = new Date()): Promise<BreakerState> {
  return evaluateBreaker(await breakerMetrics(now));
}

/** Daily job: evaluate and, when tripped, switch the marketing sequences off (audited once per trip). */
export async function runCircuitBreaker(now: Date = new Date()): Promise<BreakerState & { disabled: SequenceKey[] }> {
  const state = await breakerState(now);
  if (!state.tripped) return { ...state, disabled: [] };
  const on = await db.emailFlowSetting.findMany({
    where: { key: { in: MARKETING_SEQUENCES }, enabled: true },
    select: { key: true },
  });
  const disabled = on.map((r) => r.key as SequenceKey);
  if (disabled.length > 0) {
    await db.emailFlowSetting.updateMany({
      where: { key: { in: disabled } },
      data: { enabled: false, updatedBy: "system:circuit_breaker" },
    });
    invalidateFlowCache();
    await logAudit({
      actorEmail: "system",
      action: "email.circuit_breaker",
      targetType: "email",
      summary: `Marketing sequences paused: ${state.reason} over the limit (${(state.bounceRate * 100).toFixed(1)}% bounces, ${(state.complaintRate * 100).toFixed(2)}% complaints on ${state.sent} sends in 7 days)`,
      meta: { ...state, disabled },
    });
  }
  return { ...state, disabled };
}
