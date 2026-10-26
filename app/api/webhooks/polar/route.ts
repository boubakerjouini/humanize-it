// ===========================================================
// POST /api/webhooks/polar — Polar webhook handler
//
// Events handled (the Polar endpoint subscribes to exactly these):
//   subscription.active      → provision the plan (new subscription, or a
//                              payment recovered after past_due)
//   subscription.updated     → sync status, product (plan switch) and period end
//   subscription.canceled    → cancelled at period end: status "cancelled", the
//                              plan stays until subscription.revoked
//   subscription.uncanceled  → the cancellation was undone
//   subscription.past_due    → a renewal payment failed; Polar retries it
//   subscription.paused      → Polar withholds access: the plan goes until
//   subscription.resumed       the subscription resumes
//   subscription.revoked     → access ends: downgrade to FREE (or back to Pro
//                              until the end of a live Founding 100 purchase)
//   order.paid               → subscription_create / subscription_cycle: reset
//                              the usage meter (new billing cycle). purchase:
//                              Founding 100 (Pro for 730 days) or a Word Pack.
//   order.refunded           → takes a refunded Founding 100 or Word Pack back
//                              (Pro time, bonus words, the seat).
//
// Every subscription event syncs the local row and the plan from the
// subscription's state: the newer of the delivery and Polar's API copy. A
// retried delivery carries the payload of its first attempt, possibly older
// than changes that went through since, while the API reads from a replica
// that can lag the change a fresh delivery reports. Polar's statuses are
// stored in the vocabulary the CRM and quota code already read (localStatus).
//
// Whose purchase it is: our checkouts open on the buyer's own Polar customer
// (external id = our user id) and also put the user id in the metadata, which
// the buyer can't edit. If the two disagree, or the user is gone, nobody is
// credited: the payment gets a "polar.needs_attention" entry on /admin/audit
// and the delivery stays unrecorded, so Polar's "redeliver" can apply it once
// the founder has sorted the account out.
//
// A delivery is recorded in WebhookEvent (keyed on webhook-id, which Polar
// keeps across retries) only after it was processed, so a replay of a handled
// delivery is skipped and a failed one runs again in full: the subscription
// row and the plan are written in one transaction, so a failed attempt leaves
// the row as it was. One-time orders are also idempotent on
// Purchase.polarOrderId (unique) and on the bonus grant's dedupe key, so even
// a concurrent retry never grants twice. A refund flips Purchase.kind to
// "<kind>_refunded" (REFUNDED_KIND), which makes it idempotent and drops the
// row from every founding and word-pack count; offers are told apart by what
// was sold, never by what is on sale now.
//
// CRM billing events come from the status change a delivery reveals (the
// local row's status before vs Polar's now), not from the event's name:
// subscription.updated and the specific event carry the same change in no
// set order, and whichever lands first records it. The dedupe key is the
// subscription version (modified_at), so the other one is a no-op. They are
// recorded after the DB write (runAfter, so the response never waits).
//
// Keep "Allow multiple subscriptions" off in Polar: a user has one
// Subscription row, and /api/checkout sends subscribers to the portal. A
// paused subscriber is sent to support (the portal can't resume unless its
// pause setting is on, and a second subscription would double-bill).
// ===========================================================

import { webhooks } from "@polar-sh/sdk/2026-10";
import { db } from "@/lib/db";
import { getPolar } from "@/lib/polar";
import {
  FOUNDING,
  foundingExpiry,
  getPlanByProductId,
  isOneTimeOffer,
  oneTimeOfferForProduct,
  wordPackTerms,
  type OneTimeOffer,
} from "@/lib/plans";
import type { Plan } from "@/app/generated/prisma/client";
import { trackBillingEvent, type BillingEventType } from "@/lib/crm/hooks";
import { recordEvent } from "@/lib/crm/events";
import { getOrCreateContactForUser } from "@/lib/crm/contacts";
import { grantBonusWords } from "@/lib/crm/bonus";
import { effectivePlanId } from "@/lib/quota";
import { isUniqueViolation, runAfter } from "@/lib/growth/safe";
import {
  FOUNDING_AUDIT_ACTION,
  FOUNDING_REFUND_AUDIT_ACTION,
  REFUNDED_KIND,
  WORDPACK_AUDIT_ACTION,
  WORDPACK_REFUND_AUDIT_ACTION,
} from "@/app/api/offers/shared";

export const runtime = "nodejs";

type PolarEvent = Awaited<ReturnType<typeof webhooks.validateEvent>>;
type PolarSubscription = Extract<PolarEvent, { type: "subscription.updated" }>["data"];
type PolarOrder = Extract<PolarEvent, { type: "order.paid" }>["data"];
/** "unmatched": a payment nobody could be credited for; the delivery stays unrecorded. */
type Result = "done" | "unmatched";

const DAY_MS = 86_400_000;
/** Local subscription statuses that still pay (past_due is being retried, not lost). */
const PAYING_STATUSES = ["active", "on_trial", "past_due"];
/** Polar statuses that keep the plan. */
const ENTITLED = new Set(["active", "trialing", "past_due"]);
/** Polar statuses of a subscription that is over for good. */
const ENDED = new Set(["canceled", "incomplete_expired", "unpaid"]);
/** Polar statuses that take the plan away: over, or paused (no access until it resumes). */
const WITHHELD = new Set([...ENDED, "paused"]);
const NEEDS_ATTENTION_AUDIT_ACTION = "polar.needs_attention";

/**
 * Polar's status in the vocabulary the rest of the app reads (PAYING_STATUSES,
 * lib/crm/lifecycle.ts): "cancelled" = cancelled at period end but still paid
 * up, "expired" = over.
 */
function localStatus(sub: Pick<PolarSubscription, "status" | "cancel_at_period_end">): string {
  switch (sub.status) {
    case "active":
      return sub.cancel_at_period_end ? "cancelled" : "active";
    case "trialing":
      return sub.cancel_at_period_end ? "cancelled" : "on_trial";
    case "canceled":
    case "incomplete_expired":
    case "unpaid":
      return "expired";
    default:
      return sub.status; // past_due, paused, incomplete
  }
}

type Owner = { userId: string } | { problem: string };

/**
 * Whose subscription or order this is. Polar can attach a purchase to an
 * existing customer found by email, keeping that customer's external id, so
 * the customer alone is not proof: it must agree with the metadata our
 * checkout set.
 */
async function ownerOf(obj: { customer: { external_id?: string | null }; metadata: Record<string, unknown> }): Promise<Owner> {
  const external = obj.customer.external_id || null;
  const fromMeta = typeof obj.metadata.user_id === "string" && obj.metadata.user_id ? obj.metadata.user_id : null;
  if (external && fromMeta && external !== fromMeta) {
    return { problem: `bought by user ${fromMeta} on the Polar customer of user ${external}` };
  }
  const userId = fromMeta ?? external;
  if (!userId) return { problem: "no user id on the customer or in the metadata" };
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
  return user ? { userId } : { problem: `user ${userId} no longer exists` };
}

/** Leaves a payment the webhook could not apply on /admin/audit, for the founder to refund or fix by hand. */
async function needsAttention(targetType: "subscription" | "order", targetId: string, summary: string, meta: Record<string, string | number | null>) {
  console.error(`[polar/webhook] ${targetType} ${targetId}: ${summary}`);
  await db.auditLog.create({
    data: { actorEmail: "polar", action: NEEDS_ATTENTION_AUDIT_ACTION, targetType, targetId, summary, meta },
  });
}

/**
 * When the Pro time of a user's live Founding 100 purchase ends, or null. Used
 * when a subscription ends: a founding member who also subscribed (Team, say)
 * goes back to Pro for the rest of what they paid once, not to Free.
 */
async function foundingEntitlementEnd(userId: string, now: Date): Promise<Date | null> {
  const latest = await db.purchase.findFirst({
    where: { userId, kind: "founding" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (!latest) return null;
  const end = new Date(latest.createdAt.getTime() + FOUNDING.grantDays * DAY_MS);
  return end.getTime() > now.getTime() ? end : null;
}

// ---------------------------------------------------------------------------
// Subscriptions
// ---------------------------------------------------------------------------

type Track = (userId: string, type: BillingEventType, props: Record<string, string | null>, dedupeKey: string) => void;

/**
 * Local statuses under which a subscription gives the plan. Not incomplete
 * (it never did) and not paused (the plan was already taken away when the
 * pause was stored, so a later delivery must not take away a grant made since).
 */
const PROVIDED = new Set(["active", "on_trial", "past_due", "cancelled"]);

/** The CRM event for a local status change, if it is one we record. */
function transition(before: string | null, after: string): BillingEventType | null {
  if (before === after) return null;
  if (before === null || before === "incomplete") {
    // "cancelled" is still paid up: first seen already set to cancel at period end.
    return PAYING_STATUSES.includes(after) || after === "cancelled" ? "subscription_started" : null;
  }
  if (after === "active" && before === "past_due") return "payment_recovered";
  if (after === "active" && (before === "cancelled" || before === "paused")) return "subscription_resumed";
  if (after === "past_due") return "payment_failed";
  if (after === "cancelled") return "subscription_cancelled";
  if (after === "paused") return "subscription_paused";
  if (after === "expired") return "subscription_expired";
  return null;
}

/** When Polar last wrote this copy of the subscription. */
function versionOf(sub: Pick<PolarSubscription, "modified_at" | "created_at">): number {
  return Date.parse(sub.modified_at ?? sub.created_at);
}

/**
 * The newest known state of the subscription: Polar's API copy, unless the
 * delivery is newer (the API reads from a replica that can lag the change
 * this delivery reports). The delivery's copy when the API can't be reached.
 */
async function currentState(sub: PolarSubscription): Promise<PolarSubscription> {
  const polar = getPolar();
  if (!polar) return sub;
  try {
    const live = await polar.subscriptions.get(sub.id);
    return versionOf(live) < versionOf(sub) ? sub : live;
  } catch (err) {
    console.warn(`[polar/webhook] could not read subscription ${sub.id} from Polar; using the delivery's copy:`, err);
    return sub;
  }
}

/** The plan once a subscription stops giving it: an org seat's Team, Pro until a live Founding 100 purchase ends, or Free. */
async function planWithout(userId: string, seated: boolean): Promise<{ plan: Plan; planExpiresAt: Date | null }> {
  if (seated) return { plan: "TEAM", planExpiresAt: null };
  const foundingEnd = await foundingEntitlementEnd(userId, new Date());
  return foundingEnd ? { plan: "PRO", planExpiresAt: foundingEnd } : { plan: "FREE", planExpiresAt: null };
}

async function syncSubscription(eventType: PolarEvent["type"], delivered: PolarSubscription, track: Track, eventId: string): Promise<Result> {
  const sub = await currentState(delivered);
  const known = await db.subscription.findUnique({ where: { polarSubscriptionId: sub.id } });
  let userId = known?.userId ?? null;
  if (!userId) {
    const owner = await ownerOf(sub);
    if ("problem" in owner) {
      if (!ENTITLED.has(sub.status)) {
        // Nobody pays for it (a deleted account's subscription ending, say).
        console.warn(`[polar/webhook] ${eventType}: subscription ${sub.id} (${sub.status}): ${owner.problem}`);
        return "done";
      }
      await needsAttention("subscription", sub.id, `${sub.status} subscription not credited: ${owner.problem}`, {
        eventType,
        customerId: sub.customer_id,
        productId: sub.product_id,
      });
      return "unmatched";
    }
    userId = owner.userId;
  }

  const previous = known ?? (await db.subscription.findUnique({ where: { userId } }));
  if (previous && previous.polarSubscriptionId && previous.polarSubscriptionId !== sub.id && !ENTITLED.has(sub.status)) {
    // A late event about an older subscription must not touch the current one.
    console.warn(`[polar/webhook] ${eventType}: ignoring ended subscription ${sub.id}; user has ${previous.polarSubscriptionId}`);
    return "done";
  }
  if (previous?.polarSubscriptionId === sub.id && previous.status === "expired" && ENTITLED.has(sub.status)) {
    // An ended Polar subscription never comes back: this is an older delivery arriving late.
    console.warn(`[polar/webhook] ${eventType}: subscription ${sub.id} already ended; ignoring a stale ${sub.status} state`);
    return "done";
  }

  const status = localStatus(sub);
  /** This subscription's local status before this delivery; null = first seen. */
  const before = previous?.polarSubscriptionId === sub.id ? previous.status : null;
  const plan = getPlanByProductId(sub.product_id);
  // Only a subscription that gave the plan takes it away: an abandoned
  // checkout (incomplete → incomplete_expired) leaves a comped plan alone.
  const gavePlan = before !== null && PROVIDED.has(before);
  const switchedToUnknown = ENTITLED.has(sub.status) && !plan && !!previous?.polarProductId && !!getPlanByProductId(previous.polarProductId);
  // A seat in an organization gives Team whatever the personal subscription does.
  const seated = !!(await db.membership.findFirst({ where: { userId, seatActive: true }, select: { id: true } }));

  let data: { plan: Plan; planExpiresAt: Date | null } | null = null;
  if (ENTITLED.has(sub.status) && plan) {
    // A paid subscription has no end date: clear any grant expiry left by a
    // redeem code, or checkAndResetQuota would downgrade a paying user. A
    // founding member's paid-once time is not lost: it comes back from the
    // Purchase row when the subscription ends (foundingEntitlementEnd).
    data = { plan: seated ? "TEAM" : (plan.id as Plan), planExpiresAt: null };
  } else if (gavePlan && (WITHHELD.has(sub.status) || switchedToUnknown)) {
    data = await planWithout(userId, seated);
  }

  const fields = {
    polarCustomerId: sub.customer_id,
    polarSubscriptionId: sub.id,
    polarProductId: sub.product_id,
    currentPeriodEnd: new Date(sub.current_period_end),
    status,
  };
  // One transaction: a failed attempt leaves the row as it was, so Polar's
  // retry sees the same "before" and applies the plan change again.
  await db.$transaction(async (tx) => {
    await tx.subscription.upsert({ where: { userId }, create: { userId, ...fields }, update: fields });
    if (data) await tx.user.update({ where: { id: userId }, data });
  });
  if (data && !ENTITLED.has(sub.status)) {
    console.log(`[polar/webhook] Moved userId=${userId} to ${data.plan}${data.planExpiresAt ? ` until ${data.planExpiresAt.toISOString()}` : ""}`);
  }

  if (ENTITLED.has(sub.status) && !plan) {
    // Not a product we sell as a plan (one made in Polar's dashboard, say): grant nothing.
    await needsAttention("subscription", sub.id, `product ${sub.product_id} matches no plan; ${data ? "plan withdrawn" : "nothing granted"}`, {
      eventType,
      userId,
      productId: sub.product_id,
    });
  }

  const props = { plan: plan?.id ?? null, productId: sub.product_id, subscriptionId: sub.id, status };
  // One key per subscription version: the twin delivery of the same change is a no-op.
  const version = sub.modified_at ?? eventId;
  const type = transition(before, status);
  if (type) {
    // A subscription starts once, whichever delivery shows it first.
    track(userId, type, props, type === "subscription_started" ? `polar:${sub.id}:started` : `polar:${sub.id}:${type}:${version}`);
  }
  if (type === "subscription_started" && status === "cancelled") {
    // First seen already cancelled at period end: record both steps.
    track(userId, "subscription_cancelled", props, `polar:${sub.id}:subscription_cancelled:${version}`);
  }
  if (before !== null && previous?.polarProductId && previous.polarProductId !== sub.product_id) {
    // A product switch (plan or monthly/annual); plain renewals keep the product.
    track(userId, "subscription_plan_changed", { ...props, previousProductId: previous.polarProductId }, `polar:${sub.id}:plan:${version}`);
  }
  console.log(`[polar/webhook] ${eventType}: userId=${userId} subscription=${sub.id} → ${status}`);
  return "done";
}

/** A paid first or renewal invoice starts a new billing cycle: reset the usage meter. */
async function resetCycle(order: PolarOrder): Promise<Result> {
  const known = order.subscription_id
    ? await db.subscription.findUnique({ where: { polarSubscriptionId: order.subscription_id }, select: { userId: true } })
    : null;
  let userId = known?.userId ?? null;
  if (!userId) {
    const owner = await ownerOf(order);
    if ("problem" in owner) {
      if (order.total_amount <= 0) {
        console.warn(`[polar/webhook] order ${order.id} (${order.billing_reason}): ${owner.problem}`);
        return "done";
      }
      await needsAttention("order", order.id, `${order.billing_reason} payment not credited: ${owner.problem}`, {
        subscriptionId: order.subscription_id ?? null,
        amountCents: order.total_amount,
      });
      return "unmatched";
    }
    userId = owner.userId;
  }
  const res = await db.user.updateMany({ where: { id: userId }, data: { wordsUsed: 0, rewriteCount: 0, quotaResetAt: new Date() } });
  if (res.count) console.log(`[polar/webhook] Quota reset for userId=${userId} (${order.billing_reason})`);
  return "done";
}

// ---------------------------------------------------------------------------
// One-time offers
// ---------------------------------------------------------------------------

/** The offer an order sold: its product, or the offer our checkout put in the metadata (the product may be off sale since). */
function offerOfOrder(order: PolarOrder): OneTimeOffer | null {
  const offer = oneTimeOfferForProduct(order.product_id ?? "");
  if (offer) return offer;
  return isOneTimeOffer(order.metadata.offer) ? order.metadata.offer : null;
}

/**
 * Founding 100: Pro until foundingExpiry(), in one transaction with the
 * Purchase row (its unique order id is the idempotency key) and the AuditLog
 * entry that keeps the public counter from ever going back down.
 * Returns the new expiry (null = no end date), or null when this order was
 * already fulfilled.
 */
async function fulfilFounding(
  userId: string,
  orderId: string,
  productId: string,
  amountCents: number | null
): Promise<{ planExpiresAt: Date | null } | null> {
  try {
    return await db.$transaction(async (tx) => {
      await tx.purchase.create({ data: { userId, kind: "founding", polarOrderId: orderId, polarProductId: productId, amountCents } });
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { plan: true, planExpiresAt: true } });
      const now = new Date();
      // A plan with no end date (a Pro or Team subscription, or a lifetime
      // grant) must never turn into two years of Pro: a subscription hands the
      // founding time back when it ends (foundingEntitlementEnd).
      // /api/offers/checkout refuses these accounts; this covers a race.
      const openEnded = user.plan !== "FREE" && user.planExpiresAt === null;
      const planExpiresAt = openEnded ? null : foundingExpiry(user, now);
      // Coming from Free, start a fresh monthly meter instead of carrying the daily one.
      const fromFree = effectivePlanId(user) === "FREE";
      await tx.user.update({
        where: { id: userId },
        data: { plan: openEnded ? user.plan : "PRO", planExpiresAt, ...(fromFree ? { wordsUsed: 0, rewriteCount: 0, quotaResetAt: now } : {}) },
      });
      await tx.auditLog.create({
        data: {
          actorEmail: "polar",
          action: FOUNDING_AUDIT_ACTION,
          targetType: "user",
          targetId: userId,
          summary: `Founding 100 order ${orderId}: ${planExpiresAt ? `Pro until ${planExpiresAt.toISOString().slice(0, 10)}` : `already ${user.plan} with no end date`}`,
          meta: { orderId, productId, amountCents },
        },
      });
      const sold = await tx.purchase.count({ where: { kind: "founding" } });
      if (sold > FOUNDING.seats) {
        // Two checkouts raced past the cap. The buyer paid, so honor it and leave a trace.
        console.warn(`[polar/webhook] Founding 100 oversold: ${sold} of ${FOUNDING.seats} (order ${orderId})`);
      }
      return { planExpiresAt };
    });
  } catch (err) {
    if (isUniqueViolation(err)) return null;
    throw err;
  }
}

/**
 * Founding 100 refund: the 730 days come off the plan expiry (what is left of
 * an earlier grant stays), the seat goes back on sale, and the badge, the Voice
 * Match profiles and ALREADY_MEMBER go with the Purchase row. A paying
 * subscription or a lifetime grant (no expiry) keeps its plan. Returns false
 * when there is nothing (left) to refund.
 */
async function refundFounding(orderId: string): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const purchase = await tx.purchase.findUnique({ where: { polarOrderId: orderId }, select: { userId: true } });
    const flipped = await tx.purchase.updateMany({ where: { polarOrderId: orderId, kind: "founding" }, data: { kind: REFUNDED_KIND.founding } });
    if (!purchase || flipped.count === 0) return false;

    const user = await tx.user.findUniqueOrThrow({
      where: { id: purchase.userId },
      select: { plan: true, planExpiresAt: true, subscription: { select: { status: true } } },
    });
    const now = new Date();
    const paying = !!user.subscription && PAYING_STATUSES.includes(user.subscription.status);
    let outcome = "plan unchanged";
    if (!paying && user.plan === "PRO" && user.planExpiresAt) {
      const rest = user.planExpiresAt.getTime() - FOUNDING.grantDays * DAY_MS;
      if (rest > now.getTime()) {
        await tx.user.update({ where: { id: purchase.userId }, data: { planExpiresAt: new Date(rest) } });
        outcome = `Pro until ${new Date(rest).toISOString().slice(0, 10)} (earlier grant)`;
      } else {
        await tx.user.update({ where: { id: purchase.userId }, data: { plan: "FREE", planExpiresAt: null } });
        outcome = "back to Free";
      }
    }
    await tx.auditLog.create({
      data: {
        actorEmail: "polar",
        action: FOUNDING_REFUND_AUDIT_ACTION,
        targetType: "user",
        targetId: purchase.userId,
        summary: `Founding 100 order ${orderId} refunded: ${outcome}`,
        meta: { orderId },
      },
    });
    return true;
  });
}

/**
 * Word Pack refund: takes back up to the pack's words from the bonus pool
 * (words already used stay used). Returns false when already refunded.
 */
async function refundWordPack(orderId: string): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const purchase = await tx.purchase.findUnique({ where: { polarOrderId: orderId }, select: { userId: true, words: true } });
    const flipped = await tx.purchase.updateMany({ where: { polarOrderId: orderId, kind: "wordpack" }, data: { kind: REFUNDED_KIND.wordpack } });
    if (!purchase || flipped.count === 0) return false;

    const words = purchase.words ?? wordPackTerms().words;
    let taken = 0;
    const contact = await tx.contact.findUnique({ where: { userId: purchase.userId }, select: { id: true, bonusWords: true } });
    if (contact && words > 0) {
      taken = Math.min(words, Math.max(0, contact.bonusWords));
      // Conditional on the balance read above, so a concurrent draw is never undone.
      const res = await tx.contact.updateMany({
        where: { id: contact.id, bonusWords: contact.bonusWords },
        data: { bonusWords: contact.bonusWords - taken },
      });
      // Rolls the whole refund back; Polar retries the delivery.
      if (res.count === 0) throw new Error(`bonus balance changed during the refund of order ${orderId}`);
    }
    await tx.auditLog.create({
      data: {
        actorEmail: "polar",
        action: WORDPACK_REFUND_AUDIT_ACTION,
        targetType: "user",
        targetId: purchase.userId,
        summary: `Word Pack order ${orderId} refunded: ${taken} of ${words} bonus words taken back`,
        meta: { orderId, words, taken },
      },
    });
    return true;
  });
}

/**
 * Word Pack: bonus words with an expiry. The grant is idempotent on its dedupe
 * key and runs first, so a crash before the Purchase row is written is
 * repaired by Polar's retry. Returns false when already fulfilled.
 */
async function fulfilWordPack(userId: string, orderId: string, productId: string, amountCents: number | null): Promise<boolean> {
  const pack = wordPackTerms();
  const contactId = await getOrCreateContactForUser(userId);
  if (!contactId) throw new Error(`no contact for user ${userId}`);

  const dedupeKey = `wordpack:${orderId}`;
  const granted = await grantBonusWords(contactId, pack.words, "wordpack", dedupeKey, {
    expiresAt: new Date(Date.now() + pack.days * DAY_MS),
    actor: "polar",
    props: { orderId },
  });
  // grantBonusWords returns false for a duplicate AND for an error. Only a
  // duplicate left its event behind; anything else fails the delivery so
  // Polar retries it.
  if (!granted && !(await db.contactEvent.findUnique({ where: { dedupeKey }, select: { id: true } }))) {
    throw new Error(`word pack grant failed for order ${orderId}`);
  }

  try {
    await db.purchase.create({
      data: { userId, kind: "wordpack", polarOrderId: orderId, polarProductId: productId, amountCents, words: pack.words },
    });
  } catch (err) {
    if (isUniqueViolation(err)) return false;
    throw err;
  }
  await db.auditLog
    .create({
      data: {
        actorEmail: "polar",
        action: WORDPACK_AUDIT_ACTION,
        targetType: "user",
        targetId: userId,
        summary: `Word Pack order ${orderId}: +${pack.words} words for ${pack.days} days`,
        meta: { orderId, productId, amountCents, words: pack.words },
      },
    })
    .catch(() => {});
  return true;
}

async function handleOrderPaid(order: PolarOrder): Promise<Result> {
  if (order.billing_reason === "subscription_create" || order.billing_reason === "subscription_cycle") {
    return resetCycle(order);
  }
  if (order.billing_reason !== "purchase") return "done"; // subscription_update: a proration, nothing to grant

  const productId = order.product_id ?? "";
  const offer = offerOfOrder(order);
  if (!offer) {
    await needsAttention("order", order.id, `paid one-time product ${productId} is no offer; nothing granted`, {
      productId,
      amountCents: order.total_amount,
    });
    return "done";
  }
  const owner = await ownerOf(order);
  if ("problem" in owner) {
    await needsAttention("order", order.id, `${offer} not credited: ${owner.problem}`, { productId, amountCents: order.total_amount });
    return "unmatched";
  }
  const userId = owner.userId;
  // Already fulfilled, or refunded before this payment was applied.
  if (await db.purchase.findUnique({ where: { polarOrderId: order.id }, select: { id: true } })) return "done";
  // Before tax: Polar collects and remits the tax as merchant of record.
  const amountCents = order.net_amount;

  if (offer === "founding") {
    const fulfilled = await fulfilFounding(userId, order.id, productId, amountCents);
    if (fulfilled) {
      const until = fulfilled.planExpiresAt?.toISOString() ?? null;
      runAfter("founding-purchased", () =>
        recordEvent({
          userId,
          type: "founding_purchased",
          props: { orderId: order.id, amountCents, planExpiresAt: until },
          dedupeKey: `founding_purchased:${order.id}`,
        })
      );
      console.log(`[polar/webhook] Founding 100 granted to userId=${userId} until ${until ?? "no end date"}`);
    }
  } else if (await fulfilWordPack(userId, order.id, productId, amountCents)) {
    runAfter("wordpack-purchased", () =>
      recordEvent({
        userId,
        type: "wordpack_purchased",
        props: { orderId: order.id, amountCents, words: wordPackTerms().words },
        dedupeKey: `wordpack_purchased:${order.id}`,
      })
    );
    console.log(`[polar/webhook] Word Pack credited to userId=${userId}`);
  }
  return "done";
}

/** One-time refunds, told apart by what was sold. A partial refund is left to the founder. */
async function handleOrderRefunded(order: PolarOrder): Promise<Result> {
  const sold = await db.purchase.findUnique({ where: { polarOrderId: order.id }, select: { kind: true } });
  if (sold && !isOneTimeOffer(sold.kind)) {
    console.log(`[polar/webhook] order ${order.id}: refund already applied (${sold.kind})`);
    return "done";
  }
  const offer = sold ? (sold.kind as OneTimeOffer) : offerOfOrder(order);
  if (!offer) return "done"; // a subscription payment: its own events handle the plan
  if (order.status !== "refunded") {
    console.warn(`[polar/webhook] order ${order.id} (${offer}) is ${order.status}; a partial refund is handled by hand`);
    return "done";
  }
  if (!sold) {
    // Refunded before its payment was ever applied (that delivery failed and
    // is being retried): mark the order refunded, so the retry grants nothing.
    const owner = await ownerOf(order);
    if ("problem" in owner) {
      console.warn(`[polar/webhook] order ${order.id} (${offer}) refunded before it was applied: ${owner.problem}`);
      return "done";
    }
    try {
      await db.purchase.create({
        data: { userId: owner.userId, kind: REFUNDED_KIND[offer], polarOrderId: order.id, polarProductId: order.product_id ?? null, amountCents: order.net_amount },
      });
    } catch (err) {
      // The payment landed in between: refund it the normal way on Polar's retry.
      if (isUniqueViolation(err)) throw new Error(`order ${order.id} was fulfilled during its refund; retrying`);
      throw err;
    }
    console.log(`[polar/webhook] ${offer} order ${order.id} refunded before it was applied; marked so it never is`);
    return "done";
  }
  const done = offer === "founding" ? await refundFounding(order.id) : await refundWordPack(order.id);
  console.log(`[polar/webhook] ${offer} order ${order.id} refund ${done ? "applied" : "already applied"}`);
  return "done";
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
export async function POST(req: Request) {
  const secret = process.env.POLAR_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[polar/webhook] POLAR_WEBHOOK_SECRET is not set");
    return new Response("Not configured", { status: 500 });
  }

  const body = await req.text();
  const webhookId = req.headers.get("webhook-id") ?? "";
  let event: PolarEvent;
  try {
    event = await webhooks.validateEvent(
      body,
      {
        "webhook-id": webhookId,
        "webhook-timestamp": req.headers.get("webhook-timestamp") ?? "",
        "webhook-signature": req.headers.get("webhook-signature") ?? "",
      },
      secret
    );
  } catch (err) {
    if (err instanceof webhooks.PolarWebhookVerificationError) {
      console.warn("[polar/webhook] Invalid signature");
      return new Response("Invalid signature", { status: 403 });
    }
    if (err instanceof webhooks.PolarWebhookUnknownTypeError) {
      // Signed but not an event this API version knows: acknowledge, never retry.
      return new Response("Ignored", { status: 202 });
    }
    console.warn("[polar/webhook] Invalid payload:", err);
    return new Response("Invalid payload", { status: 400 });
  }

  const eventId = `polar:${webhookId}`;
  if (await db.webhookEvent.findUnique({ where: { eventId }, select: { id: true } })) {
    return new Response("OK (duplicate)", { status: 200 });
  }

  /** Record the branch's billing event once its DB write succeeded. Never throws. */
  const track: Track = (userId, type, props, dedupeKey) => {
    runAfter(`billing-${type}`, () => trackBillingEvent(userId, type, props, dedupeKey));
  };

  console.log(`[polar/webhook] Event: ${event.type} | ${event.data.id}`);

  let result: Result = "done";
  try {
    switch (event.type) {
      case "subscription.active":
      case "subscription.updated":
      case "subscription.canceled":
      case "subscription.uncanceled":
      case "subscription.past_due":
      case "subscription.paused":
      case "subscription.resumed":
      case "subscription.revoked":
        result = await syncSubscription(event.type, event.data, track, eventId);
        break;
      case "order.paid":
        result = await handleOrderPaid(event.data);
        break;
      case "order.refunded":
        result = await handleOrderRefunded(event.data);
        break;
      default:
        console.log(`[polar/webhook] Unhandled event: ${event.type}`);
    }
  } catch (err) {
    console.error(`[polar/webhook] Error handling ${event.type}:`, err);
    return new Response("Internal error", { status: 500 });
  }

  if (result === "unmatched") {
    // Never a 5xx (retries can't fix it, and repeated failures disable the
    // endpoint). Left unrecorded so a redelivery can apply it after a fix.
    return new Response("OK (not credited)", { status: 200 });
  }
  await db.webhookEvent.create({ data: { eventId, source: "polar" } }).catch((err) => {
    if (!isUniqueViolation(err)) console.error("[polar/webhook] could not record the delivery:", err);
  });
  return new Response("OK", { status: 200 });
}
