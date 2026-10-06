// ===========================================================
// lib/growth/triggers.ts — STUB created by stream F. Owned by stream B, which
// replaces these bodies with the sequence engine's reactions (enroll, exit,
// cancel queued messages). The signatures are the contract the CRM hooks and
// consent code already call: keep them. Every trigger resolves to void and
// must never throw (callers run inside growth hooks).
// ===========================================================
/* eslint-disable @typescript-eslint/no-unused-vars -- stub bodies; stream B implements them */

import type { MagnetSlug } from "@/lib/growth/constants";

export type UnsubscribeScope = "marketing" | "lifecycle" | "all";

/** A user signed up (or a placeholder email was repaired): enroll onboarding. */
export async function onSignup(contactId: string): Promise<void> {}

/** A lead became a user: exit lead nurture. */
export async function onContactConverted(contactId: string): Promise<void> {}

/** A lead confirmed tips by double opt-in: enroll lead nurture. */
export async function onLeadConfirmed(contactId: string, magnet?: MagnetSlug): Promise<void> {}

/** A waitlist signup confirmed: enroll the extension waitlist sequence. */
export async function onWaitlistConfirmed(contactId: string): Promise<void> {}

/** A Free user hit a limit: enroll quota upgrade (with its cooldown). */
export async function onQuotaHit(contactId: string): Promise<void> {}

/** A subscription started: exit the sequences that sell or nudge toward it. */
export async function onSubscriptionStarted(contactId: string): Promise<void> {}

/** A paid subscription was cancelled or expired. The churn win-back sequence was cut; kept as a hook. */
export async function onChurned(contactId: string, cycle: string): Promise<void> {}

/** A plan grant was applied (code, admin grant): (re)enroll grant expiry for the new expiry. */
export async function onGrantApplied(contactId: string, planExpiresAt: Date | null, grantDays: number | null): Promise<void> {}

/** Consent was withdrawn: exit what can no longer send, cancel queued campaign messages. */
export async function onUnsubscribed(contactId: string, scope: UnsubscribeScope): Promise<void> {}

/** A hard bounce or complaint: exit everything and cancel queued messages. */
export async function onEmailBounced(contactId: string): Promise<void> {}
