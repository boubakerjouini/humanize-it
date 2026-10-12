// ===========================================================
// lib/checkout-intent.ts — Keeps a paid plan picked on the pricing page
// through sign-up. A signed-out click on "Start Pro" goes to
// /sign-up?redirect_url=<the plan's dashboard path>; the auth pages send the
// account there, and the dashboard opens the plan menu on that plan and
// billing period (components/workspace/workspace-shell.tsx).
//
// Redirect targets are same-origin relative paths only, so a crafted
// ?redirect_url= can never send anyone to another site. Pure: safe in client
// and server code.
// ===========================================================

export type CheckoutPlan = "PRO" | "TEAM";

export interface CheckoutIntent {
  plan: CheckoutPlan;
  annual: boolean;
}

/** Where the auth pages send people when there is no usable redirect. */
export const DEFAULT_AFTER_AUTH = "/dashboard";

const INTENT_PARAMS = ["checkout", "billing"] as const;
const MAX_REDIRECT_LENGTH = 512;
const PARSE_BASE = "https://redirect.invalid";

/** The dashboard path that reopens the plan menu on `intent`, e.g. /dashboard?checkout=pro&billing=annual. */
export function checkoutIntentPath(intent: CheckoutIntent): string {
  return `${DEFAULT_AFTER_AUTH}?checkout=${intent.plan.toLowerCase()}&billing=${intent.annual ? "annual" : "monthly"}`;
}

/** Sign-up URL that brings a new account back to the plan menu on `intent`. */
export function signUpUrlFor(intent: CheckoutIntent): string {
  return authPageUrl("/sign-up", checkoutIntentPath(intent));
}

/** The plan and billing period in a query string, or null. Billing defaults to annual, like the plan menu. */
export function readCheckoutIntent(search: string): CheckoutIntent | null {
  const params = new URLSearchParams(search);
  const plan = params.get("checkout")?.toUpperCase();
  if (plan !== "PRO" && plan !== "TEAM") return null;
  return { plan, annual: params.get("billing") !== "monthly" };
}

/** `url` (absolute or relative) without the intent parameters, so a reload doesn't reopen the menu. */
export function withoutCheckoutIntent(url: string): string {
  const absolute = /^[a-z][a-z0-9+.-]*:\/\//i.test(url);
  const parsed = new URL(url, PARSE_BASE);
  for (const param of INTENT_PARAMS) parsed.searchParams.delete(param);
  return absolute ? parsed.toString() : `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

/**
 * `raw` as a normalized same-origin path ("/lifetime", "/dashboard?x=1"), else
 * null. Rejects absolute and protocol-relative URLs ("//evil.com",
 * "/\evil.com"), backslashes and whitespace (browsers drop tabs and newlines,
 * so "/\t/evil.com" would become "//evil.com"), the auth pages themselves, and
 * anything over 512 characters.
 */
export function safeRedirectPath(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > MAX_REDIRECT_LENGTH || !isSitePath(raw)) return null;
  if (/[\\\s]/.test(raw)) return null;
  let url: URL;
  try {
    url = new URL(raw, PARSE_BASE);
  } catch {
    return null;
  }
  const path = `${url.pathname}${url.search}${url.hash}`;
  // Dot segments can turn "/.//evil.com" into "//evil.com", so check the result too.
  if (url.origin !== PARSE_BASE || !isSitePath(path)) return null;
  if (/^\/sign-(in|up)(\/|$)/.test(url.pathname)) return null;
  return path;
}

/** One leading slash: a path on this site, never "//host" (protocol-relative). */
function isSitePath(s: string): boolean {
  return s.startsWith("/") && !s.startsWith("//");
}

/** Where to go after signing in or up, from a ?redirect_url= value (repeated params use the first). */
export function afterAuthPath(raw: string | string[] | undefined): string {
  return safeRedirectPath(Array.isArray(raw) ? raw[0] : raw) ?? DEFAULT_AFTER_AUTH;
}

/** `page` (/sign-in or /sign-up) carrying `target` along, so switching between them keeps it. */
export function authPageUrl(page: "/sign-in" | "/sign-up", target: string): string {
  return target === DEFAULT_AFTER_AUTH ? page : `${page}?redirect_url=${encodeURIComponent(target)}`;
}
