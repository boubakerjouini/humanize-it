// ===========================================================
// Polar client (merchant of record for every HumanizeIt payment)
// Docs: https://polar.sh/docs/api-reference
// SDK:  https://github.com/polarsource/polar-js (API version 2026-10)
//
// POLAR_SERVER=sandbox points at sandbox.polar.sh, which needs its own
// sandbox token and product ids. Anything else uses production.
// ===========================================================

import { createPolar, errors, type Polar } from "@polar-sh/sdk/2026-10";

let client: Polar | null = null;
let clientKey = "";

/** The Polar client, or null while POLAR_ACCESS_TOKEN is unset (billing off). */
export function getPolar(): Polar | null {
  const token = process.env.POLAR_ACCESS_TOKEN?.trim();
  if (!token) return null;
  const environment = process.env.POLAR_SERVER === "sandbox" ? "sandbox" : "production";
  const key = `${environment}:${token}`;
  if (!client || clientKey !== key) {
    client = createPolar({ accessToken: token, environment });
    clientKey = key;
  }
  return client;
}

/**
 * Polar API calls one account may start per minute; checkout, offers and the
 * portal share the budget. The org-wide API limit is 500 a minute, so no single
 * account can use it up for everyone.
 */
export const POLAR_CALLS_PER_MINUTE = 5;

/** Why a buyer's Polar customer can't be set up. The checkout routes show the message. */
export class BillingAccountError extends Error {
  constructor(
    readonly code: "EMAIL_TAKEN" | "EMAIL_REJECTED",
    message: string
  ) {
    super(message);
  }
}

/**
 * The user's own Polar customer (external id = our user id), created on first
 * use. Every checkout is opened on it with customer_id: Polar then locks the
 * email on its page and never attaches the purchase to another customer found
 * by the email typed there, which would credit a different account.
 */
export async function ensureCustomer(polar: Polar, user: { id: string; email: string; name: string | null }): Promise<string> {
  try {
    return (await polar.customers.getExternal(user.id)).id;
  } catch (err) {
    if (!(err instanceof errors.ResourceNotFound)) throw err;
  }
  try {
    return (await polar.customers.create({ external_id: user.id, email: user.email, name: user.name ?? undefined })).id;
  } catch (err) {
    if (!(err instanceof errors.HTTPValidationError)) throw err;
    const detail = err.error.detail ?? [];
    // A parallel request created it first.
    if (detail.some((d) => d.loc.includes("external_id"))) return (await polar.customers.getExternal(user.id)).id;
    const email = detail.find((d) => d.loc.includes("email"));
    if (!email) throw err;
    if (/already exists/i.test(email.msg)) {
      // Another Polar customer has this email, e.g. from an account that was deleted and made again.
      throw new BillingAccountError(
        "EMAIL_TAKEN",
        "Your email is already linked to another billing account. Email support@humanizeit.app and we'll sort it out."
      );
    }
    // Polar refuses addresses whose domain takes no mail.
    throw new BillingAccountError("EMAIL_REJECTED", "Our payment provider can't accept your account's email address. Email support@humanizeit.app for help.");
  }
}

/**
 * A customer-portal link for the user (plan changes, card, invoices, cancel),
 * or null when the user has no Polar customer, i.e. never bought anything.
 */
export async function customerPortalUrl(polar: Polar, userId: string): Promise<string | null> {
  try {
    const session = await polar.customerSessions.create({
      external_customer_id: userId,
      return_url: `${appUrl()}/dashboard/settings`,
    });
    return session.customer_portal_url;
  } catch (err) {
    // Polar answers an unknown external id with 422 "Customer does not exist.", not 404.
    const unknown =
      err instanceof errors.HTTPValidationError && (err.error.detail ?? []).some((d) => d.loc.includes("external_customer_id"));
    if (unknown) return null;
    throw err;
  }
}

/**
 * Account deletion: Polar cancels the customer's subscriptions at once, so a
 * deleted account is never billed again, and frees the email for a new
 * account. Best effort: the deletion itself must still happen.
 */
export async function deleteCustomerOf(userId: string): Promise<void> {
  const polar = getPolar();
  if (!polar) return;
  try {
    await polar.customers.deleteExternal(userId);
  } catch (err) {
    if (!(err instanceof errors.ResourceNotFound)) console.error(`[polar] could not delete the customer of user ${userId}:`, err);
  }
}

/** Where Polar sends the buyer after paying, and the back link on its pages. */
export function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}
