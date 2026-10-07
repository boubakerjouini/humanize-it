// ===========================================================
// POST /api/webhooks/lemonsqueezy — Lemon Squeezy webhook handler
//
// Events handled:
//   subscription_created         → provision plan after first payment
//   subscription_updated         → plan change / renewal sync
//   subscription_cancelled       → downgrade to FREE
//   subscription_payment_success → reset usage quota (new billing cycle)
//   subscription_payment_failed  → mark status past_due
//   order_created (one-time)     → Founding 100 (Pro for 730 days) or a Word
//                                  Pack (bonus words). Any other order is the
//                                  first payment of a subscription, which
//                                  subscription_created provisions.
//
// One-time orders are idempotent on Purchase.lsOrderId (unique) and on the
// bonus grant's dedupe key, so a LemonSqueezy retry never grants twice.
//
// Each branch also records a CRM billing event after its DB write (runAfter,
// so the response never waits). The dedupe key includes updated_at, so a
// LemonSqueezy retry of the same delivery is a no-op while a later real
// change to the same subscription is still recorded.
// ===========================================================

import crypto from "crypto";
import { db } from "@/lib/db";
import { FOUNDING, foundingExpiry, getPlanByVariantId, oneTimeOfferForVariant, wordPackConfig } from "@/lib/plans";
import type { Plan } from "@/app/generated/prisma/client";
import { trackBillingEvent, type BillingEventType } from "@/lib/crm/hooks";
import { recordEvent } from "@/lib/crm/events";
import { getOrCreateContactForUser } from "@/lib/crm/contacts";
import { grantBonusWords } from "@/lib/crm/bonus";
import { effectivePlanId } from "@/lib/quota";
import { isUniqueViolation, runAfter } from "@/lib/growth/safe";
import { FOUNDING_AUDIT_ACTION, WORDPACK_AUDIT_ACTION } from "@/app/api/offers/shared";

// ---------------------------------------------------------------------------
// Types — Lemon Squeezy webhook payload
// ---------------------------------------------------------------------------
interface LsSubscriptionAttributes {
  customer_id: number;
  variant_id: number;
  status: string;
  renews_at: string | null;
  ends_at: string | null;
  updated_at?: string | null;
  urls: {
    update_payment_method: string;
    customer_portal: string;
  };
}

interface LsWebhookPayload {
  meta: {
    event_name: string;
    custom_data?: {
      clerk_id?: string;
      plan_id?: string;
      annual?: string;
      offer?: string;
    };
  };
  data: {
    id: string;
    type: string;
    attributes: LsSubscriptionAttributes;
  };
}

/** The parts of an Order object (data.type "orders") the one-time branch reads. */
interface LsOrderAttributes {
  status: string;
  total?: number;
  first_order_item?: { variant_id?: number | string } | null;
}

const DAY_MS = 86_400_000;

// ---------------------------------------------------------------------------
// One-time offers
// ---------------------------------------------------------------------------

/**
 * Founding 100: Pro until foundingExpiry(), in one transaction with the
 * Purchase row (its unique order id is the idempotency key) and the AuditLog
 * entry that keeps the public counter from ever going back down.
 * Returns the new expiry, or null when this order was already fulfilled.
 */
async function fulfilFounding(userId: string, orderId: string, variantId: string, amountCents: number | null): Promise<Date | null> {
  try {
    return await db.$transaction(async (tx) => {
      await tx.purchase.create({ data: { userId, kind: "founding", lsOrderId: orderId, lsVariantId: variantId, amountCents } });
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { plan: true, planExpiresAt: true } });
      const now = new Date();
      const planExpiresAt = foundingExpiry(user, now);
      // Coming from Free, start a fresh monthly meter instead of carrying the daily one.
      const fromFree = effectivePlanId(user) === "FREE";
      await tx.user.update({
        where: { id: userId },
        data: { plan: "PRO", planExpiresAt, ...(fromFree ? { wordsUsed: 0, rewriteCount: 0, quotaResetAt: now } : {}) },
      });
      await tx.auditLog.create({
        data: {
          actorEmail: "lemonsqueezy",
          action: FOUNDING_AUDIT_ACTION,
          targetType: "user",
          targetId: userId,
          summary: `Founding 100 order ${orderId}: Pro until ${planExpiresAt.toISOString().slice(0, 10)}`,
          meta: { orderId, variantId, amountCents },
        },
      });
      const sold = await tx.purchase.count({ where: { kind: "founding" } });
      if (sold > FOUNDING.seats) {
        // Two checkouts raced past the cap. The buyer paid, so honor it and leave a trace.
        console.warn(`[ls/webhook] Founding 100 oversold: ${sold} of ${FOUNDING.seats} (order ${orderId})`);
      }
      return planExpiresAt;
    });
  } catch (err) {
    if (isUniqueViolation(err)) return null;
    throw err;
  }
}

/**
 * Word Pack: bonus words with an expiry. The grant is idempotent on its dedupe
 * key and runs first, so a crash before the Purchase row is written is
 * repaired by LemonSqueezy's retry. Returns false when already fulfilled.
 */
async function fulfilWordPack(userId: string, orderId: string, variantId: string, amountCents: number | null): Promise<boolean> {
  const pack = wordPackConfig();
  if (!pack) throw new Error("word pack variant matched but its config is gone");
  const contactId = await getOrCreateContactForUser(userId);
  if (!contactId) throw new Error(`no contact for user ${userId}`);

  const dedupeKey = `wordpack:${orderId}`;
  const granted = await grantBonusWords(contactId, pack.words, "wordpack", dedupeKey, {
    expiresAt: new Date(Date.now() + pack.days * DAY_MS),
    actor: "lemonsqueezy",
    props: { orderId },
  });
  // grantBonusWords returns false for a duplicate AND for an error. Only a
  // duplicate left its event behind; anything else fails the delivery so
  // LemonSqueezy retries it.
  if (!granted && !(await db.contactEvent.findUnique({ where: { dedupeKey }, select: { id: true } }))) {
    throw new Error(`word pack grant failed for order ${orderId}`);
  }

  try {
    await db.purchase.create({
      data: { userId, kind: "wordpack", lsOrderId: orderId, lsVariantId: variantId, amountCents, words: pack.words },
    });
  } catch (err) {
    if (isUniqueViolation(err)) return false;
    throw err;
  }
  await db.auditLog
    .create({
      data: {
        actorEmail: "lemonsqueezy",
        action: WORDPACK_AUDIT_ACTION,
        targetType: "user",
        targetId: userId,
        summary: `Word Pack order ${orderId}: +${pack.words} words for ${pack.days} days`,
        meta: { orderId, variantId, amountCents, words: pack.words },
      },
    })
    .catch(() => {});
  return true;
}

// ---------------------------------------------------------------------------
// Verify HMAC-SHA256 signature from Lemon Squeezy
// ---------------------------------------------------------------------------
function verifySignature(body: string, signature: string | null): boolean {
  if (!signature) return false;
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[ls/webhook] LEMONSQUEEZY_WEBHOOK_SECRET is not set");
    return false;
  }
  const hmac = crypto.createHmac("sha256", secret).update(body).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(signature));
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("x-signature");

  if (!verifySignature(body, signature)) {
    console.warn("[ls/webhook] Invalid signature");
    return new Response("Invalid signature", { status: 400 });
  }

  let payload: LsWebhookPayload;
  try {
    payload = JSON.parse(body) as LsWebhookPayload;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const { event_name, custom_data } = payload.meta;
  const { id: lsSubscriptionId, attributes } = payload.data;
  const lsCustomerId = String(attributes.customer_id);
  const lsVariantId = String(attributes.variant_id);
  const dedupeKey = `ls:${event_name}:${lsSubscriptionId}:${attributes.updated_at ?? ""}`;

  /** Record the branch's billing event once its DB write succeeded. Never throws. */
  const track = (userId: string, type: BillingEventType, plan: string | null, extra: Record<string, string> = {}) => {
    runAfter(`billing-${type}`, () =>
      trackBillingEvent(
        userId,
        type,
        { plan, variantId: lsVariantId, subscriptionId: lsSubscriptionId, status: attributes.status, ...extra },
        dedupeKey
      )
    );
  };

  console.log(`[ls/webhook] Event: ${event_name} | subscription: ${lsSubscriptionId}`);

  try {
    switch (event_name) {
      // -----------------------------------------------------------------------
      // First subscription created after checkout
      // -----------------------------------------------------------------------
      case "subscription_created": {
        const clerkId = custom_data?.clerk_id;
        if (!clerkId) {
          console.error("[ls/webhook] subscription_created: no clerk_id in custom_data");
          break;
        }

        const plan = getPlanByVariantId(lsVariantId);

        // A paid subscription has no end date: clear any grant expiry left by
        // a redeem code, or checkAndResetQuota would downgrade a paying user.
        const user = await db.user.update({
          where: { clerkId },
          data: { plan: (plan?.id ?? "PRO") as Plan, planExpiresAt: null },
        });

        await db.subscription.upsert({
          where: { userId: user.id },
          create: {
            userId: user.id,
            lsCustomerId,
            lsSubscriptionId,
            lsVariantId,
            lsCurrentPeriodEnd: attributes.renews_at ? new Date(attributes.renews_at) : null,
            status: attributes.status,
          },
          update: {
            lsCustomerId,
            lsSubscriptionId,
            lsVariantId,
            lsCurrentPeriodEnd: attributes.renews_at ? new Date(attributes.renews_at) : null,
            status: attributes.status,
          },
        });

        track(user.id, "subscription_started", plan?.id ?? "PRO");
        console.log(`[ls/webhook] Provisioned ${plan?.id ?? "PRO"} for clerkId=${clerkId}`);
        break;
      }

      // -----------------------------------------------------------------------
      // Subscription updated (plan change, renewal, resume, etc.)
      // -----------------------------------------------------------------------
      case "subscription_updated":
      case "subscription_resumed":
      case "subscription_unpaused": {
        const sub = await db.subscription.findUnique({
          where: { lsSubscriptionId },
        });

        if (!sub) {
          console.warn(`[ls/webhook] ${event_name}: no local record for ${lsSubscriptionId}`);
          break;
        }

        const plan = getPlanByVariantId(lsVariantId);

        await db.subscription.update({
          where: { lsSubscriptionId },
          data: {
            lsVariantId,
            lsCurrentPeriodEnd: attributes.renews_at ? new Date(attributes.renews_at) : null,
            status: attributes.status,
          },
        });

        if (plan) {
          await db.user.update({
            where: { id: sub.userId },
            data: { plan: plan.id as Plan },
          });
          console.log(`[ls/webhook] Updated plan → ${plan.id} for userId=${sub.userId}`);
        }

        if (event_name !== "subscription_updated") {
          track(sub.userId, "subscription_resumed", plan?.id ?? null);
        } else if (sub.lsVariantId !== lsVariantId) {
          // A variant switch (plan or monthly/annual); plain renewals keep the variant.
          track(sub.userId, "subscription_plan_changed", plan?.id ?? null, { previousVariantId: sub.lsVariantId ?? "" });
        }

        break;
      }

      // -----------------------------------------------------------------------
      // Subscription cancelled / expired / paused → downgrade to FREE
      // -----------------------------------------------------------------------
      case "subscription_cancelled":
      case "subscription_expired":
      case "subscription_paused": {
        const sub = await db.subscription.findUnique({
          where: { lsSubscriptionId },
        });

        if (!sub) {
          console.warn(`[ls/webhook] ${event_name}: no local record for ${lsSubscriptionId}`);
          break;
        }

        await db.subscription.update({
          where: { lsSubscriptionId },
          data: { status: attributes.status },
        });

        // Only downgrade immediately on hard cancel/expire, not pause
        if (event_name !== "subscription_paused") {
          await db.user.update({
            where: { id: sub.userId },
            data: { plan: "FREE" },
          });
          console.log(`[ls/webhook] Downgraded userId=${sub.userId} to FREE (${event_name})`);
        }

        const plan = getPlanByVariantId(lsVariantId);
        track(
          sub.userId,
          event_name === "subscription_cancelled"
            ? "subscription_cancelled"
            : event_name === "subscription_expired"
              ? "subscription_expired"
              : "subscription_paused",
          plan?.id ?? null
        );

        break;
      }

      // -----------------------------------------------------------------------
      // Payment succeeded → reset usage quota for new billing cycle
      // -----------------------------------------------------------------------
      case "subscription_payment_success": {
        const sub = await db.subscription.findUnique({
          where: { lsSubscriptionId },
        });

        if (!sub) break;

        await db.subscription.update({
          where: { lsSubscriptionId },
          data: {
            lsCurrentPeriodEnd: attributes.renews_at ? new Date(attributes.renews_at) : null,
            status: "active",
          },
        });

        // Reset usage counters at start of each new billing cycle
        await db.user.update({
          where: { id: sub.userId },
          data: {
            wordsUsed: 0,
            rewriteCount: 0,
            quotaResetAt: new Date(),
          },
        });

        console.log(`[ls/webhook] Quota reset for userId=${sub.userId} (new billing cycle)`);
        break;
      }

      // -----------------------------------------------------------------------
      // Payment failed → mark past_due (Stripe retries automatically)
      // Actual downgrade only happens on subscription_cancelled
      // -----------------------------------------------------------------------
      case "subscription_payment_failed":
      case "subscription_payment_recovered": {
        const sub = await db.subscription.findUnique({
          where: { lsSubscriptionId },
        });

        if (!sub) break;

        const newStatus = event_name === "subscription_payment_recovered"
          ? "active"
          : "past_due";

        await db.subscription.update({
          where: { lsSubscriptionId },
          data: { status: newStatus },
        });

        track(
          sub.userId,
          event_name === "subscription_payment_recovered" ? "payment_recovered" : "payment_failed",
          (sub.lsVariantId ? getPlanByVariantId(sub.lsVariantId)?.id : null) ?? null
        );
        console.warn(`[ls/webhook] Payment ${event_name} for userId=${sub.userId} → ${newStatus}`);
        break;
      }

      // -----------------------------------------------------------------------
      // One-time orders: Founding 100 and Word Packs
      // -----------------------------------------------------------------------
      case "order_created": {
        const order = payload.data.attributes as unknown as LsOrderAttributes;
        const orderId = payload.data.id;
        const variantId = String(order.first_order_item?.variant_id ?? "");
        const offer = oneTimeOfferForVariant(variantId);
        if (!offer) break; // a subscription's first order: subscription_created provisions it
        if (order.status !== "paid") {
          console.warn(`[ls/webhook] order ${orderId} (${offer}) has status ${order.status}; nothing granted`);
          break;
        }
        const clerkId = custom_data?.clerk_id;
        const user = clerkId ? await db.user.findUnique({ where: { clerkId }, select: { id: true } }) : null;
        if (!user) {
          // Checkout always sends clerk_id; without a user there is nobody to credit.
          console.error(`[ls/webhook] order ${orderId} (${offer}): no user for custom_data.clerk_id`);
          break;
        }
        const amountCents = typeof order.total === "number" ? order.total : null;

        if (offer === "founding") {
          const planExpiresAt = await fulfilFounding(user.id, orderId, variantId, amountCents);
          if (planExpiresAt) {
            runAfter("founding-purchased", () =>
              recordEvent({
                userId: user.id,
                type: "founding_purchased",
                props: { orderId, amountCents, planExpiresAt: planExpiresAt.toISOString() },
                dedupeKey: `founding_purchased:${orderId}`,
              })
            );
            console.log(`[ls/webhook] Founding 100 granted to userId=${user.id} until ${planExpiresAt.toISOString()}`);
          }
        } else if (await fulfilWordPack(user.id, orderId, variantId, amountCents)) {
          runAfter("wordpack-purchased", () =>
            recordEvent({
              userId: user.id,
              type: "wordpack_purchased",
              props: { orderId, amountCents, words: wordPackConfig()?.words ?? null },
              dedupeKey: `wordpack_purchased:${orderId}`,
            })
          );
          console.log(`[ls/webhook] Word Pack credited to userId=${user.id}`);
        }
        break;
      }

      default:
        console.log(`[ls/webhook] Unhandled event: ${event_name}`);
    }
  } catch (err) {
    console.error(`[ls/webhook] Error handling ${event_name}:`, err);
    return new Response("Internal error", { status: 500 });
  }

  return new Response("OK", { status: 200 });
}
