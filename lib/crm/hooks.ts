// ===========================================================
// lib/crm/hooks.ts — The only CRM API product code calls.
//
// Each hook turns a product moment (signup, first document, quota hit,
// checkout, billing webhook, code redemption…) into contact events, email
// triggers and a score/stage recompute. Product routes call them through
// runAfter() so the response never waits; every hook also catches its own
// errors, so a missing growth table or a bug here can never fail a request.
// Logs carry ids only.
// ===========================================================

import { db } from "@/lib/db";
import { checkDailyLimit } from "@/lib/rate-limit";
import type { AttributionSnapshot } from "@/lib/growth/attribution-server";
import type { EventType } from "@/lib/growth/constants";
import { attachReferralOnSignup, qualifyReferral } from "@/lib/growth/referrals";
import { logGrowthError } from "@/lib/growth/safe";
import {
  onChurned,
  onGrantApplied,
  onQuotaHit,
  onSignup,
  onSubscriptionStarted,
} from "@/lib/growth/triggers";
import { getOrCreateContactForUser, syncContactForUser, writeDepartureSuppressions, type UserIdentity } from "@/lib/crm/contacts";
import { recordEvent, recordUserActivity } from "@/lib/crm/events";
import { recomputeContact } from "@/lib/crm/recompute";

export type IdentifyVia = "ensure_user" | "clerk_webhook" | "backfill";
export type DocumentEventKind = "analyzed" | "humanized" | "uploaded";
export type DocumentEventProps = {
  words: number;
  plan: string;
  tone?: string | null;
  score?: number | null;
  sourceType?: string | null;
  pages?: number | null;
};
export type QuotaHitKind = "analyze_words" | "humanize_rewrites" | "humanize_words" | "upload_plan" | "upload_words";
export type BillingEventType = Extract<
  EventType,
  | "subscription_started"
  | "subscription_plan_changed"
  | "subscription_cancelled"
  | "subscription_expired"
  | "subscription_paused"
  | "subscription_resumed"
  | "payment_failed"
  | "payment_recovered"
>;
export type GrantInfo = { plan: string; planExpiresAt: Date | null; grantDays: number | null };

/** Run a step whose failure must not stop the rest of the hook (triggers owned by other streams). */
async function step(label: string, fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    logGrowthError(label, err);
  }
}

function utcDate(at: Date = new Date()): string {
  return at.toISOString().slice(0, 10);
}

// ── Identity ────────────────────────────────────────────────────────────────

/**
 * A user was created or updated (lib/user.ts, Clerk webhook). Syncs the
 * contact and attribution; for a new account also records signed_up, attaches
 * a referral and fires the signup trigger. Idempotent.
 */
export async function onUserIdentified(
  user: UserIdentity,
  opts: { isNew: boolean; attribution: AttributionSnapshot | null; via: IdentifyVia }
): Promise<void> {
  try {
    const { contactId } = await syncContactForUser(user, { attribution: opts.attribution });
    if (opts.isNew) {
      await recordEvent({
        contactId,
        type: "signed_up",
        dedupeKey: `signed_up:${user.id}`,
        occurredAt: user.createdAt,
        props: { via: opts.via },
      });
      const ref = opts.attribution?.last?.ref ?? opts.attribution?.first?.ref;
      if (ref) await step("referral-attach", () => attachReferralOnSignup(contactId, ref));
      await step("trigger-signup", () => onSignup(contactId));
    }
    await recomputeContact(contactId);
    // Marks that a request-scoped identify read the cookies (guards lib/user.ts' recent-signup hook).
    if (opts.via === "ensure_user" && opts.attribution !== null) {
      await db.contact.update({ where: { id: contactId }, data: { lastSeenAt: new Date() } });
    }
  } catch (err) {
    logGrowthError("identify", err);
  }
}

/** Has a request-scoped identify already run for this user? False on any error. */
export async function wasIdentifiedFromRequest(userId: string): Promise<boolean> {
  try {
    const contact = await db.contact.findUnique({ where: { userId }, select: { lastSeenAt: true } });
    return !!contact?.lastSeenAt;
  } catch {
    return false;
  }
}

/**
 * Before a User row is deleted (Clerk user.deleted, admin delete): keep hashed
 * suppressions so the cascade can't lead to re-contact. Awaited by callers.
 */
export async function onUserDeleted(input: { userId?: string | null; clerkId?: string | null; actor: string }): Promise<void> {
  try {
    const where = input.userId ? { id: input.userId } : input.clerkId ? { clerkId: input.clerkId } : null;
    if (!where) return;
    const user = await db.user.findUnique({ where, select: { id: true } });
    if (!user) return;
    const contact = await db.contact.findUnique({
      where: { userId: user.id },
      select: { email: true, unsubscribedAt: true, lifecycleEmails: true, emailStatus: true },
    });
    if (!contact) return;
    await writeDepartureSuppressions(contact, { source: input.actor === "clerk_webhook" ? "user_deleted:clerk" : "user_deleted:admin" });
  } catch (err) {
    logGrowthError("user-deleted", err);
  }
}

// ── Product activity ────────────────────────────────────────────────────────

export async function trackDocumentEvent(userId: string, kind: DocumentEventKind, props: DocumentEventProps): Promise<void> {
  try {
    await recordUserActivity(userId, `document_${kind}`, props);
  } catch (err) {
    logGrowthError(`document-${kind}`, err);
  }
}

/** First successful document: true only for the call that recorded it. */
export async function trackFirstDocument(userId: string): Promise<boolean> {
  try {
    // The lazy signup hook may not have run yet: make sure the contact exists first.
    const contactId = await getOrCreateContactForUser(userId);
    if (!contactId) return false;
    const now = new Date();
    const res = await db.contact.updateMany({
      where: { id: contactId, firstDocumentAt: null },
      data: { firstDocumentAt: now, lastActiveAt: now },
    });
    if (res.count !== 1) return false;
    await recordEvent({ contactId, type: "first_document", dedupeKey: `first_document:${userId}`, occurredAt: now });
    await step("referral-qualify", () => qualifyReferral(contactId));
    await recomputeContact(contactId);
    return true;
  } catch (err) {
    logGrowthError("first-document", err);
    return false;
  }
}

/** A quota wall was hit. Recorded at most once per user per day. */
export async function trackQuotaHit(userId: string, kind: QuotaHitKind, plan: string): Promise<void> {
  try {
    const limit = await checkDailyLimit(`evt:quota:${userId}`, 1);
    if (!limit.ok) return;
    const contactId = await getOrCreateContactForUser(userId);
    if (!contactId) return;
    const event = await recordEvent({ contactId, type: "quota_hit", props: { kind, plan } });
    if (!event) return;
    await step("trigger-quota", () => onQuotaHit(contactId));
    await recomputeContact(contactId);
  } catch (err) {
    logGrowthError("quota-hit", err);
  }
}

export async function trackCheckoutStarted(userId: string, plan: string, annual: boolean): Promise<void> {
  try {
    const contactId = await getOrCreateContactForUser(userId);
    if (!contactId) return;
    await recordEvent({ contactId, type: "checkout_started", props: { plan, annual } });
    await recomputeContact(contactId);
  } catch (err) {
    logGrowthError("checkout-started", err);
  }
}

// ── Billing and plans ───────────────────────────────────────────────────────

/** A LemonSqueezy webhook branch ran. `dedupeKey` makes webhook replays no-ops. */
export async function trackBillingEvent(
  userId: string,
  type: BillingEventType,
  props: Record<string, string | number | boolean | null | undefined>,
  dedupeKey: string
): Promise<void> {
  try {
    const contactId = await getOrCreateContactForUser(userId);
    if (!contactId) return;
    const event = await recordEvent({ contactId, type, props, dedupeKey });
    if (!event) return;
    if (type === "subscription_started") await step("trigger-subscribed", () => onSubscriptionStarted(contactId));
    if (type === "subscription_cancelled" || type === "subscription_expired") {
      const cycle = `${props.subscriptionId ?? "sub"}:${utcDate()}`;
      await step("trigger-churned", () => onChurned(contactId, cycle));
    }
    await recomputeContact(contactId);
  } catch (err) {
    logGrowthError(`billing-${type}`, err);
  }
}

async function recordGrant(contactId: string, userId: string, grant: GrantInfo, via: string, actor?: string): Promise<void> {
  const expiry = grant.planExpiresAt ? grant.planExpiresAt.toISOString() : "permanent";
  await recordEvent({
    contactId,
    type: "grant_applied",
    dedupeKey: `grant_applied:${userId}:${expiry}`,
    props: { plan: grant.plan, grantDays: grant.grantDays, planExpiresAt: grant.planExpiresAt, via },
    actor,
  });
  await step("trigger-grant", () => onGrantApplied(contactId, grant.planExpiresAt, grant.grantDays));
}

/** A plan grant was applied outside a code redemption (e.g. a founder purchase). */
export async function trackGrant(userId: string, grant: GrantInfo, opts: { via: string; actor?: string }): Promise<void> {
  try {
    const contactId = await getOrCreateContactForUser(userId);
    if (!contactId) return;
    await recordGrant(contactId, userId, grant, opts.via, opts.actor);
    await recomputeContact(contactId);
  } catch (err) {
    logGrowthError("grant", err);
  }
}

/** A discount code was redeemed (after the redeem transaction). */
export async function trackRedemption(userId: string, info: GrantInfo & { code: string }): Promise<void> {
  try {
    const contactId = await getOrCreateContactForUser(userId);
    if (!contactId) return;
    await recordEvent({
      contactId,
      type: "code_redeemed",
      dedupeKey: `code_redeemed:${userId}:${info.code}`,
      props: { code: info.code, plan: info.plan, grantDays: info.grantDays, planExpiresAt: info.planExpiresAt },
    });
    await recordGrant(contactId, userId, info, "code");
    await recomputeContact(contactId);
  } catch (err) {
    logGrowthError("redemption", err);
  }
}

/** A plan grant lapsed (lib/quota.ts lapsed-grant branch). `previousPlan` is captured before the downgrade. */
export async function trackGrantExpired(userId: string, previousPlan: string): Promise<void> {
  try {
    const contactId = await getOrCreateContactForUser(userId);
    if (!contactId) return;
    await recordEvent({
      contactId,
      type: "grant_expired",
      dedupeKey: `grant_expired:${userId}:${utcDate()}`,
      props: { plan: previousPlan },
    });
    await recomputeContact(contactId);
  } catch (err) {
    logGrowthError("grant-expired", err);
  }
}

/** An admin set a plan or granted days (admin users PATCH, after the update). */
export async function trackAdminPlanChange(
  userId: string,
  change: { action: "setPlan" | "grant"; plan: string; days?: number | null; actor: string }
): Promise<void> {
  try {
    const contactId = await getOrCreateContactForUser(userId);
    if (!contactId) return;
    await recordEvent({
      contactId,
      type: "plan_changed",
      props: { action: change.action, plan: change.plan, days: change.days ?? null },
      actor: change.actor,
    });
    if (change.action === "grant") {
      const user = await db.user.findUnique({ where: { id: userId }, select: { planExpiresAt: true } });
      await recordGrant(contactId, userId, { plan: change.plan, planExpiresAt: user?.planExpiresAt ?? null, grantDays: change.days ?? null }, "admin", change.actor);
    }
    await recomputeContact(contactId);
  } catch (err) {
    logGrowthError("admin-plan-change", err);
  }
}
