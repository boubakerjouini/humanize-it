import { headers } from "next/headers";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { getPlanByStripePriceId } from "@/lib/plans";
import type { Plan } from "@/app/generated/prisma/client";

export async function POST(req: Request) {
  const body = await req.text();
  const headerPayload = await headers();
  const signature = headerPayload.get("stripe-signature");

  if (!signature) {
    return new Response("Missing stripe-signature header", { status: 400 });
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch {
    console.error("Stripe webhook signature verification failed");
    return new Response("Invalid signature", { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;

      if (!session.customer || !session.subscription) break;

      const subscription = await stripe.subscriptions.retrieve(
        session.subscription as string
      );

      const priceId = subscription.items.data[0]?.price.id;
      const plan = getPlanByStripePriceId(priceId);
      const clerkId = session.metadata?.clerkId;

      if (!clerkId) {
        console.error("No clerkId in checkout session metadata");
        break;
      }

      const user = await db.user.update({
        where: { clerkId },
        data: {
          plan: (plan?.id ?? "PRO") as Plan,
        },
      });

      await db.subscription.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          stripeCustomerId: session.customer as string,
          stripeSubscriptionId: subscription.id,
          stripePriceId: priceId,
          stripeCurrentPeriodEnd: new Date(
            subscription.items.data[0]?.current_period_end
              ? subscription.items.data[0].current_period_end * 1000
              : Date.now()
          ),
          status: subscription.status,
        },
        update: {
          stripeSubscriptionId: subscription.id,
          stripePriceId: priceId,
          stripeCurrentPeriodEnd: new Date(
            subscription.items.data[0]?.current_period_end
              ? subscription.items.data[0].current_period_end * 1000
              : Date.now()
          ),
          status: subscription.status,
        },
      });

      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object;
      const priceId = subscription.items.data[0]?.price.id;
      const plan = getPlanByStripePriceId(priceId);

      const sub = await db.subscription.findUnique({
        where: {
          stripeSubscriptionId: subscription.id,
        },
      });

      if (!sub) break;

      await db.subscription.update({
        where: { stripeSubscriptionId: subscription.id },
        data: {
          stripePriceId: priceId,
          stripeCurrentPeriodEnd: new Date(
            subscription.items.data[0]?.current_period_end
              ? subscription.items.data[0].current_period_end * 1000
              : Date.now()
          ),
          status: subscription.status,
        },
      });

      if (plan) {
        await db.user.update({
          where: { id: sub.userId },
          data: { plan: plan.id as Plan },
        });
      }

      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object;

      const sub = await db.subscription.findUnique({
        where: { stripeSubscriptionId: subscription.id },
      });

      if (!sub) break;

      await db.subscription.update({
        where: { stripeSubscriptionId: subscription.id },
        data: { status: "canceled" },
      });

      await db.user.update({
        where: { id: sub.userId },
        data: { plan: "FREE" },
      });

      break;
    }

    case "invoice.payment_succeeded": {
      const invoice = event.data.object;

      if (!invoice.subscription) break;

      const sub = await db.subscription.findUnique({
        where: { stripeSubscriptionId: invoice.subscription as string },
      });

      if (!sub) break;

      // Reset usage counters on successful payment (new billing cycle)
      await db.user.update({
        where: { id: sub.userId },
        data: {
          wordsUsed: 0,
          rewriteCount: 0,
          quotaResetAt: new Date(),
        },
      });

      break;
    }
  }

  return new Response("OK", { status: 200 });
}
