// ===========================================================
// POST /api/webhooks/stripe — Stripe webhook handler
//
// Events handled:
//   checkout.session.completed       → provision subscription after checkout
//   customer.subscription.updated    → plan change / renewal sync
//   customer.subscription.deleted    → cancellation → downgrade to FREE
//   invoice.payment_succeeded        → reset usage quota on new billing cycle
//   invoice.payment_failed           → mark subscription past_due
// ===========================================================

import { headers } from "next/headers";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { getPlanByStripePriceId } from "@/lib/plans";
import type { Plan } from "@/app/generated/prisma/client";

// ---------------------------------------------------------------------------
// Helper — convert Stripe Unix timestamp (seconds) → JS Date
// ---------------------------------------------------------------------------
function fromUnix(ts: number | null | undefined): Date {
  return ts ? new Date(ts * 1000) : new Date();
}

// ---------------------------------------------------------------------------
// Helper — build the DB payload for a subscription record
//
// NOTE: In Stripe API >= 2026-02-25.clover, current_period_end moved from
// the Subscription root to SubscriptionItem. We read it from the first item.
// ---------------------------------------------------------------------------
function buildSubscriptionData(sub: Stripe.Subscription) {
  const item = sub.items.data[0];
  const priceId = item?.price.id ?? "";
  return {
    stripePriceId: priceId,
    stripeCurrentPeriodEnd: fromUnix(item?.current_period_end),
    status: sub.status,
  };
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
export async function POST(req: Request) {
  const body = await req.text();
  const headerPayload = await headers();
  const signature = headerPayload.get("stripe-signature");

  if (!signature) {
    console.warn("[stripe/webhook] Missing stripe-signature header");
    return new Response("Missing stripe-signature header", { status: 400 });
  }

  // Verify the event came from Stripe (prevents spoofed webhooks)
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("[stripe/webhook] Signature verification failed:", err);
    return new Response("Invalid signature", { status: 400 });
  }

  console.log(`[stripe/webhook] Received event: ${event.type} (${event.id})`);

  try {
    switch (event.type) {
      // -----------------------------------------------------------------------
      // User completed checkout → create/update subscription in DB
      // -----------------------------------------------------------------------
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        if (!session.customer || !session.subscription) {
          console.warn("[stripe/webhook] checkout.session.completed: missing customer or subscription");
          break;
        }

        const clerkId = session.metadata?.clerkId;
        if (!clerkId) {
          console.error("[stripe/webhook] checkout.session.completed: no clerkId in metadata");
          break;
        }

        // Retrieve the full subscription to get current_period_end and status
        const subscription = await stripe.subscriptions.retrieve(
          session.subscription as string
        );

        const priceId = subscription.items.data[0]?.price.id ?? "";
        const plan = getPlanByStripePriceId(priceId);

        // Upgrade user plan first
        const user = await db.user.update({
          where: { clerkId },
          data: { plan: (plan?.id ?? "PRO") as Plan },
        });

        // Upsert subscription record
        await db.subscription.upsert({
          where: { userId: user.id },
          create: {
            userId: user.id,
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId: subscription.id,
            ...buildSubscriptionData(subscription),
          },
          update: {
            // Customer ID may change if they used a different email
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId: subscription.id,
            ...buildSubscriptionData(subscription),
          },
        });

        console.log(`[stripe/webhook] Provisioned ${plan?.id ?? "PRO"} for clerkId=${clerkId}`);
        break;
      }

      // -----------------------------------------------------------------------
      // Subscription changed (plan upgrade/downgrade, renewal, trial end, etc.)
      // -----------------------------------------------------------------------
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const priceId = subscription.items.data[0]?.price.id ?? "";
        const plan = getPlanByStripePriceId(priceId);

        const sub = await db.subscription.findUnique({
          where: { stripeSubscriptionId: subscription.id },
        });

        if (!sub) {
          console.warn(`[stripe/webhook] subscription.updated: no local record for ${subscription.id}`);
          break;
        }

        await db.subscription.update({
          where: { stripeSubscriptionId: subscription.id },
          data: buildSubscriptionData(subscription),
        });

        // Sync plan on the user record when it changes
        if (plan) {
          await db.user.update({
            where: { id: sub.userId },
            data: { plan: plan.id as Plan },
          });
          console.log(`[stripe/webhook] Updated plan → ${plan.id} for userId=${sub.userId}`);
        }

        break;
      }

      // -----------------------------------------------------------------------
      // Subscription cancelled → downgrade to FREE immediately
      // -----------------------------------------------------------------------
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;

        const sub = await db.subscription.findUnique({
          where: { stripeSubscriptionId: subscription.id },
        });

        if (!sub) {
          console.warn(`[stripe/webhook] subscription.deleted: no local record for ${subscription.id}`);
          break;
        }

        await db.subscription.update({
          where: { stripeSubscriptionId: subscription.id },
          data: { status: "canceled" },
        });

        await db.user.update({
          where: { id: sub.userId },
          data: { plan: "FREE" },
        });

        console.log(`[stripe/webhook] Downgraded userId=${sub.userId} to FREE (subscription canceled)`);
        break;
      }

      // -----------------------------------------------------------------------
      // Invoice paid successfully → reset usage quota for new billing cycle
      // -----------------------------------------------------------------------
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;

        // Support both old field (invoice.subscription) and new nested structure
        const rawSubId =
          (invoice as unknown as { subscription?: string | { id: string } }).subscription ??
          invoice.parent?.subscription_details?.subscription;

        if (!rawSubId) {
          // One-time invoice, not subscription-related — ignore safely
          break;
        }

        const subscriptionId =
          typeof rawSubId === "string" ? rawSubId : rawSubId.id;

        const sub = await db.subscription.findUnique({
          where: { stripeSubscriptionId: subscriptionId },
        });

        if (!sub) break;

        // Reset usage counters at the start of each new billing cycle
        await db.user.update({
          where: { id: sub.userId },
          data: {
            wordsUsed: 0,
            rewriteCount: 0,
            quotaResetAt: new Date(),
          },
        });

        console.log(`[stripe/webhook] Quota reset for userId=${sub.userId} (new billing cycle)`);
        break;
      }

      // -----------------------------------------------------------------------
      // Invoice payment failed → mark subscription as past_due
      // Does NOT immediately downgrade — Stripe will retry automatically.
      // Downgrade happens only when subscription.deleted fires.
      // -----------------------------------------------------------------------
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;

        const rawSubId =
          (invoice as unknown as { subscription?: string | { id: string } }).subscription ??
          invoice.parent?.subscription_details?.subscription;

        if (!rawSubId) break;

        const subscriptionId =
          typeof rawSubId === "string" ? rawSubId : rawSubId.id;

        const sub = await db.subscription.findUnique({
          where: { stripeSubscriptionId: subscriptionId },
        });

        if (!sub) break;

        // Mark as past_due — the UI can surface a "Update payment method" banner
        await db.subscription.update({
          where: { stripeSubscriptionId: subscriptionId },
          data: { status: "past_due" },
        });

        console.warn(`[stripe/webhook] Payment failed for userId=${sub.userId} — subscription marked past_due`);
        break;
      }

      default:
        // Unhandled event — log and return 200 so Stripe doesn't retry
        console.log(`[stripe/webhook] Unhandled event type: ${event.type}`);
    }
  } catch (err) {
    // Catch DB or Stripe API errors without returning 4xx (that would trigger retries)
    console.error(`[stripe/webhook] Internal error handling ${event.type}:`, err);
    return new Response("Internal error", { status: 500 });
  }

  // Always acknowledge to Stripe — do NOT return 4xx for logic errors
  return new Response("OK", { status: 200 });
}
