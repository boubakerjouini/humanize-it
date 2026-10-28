// ===========================================================
// components/checkout-outcome.ts — What an answer from POST /api/checkout
// asks the browser to do, shared by the plan menu
// (components/ui/upgrade-modal.tsx) and the pricing page buttons
// (components/pricing-button.tsx). While new payments are paused the route
// answers 409 { error: { code: "CHECKOUT_PAUSED", message } }: a calm notice
// for the buyer, never a red error. The code decides it, not the status, so a
// pause still reads as a pause if the status ever changes.
// ===========================================================

import type { CheckoutPlan } from "@/lib/checkout-intent";

export const CHECKOUT_PAUSED = "CHECKOUT_PAUSED";

/** Only shown if a paused answer ever arrives without its own message. */
export const CHECKOUT_PAUSED_FALLBACK = "New subscriptions are paused for now. Your current plan keeps working as usual.";

export type CheckoutOutcome =
  | { kind: "redirect"; url: string }
  | { kind: "paused"; message: string }
  /** `body` is the parsed answer, kept for logging. */
  | { kind: "error"; message: string | null; body: unknown };

type CheckoutBody = { url?: unknown; error?: { code?: unknown; message?: unknown } };

/** Classify a parsed /api/checkout answer (`ok` is Response.ok). */
export function checkoutOutcome(ok: boolean, body: unknown): CheckoutOutcome {
  const data: CheckoutBody = body && typeof body === "object" ? body : {};
  if (ok && typeof data.url === "string" && data.url) return { kind: "redirect", url: data.url };
  const raw = data.error?.message;
  const message = typeof raw === "string" && raw.trim() ? raw : null;
  if (data.error?.code === CHECKOUT_PAUSED) return { kind: "paused", message: message ?? CHECKOUT_PAUSED_FALLBACK };
  return { kind: "error", message, body };
}

/**
 * POST /api/checkout for `plan`. Rejects like fetch() + res.json() do (network
 * failure, a body that isn't JSON), so callers keep their own catch handling.
 */
export async function requestCheckout(plan: CheckoutPlan, annual: boolean): Promise<CheckoutOutcome> {
  const res = await fetch("/api/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan, annual }),
  });
  return checkoutOutcome(res.ok, await res.json());
}
