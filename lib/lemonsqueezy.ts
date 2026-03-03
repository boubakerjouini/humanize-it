// ===========================================================
// Lemon Squeezy client — replaces Stripe
// Docs: https://docs.lemonsqueezy.com/api
// SDK:  https://github.com/lmsqueezy/lemonsqueezy.js
// ===========================================================

import { lemonSqueezySetup } from "@lemonsqueezy/lemonsqueezy.js";

/**
 * Call this at the top of every API route that uses LS.
 * Safe to call multiple times (idempotent).
 */
export function configureLemonSqueezy() {
  lemonSqueezySetup({
    apiKey: process.env.LEMONSQUEEZY_API_KEY!,
    onError: (error) => console.error("[LemonSqueezy] SDK error:", error),
  });
}
