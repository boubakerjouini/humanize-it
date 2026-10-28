// ===========================================================
// POST /api/checkout — Create a Polar checkout session for Pro or Team
//
// A user who already has a live subscription gets the Polar customer portal
// instead: Polar allows one billable subscription per customer, so a second
// checkout could never be paid. Plan and billing-period changes happen there.
//
// While Polar can't take payments yet (account under review), a new checkout
// is paused: 409 CHECKOUT_PAUSED with a friendly message instead of a Polar
// page that says "Payments are currently unavailable". The attempt is still
// recorded, and a task asks the founder to follow up personally. The message
// promises no email: the notice offers an explicit opt-in (topic checkout_open).
// ===========================================================

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { appUrl, BillingAccountError, checkoutPaymentsEnabled, customerPortalUrl, ensureCustomer, getPolar, POLAR_CALLS_PER_MINUTE } from "@/lib/polar";
import { db } from "@/lib/db";
import { PLANS } from "@/lib/plans";
import { trackCheckoutPaused, trackCheckoutStarted } from "@/lib/crm/hooks";
import { runAfter } from "@/lib/growth/safe";
import { trackServer } from "@/lib/posthog";
import { checkRateLimit, rateLimitHeaders } from "@/lib/rate-limit";

const CHECKOUT_PAUSED_MESSAGE =
  "Upgrades open soon: our payment provider is finishing its review of our account.";

/** Local statuses of a subscription Polar still bills (lib/crm/lifecycle.ts vocabulary). */
const LIVE_STATUSES = ["active", "on_trial", "past_due"];

function hasLiveSubscription(sub: { polarSubscriptionId: string | null; status: string; currentPeriodEnd: Date | null } | null): boolean {
  if (!sub?.polarSubscriptionId) return false;
  if (LIVE_STATUSES.includes(sub.status)) return true;
  // Cancelled at period end: still billable in Polar until the period is over.
  return sub.status === "cancelled" && !!sub.currentPeriodEnd && sub.currentPeriodEnd.getTime() > Date.now();
}

export async function POST(req: Request) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Authentication required." } },
        { status: 401 }
      );
    }

    const user = await db.user.findUnique({
      where: { clerkId },
      include: { subscription: true },
    });
    if (!user) {
      return NextResponse.json(
        { error: { code: "USER_NOT_FOUND", message: "User not found." } },
        { status: 401 }
      );
    }

    const limit = await checkRateLimit(`polar:${user.id}`, POLAR_CALLS_PER_MINUTE);
    if (!limit.ok) {
      return NextResponse.json(
        { error: { code: "RATE_LIMITED", message: "Too many requests. Please wait a minute and try again." } },
        { status: 429, headers: { ...rateLimitHeaders(limit), "Retry-After": String(limit.retryAfterSeconds) } }
      );
    }

    // Parse request body — default to PRO monthly
    let body: { plan?: unknown; annual?: unknown } = {};
    try { body = await req.json(); } catch { /* no body */ }

    const planId = body.plan === "TEAM" ? "TEAM" : "PRO";
    const isAnnual = body.annual === true;
    const planConfig = PLANS[planId];

    // Pick the monthly or annual product
    const productId = isAnnual && planConfig.polarProductIdAnnual
      ? planConfig.polarProductIdAnnual
      : planConfig.polarProductId;

    if (!productId) {
      return NextResponse.json(
        {
          error: {
            code: "PLAN_NOT_CONFIGURED",
            message: `Polar product ID not configured for "${planId}"${isAnnual ? " annual" : ""}.`,
          },
        },
        { status: 500 }
      );
    }

    const polar = getPolar();
    if (!polar) {
      return NextResponse.json(
        { error: { code: "BILLING_NOT_CONFIGURED", message: "Billing is not configured." } },
        { status: 500 }
      );
    }

    if (user.subscription?.polarSubscriptionId && user.subscription.status === "paused") {
      // Polar's portal can't resume unless its pause setting is on, and a new
      // subscription would double-bill once the paused one resumes.
      return NextResponse.json(
        { error: { code: "SUBSCRIPTION_PAUSED", message: "Your subscription is paused. Email support@humanizeit.app and we'll resume it." } },
        { status: 409 }
      );
    }
    if (hasLiveSubscription(user.subscription)) {
      const portal = await customerPortalUrl(polar, user.id);
      if (portal) return NextResponse.json({ url: portal });
    }

    // Only an explicit "no" pauses: an unreadable capability keeps today's checkout.
    if ((await checkoutPaymentsEnabled()) === false) {
      runAfter("checkout-paused", () => trackCheckoutPaused(user.id, planId, isAnnual));
      trackServer(clerkId, "checkout_paused", { plan: planId, annual: isAnnual });
      return NextResponse.json({ error: { code: "CHECKOUT_PAUSED", message: CHECKOUT_PAUSED_MESSAGE } }, { status: 409 });
    }

    let customerId: string;
    try {
      customerId = await ensureCustomer(polar, user);
    } catch (err) {
      if (!(err instanceof BillingAccountError)) throw err;
      console.error(`[checkout] userId=${user.id}: ${err.code}`);
      return NextResponse.json({ error: { code: err.code, message: err.message } }, { status: 409 });
    }

    const baseUrl = appUrl();

    // Feeds the checkout_abandoned sequence; it exits once a subscription starts.
    runAfter("checkout-started", () => trackCheckoutStarted(user.id, planId, isAnnual));
    trackServer(clerkId, "checkout_started", { plan: planId, annual: isAnnual });

    const checkout = await polar.checkouts.create({
      products: [productId],
      // The buyer's own customer: the webhook checks it against the metadata,
      // and the billing portal opens on it.
      customer_id: customerId,
      // Copied onto the subscription and its orders, so the webhook can read it.
      metadata: { user_id: user.id, plan_id: planId, annual: isAnnual },
      success_url: `${baseUrl}/dashboard/editor?upgraded=true`,
      return_url: `${baseUrl}/dashboard/settings`,
    });

    return NextResponse.json({ url: checkout.url });
  } catch (err) {
    console.error("[checkout] Polar error:", err);
    return NextResponse.json(
      { error: { code: "CHECKOUT_FAILED", message: "Failed to create checkout." } },
      { status: 500 }
    );
  }
}
