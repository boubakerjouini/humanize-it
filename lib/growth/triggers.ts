// ===========================================================
// lib/growth/triggers.ts — How the email engine reacts to growth events
// (spec §5.3): enroll, exit, cancel queued messages. Called from the CRM hooks
// and the consent code, always inside runAfter or a try/catch, but each
// trigger still never throws.
//
// Every enroll() is a no-op while its flow is off (no EmailFlowSetting row),
// so wiring these in changes nothing until the founder enables a flow. The
// engine (and with it the email renderer) is imported lazily: consent.ts and
// contacts.ts import this file, and they must stay light.
// ===========================================================

import { db } from "@/lib/db";
import type { Prisma } from "@/app/generated/prisma/client";
import type { SequenceKey } from "@/lib/email/catalog";
import { enroll, exitEnrollments } from "@/lib/email/enroll";
import { DEFAULT_GRANT_DAYS, SEQUENCES, getSequence, hasDeliverableStepsLeft, type EnrollmentContext } from "@/lib/email/sequences";
import type { MagnetSlug } from "@/lib/growth/constants";
import { logGrowthError } from "@/lib/growth/safe";
import { effectivePlanId } from "@/lib/quota";

export type UnsubscribeScope = "marketing" | "lifecycle" | "all";

const DAY_MS = 24 * 60 * 60 * 1000;
/** onSignup also runs on a placeholder-email repair, which can be an old account. */
const SIGNUP_MAX_AGE_MS = 2 * DAY_MS;
/** grant_expiry starts 14 days before the end; enroll anything ending within 15. */
export const GRANT_EXPIRY_WINDOW_DAYS = 15;
export const QUOTA_UPGRADE_COOLDOWN_DAYS = 30;
const PAYING_STATUSES = ["active", "on_trial", "past_due"];

/** Sequences a new subscription makes pointless. */
const SELLING_SEQUENCES: SequenceKey[] = ["quota_upgrade", "checkout_abandoned", "grant_expiry", "winback_inactive"];

async function guard(label: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    logGrowthError(`trigger-${label}`, err);
  }
}

const utcDate = (at: Date) => at.toISOString().slice(0, 10);

/** A user signed up (or a placeholder email was repaired): enroll onboarding and send the welcome now. */
export async function onSignup(contactId: string): Promise<void> {
  await guard("signup", async () => {
    const contact = await db.contact.findUnique({ where: { id: contactId }, select: { user: { select: { createdAt: true } } } });
    const createdAt = contact?.user?.createdAt;
    if (!createdAt || Date.now() - createdAt.getTime() > SIGNUP_MAX_AGE_MS) return;
    const enrollment = await enroll(contactId, "onboarding", { anchorAt: createdAt, steps: SEQUENCES.onboarding.steps });
    if (!enrollment) return;
    const { processEnrollmentNow } = await import("@/lib/email/engine");
    await processEnrollmentNow(enrollment.id);
  });
}

/** A lead became a user: exit lead nurture. */
export async function onContactConverted(contactId: string): Promise<void> {
  await guard("converted", async () => {
    await exitEnrollments(contactId, { keys: ["lead_nurture"], reason: "converted" });
  });
}

/** A lead confirmed tips by double opt-in: enroll lead nurture. */
export async function onLeadConfirmed(contactId: string, magnet?: MagnetSlug): Promise<void> {
  await guard("lead-confirmed", async () => {
    const contact = await db.contact.findUnique({ where: { id: contactId }, select: { userId: true, subscribedTopics: true, magnets: true } });
    if (!contact || contact.userId || !contact.subscribedTopics.includes("tips")) return;
    const context: EnrollmentContext = {};
    const chosen = magnet ?? (contact.magnets[0] as MagnetSlug | undefined);
    if (chosen) context.magnet = chosen;
    await enroll(contactId, "lead_nurture", { anchorAt: new Date(), steps: SEQUENCES.lead_nurture.steps, context });
  });
}

/** A waitlist signup confirmed: enroll the extension waitlist sequence. */
export async function onWaitlistConfirmed(contactId: string): Promise<void> {
  await guard("waitlist-confirmed", async () => {
    const contact = await db.contact.findUnique({ where: { id: contactId }, select: { subscribedTopics: true } });
    if (!contact?.subscribedTopics.includes("extension_launch")) return;
    await enroll(contactId, "extension_waitlist", { anchorAt: new Date(), steps: SEQUENCES.extension_waitlist.steps });
  });
}

/** A Free user hit a limit: enroll quota upgrade (once per UTC day, at most every 30 days). */
export async function onQuotaHit(contactId: string): Promise<void> {
  await guard("quota-hit", async () => {
    const contact = await db.contact.findUnique({
      where: { id: contactId },
      select: { user: { select: { plan: true, planExpiresAt: true } } },
    });
    if (!contact?.user || effectivePlanId(contact.user) !== "FREE") return;
    const now = new Date();
    await enroll(contactId, "quota_upgrade", {
      anchorAt: now,
      steps: SEQUENCES.quota_upgrade.steps,
      cycle: utcDate(now),
      cooldownDays: QUOTA_UPGRADE_COOLDOWN_DAYS,
    });
  });
}

/** A subscription started: exit the sequences that sell or nudge toward it. */
export async function onSubscriptionStarted(contactId: string): Promise<void> {
  await guard("subscribed", async () => {
    await exitEnrollments(contactId, { keys: SELLING_SEQUENCES, reason: "converted" });
  });
}

/**
 * A paid subscription was cancelled or expired. The churn win-back sequence was
 * cut (zero paying customers so far); this stays a documented no-op hook so
 * trackBillingEvent keeps a single place to wire it back in.
 */
export async function onChurned(contactId: string, cycle: string): Promise<void> {
  void contactId;
  void cycle;
}

/** Latest known grant length for a user: the newest redemption's code, else the newest grant_applied event. */
export async function grantDaysFor(contactId: string, userId: string): Promise<number> {
  const redemption = await db.redemption.findFirst({
    where: { userId },
    orderBy: { redeemedAt: "desc" },
    select: { discountCode: { select: { grantDays: true } } },
  });
  if (redemption?.discountCode.grantDays) return redemption.discountCode.grantDays;
  const event = await db.contactEvent.findFirst({
    where: { contactId, type: "grant_applied" },
    orderBy: { occurredAt: "desc" },
    select: { props: true },
  });
  const props = event?.props as Prisma.JsonObject | null | undefined;
  const days = props?.grantDays;
  return typeof days === "number" && days > 0 ? days : DEFAULT_GRANT_DAYS;
}

/**
 * Enroll grant_expiry for a grant ending at `planExpiresAt`: cycle = the
 * expiry (ISO), anchor = the expiry. Shared by onGrantApplied and the sweep.
 */
export async function enrollGrantExpiry(
  contactId: string,
  planExpiresAt: Date,
  opts: { plan: string; grantDays: number; actor?: string }
): Promise<boolean> {
  const context: EnrollmentContext = { grantDays: opts.grantDays, plan: opts.plan === "TEAM" ? "TEAM" : "PRO" };
  const enrollment = await enroll(contactId, "grant_expiry", {
    anchorAt: planExpiresAt,
    steps: SEQUENCES.grant_expiry.steps,
    cycle: planExpiresAt.toISOString(),
    context,
    actor: opts.actor,
  });
  return !!enrollment;
}

/** A plan grant was applied (code, admin grant): retire the old expiry's cycle, enroll the new one when it is close. */
export async function onGrantApplied(contactId: string, planExpiresAt: Date | null, grantDays: number | null): Promise<void> {
  await guard("grant", async () => {
    const now = new Date();
    await db.sequenceEnrollment.updateMany({
      where: {
        contactId,
        sequenceKey: "grant_expiry",
        status: { in: ["active", "paused"] },
        ...(planExpiresAt ? { anchorAt: { not: planExpiresAt } } : {}),
      },
      data: { status: "exited", exitedAt: now, exitReason: "grant_changed", nextRunAt: null },
    });
    if (!planExpiresAt || planExpiresAt.getTime() - now.getTime() > GRANT_EXPIRY_WINDOW_DAYS * DAY_MS) return;
    const contact = await db.contact.findUnique({
      where: { id: contactId },
      select: {
        user: {
          select: {
            plan: true,
            subscription: { select: { status: true } },
            purchases: { where: { kind: "founding" }, select: { id: true }, take: 1 },
          },
        },
      },
    });
    const user = contact?.user;
    if (!user || user.plan === "FREE") return;
    if (user.subscription && PAYING_STATUSES.includes(user.subscription.status)) return;
    // Founding 100 is a purchase, not a comped grant: the grant_expiry copy doesn't fit it.
    if (user.purchases.length > 0) return;
    await enrollGrantExpiry(contactId, planExpiresAt, { plan: user.plan, grantDays: grantDays ?? DEFAULT_GRANT_DAYS });
  });
}

/** Queued campaign messages whose topic the contact no longer has never go out. */
async function cancelQueuedCampaignMessages(contactId: string, keepTopics: readonly string[]): Promise<void> {
  await db.emailMessage.updateMany({
    where: { contactId, status: "queued", campaignId: { not: null }, ...(keepTopics.length ? { topic: { notIn: [...keepTopics] } } : {}) },
    data: { status: "cancelled", skipReason: "no_consent" },
  });
}

/** Consent was withdrawn: exit what can no longer send, cancel queued campaign messages. */
export async function onUnsubscribed(contactId: string, scope: UnsubscribeScope): Promise<void> {
  await guard("unsubscribed", async () => {
    const contact = await db.contact.findUnique({
      where: { id: contactId },
      select: {
        userId: true,
        lifecycleEmails: true,
        subscribedTopics: true,
        enrollments: { where: { status: { in: ["active", "paused"] } }, select: { id: true, sequenceKey: true, stepIndex: true } },
      },
    });
    if (!contact) return;
    const now = new Date();
    for (const enr of contact.enrollments) {
      const seq = getSequence(enr.sequenceKey);
      if (seq && hasDeliverableStepsLeft(seq, enr.stepIndex, contact)) continue;
      await db.sequenceEnrollment.updateMany({
        where: { id: enr.id, status: { in: ["active", "paused"] } },
        data: { status: "exited", exitedAt: now, exitReason: `unsubscribed_${scope}`, nextRunAt: null },
      });
    }
    if (scope !== "lifecycle") await cancelQueuedCampaignMessages(contactId, contact.subscribedTopics);
  });
}

/** A hard bounce or complaint: exit everything and cancel queued messages. */
export async function onEmailBounced(contactId: string): Promise<void> {
  await guard("bounced", async () => {
    await exitEnrollments(contactId, { reason: "bounced" });
    await db.emailMessage.updateMany({
      where: { contactId, status: "queued" },
      data: { status: "cancelled", skipReason: "bad_status" },
    });
  });
}
