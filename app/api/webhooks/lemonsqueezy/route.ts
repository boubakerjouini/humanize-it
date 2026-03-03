// ===========================================================
// POST /api/webhooks/lemonsqueezy — Lemon Squeezy webhook handler
//
// Events handled:
//   subscription_created         → provision plan after first payment
//   subscription_updated         → plan change / renewal sync
//   subscription_cancelled       → downgrade to FREE
//   subscription_payment_success → reset usage quota (new billing cycle)
//   subscription_payment_failed  → mark status past_due
// ===========================================================

import crypto from "crypto";
import { db } from "@/lib/db";
import { getPlanByVariantId } from "@/lib/plans";
import type { Plan } from "@/app/generated/prisma/client";

// ---------------------------------------------------------------------------
// Types — Lemon Squeezy webhook payload
// ---------------------------------------------------------------------------
interface LsSubscriptionAttributes {
  customer_id: number;
  variant_id: number;
  status: string;
  renews_at: string | null;
  ends_at: string | null;
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
    };
  };
  data: {
    id: string;
    type: string;
    attributes: LsSubscriptionAttributes;
  };
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

        const user = await db.user.update({
          where: { clerkId },
          data: { plan: (plan?.id ?? "PRO") as Plan },
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

        console.warn(`[ls/webhook] Payment ${event_name} for userId=${sub.userId} → ${newStatus}`);
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
