// ===========================================================
// lib/user.ts — single source of truth for lazily creating the
// DB User row that mirrors a Clerk account.
//
// Why this exists: API routes only have the Clerk *id* from auth(), not the
// email. Historically each route upserted with a placeholder email
// (`<clerkId>@placeholder.humanize-it.app`) and relied on the Clerk webhook to
// backfill the real one. When the webhook isn't firing (or fires after the
// first API hit) the placeholder sticks forever — which is why real emails
// never showed up in the DB. ensureUser() resolves the real Clerk email at
// creation time (and repairs any row still holding a placeholder), so callers
// never have to think about it. Always use this instead of upserting inline.
// ===========================================================

import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import type { User } from "@/app/generated/prisma/client";

export const PLACEHOLDER_EMAIL_DOMAIN = "@placeholder.humanize-it.app";

export function isPlaceholderEmail(email: string | null | undefined): boolean {
  return !!email && email.endsWith(PLACEHOLDER_EMAIL_DOMAIN);
}

export function placeholderEmail(clerkId: string): string {
  return `${clerkId}${PLACEHOLDER_EMAIL_DOMAIN}`;
}

function normalizeEmail(email: string | null | undefined): string | null {
  const e = email?.trim().toLowerCase();
  return e && e.length > 0 ? e : null;
}

/**
 * Resolve the caller's real primary email from the request-scoped Clerk
 * session. Returns null when there is no request session (e.g. background
 * jobs), the session belongs to a different user, or Clerk is unreachable.
 */
async function resolveEmailFromSession(clerkId: string): Promise<string | null> {
  try {
    const cu = await currentUser();
    if (!cu || cu.id !== clerkId) return null;
    return normalizeEmail(
      cu.primaryEmailAddress?.emailAddress ?? cu.emailAddresses?.[0]?.emailAddress
    );
  } catch {
    return null;
  }
}

/**
 * Resolve a user's real primary email from the Clerk Backend API by id. Works
 * outside request scope (durable jobs, scripts). Needs CLERK_SECRET_KEY.
 * Picks the address flagged as primary, matching scripts/grant-admin.ts.
 */
export async function resolveEmailFromClerkApi(clerkId: string): Promise<string | null> {
  const secret = process.env.CLERK_SECRET_KEY;
  if (!secret) return null;
  try {
    const res = await fetch(`https://api.clerk.com/v1/users/${encodeURIComponent(clerkId)}`, {
      headers: { Authorization: `Bearer ${secret}` },
    });
    if (!res.ok) return null;
    const u = (await res.json()) as {
      primary_email_address_id: string | null;
      email_addresses: { id: string; email_address: string }[];
    };
    const primary =
      u.email_addresses.find((e) => e.id === u.primary_email_address_id) ??
      u.email_addresses[0];
    return normalizeEmail(primary?.email_address);
  } catch {
    return null;
  }
}

/**
 * Get the DB User for a Clerk id, creating it on first use with the real Clerk
 * email and backfilling the real email whenever the stored one is still a
 * placeholder. Race-safe (uses upsert for the create path). Falls back to a
 * placeholder email only when the real one genuinely can't be resolved, so
 * account creation never fails.
 *
 * This is the ONLY place app code should create a User row. Do not upsert a
 * User with a placeholder email inline — that reintroduces the original bug.
 */
export async function ensureUser(clerkId: string): Promise<User> {
  const existing = await db.user.findUnique({ where: { clerkId } });

  // Fast path: a fully-formed row already exists — no Clerk round-trip.
  if (existing && !isPlaceholderEmail(existing.email)) return existing;

  // Creating, or repairing a placeholder row → resolve the real email. Prefer
  // the request session; fall back to the Backend API for non-request contexts.
  const realEmail =
    (await resolveEmailFromSession(clerkId)) ?? (await resolveEmailFromClerkApi(clerkId));

  try {
    return await db.user.upsert({
      where: { clerkId },
      // Only overwrite email when we actually resolved a real one — never
      // clobber a good email back to a placeholder.
      update: realEmail ? { email: realEmail } : {},
      create: {
        clerkId,
        email: realEmail ?? placeholderEmail(clerkId),
        plan: "FREE",
        wordsUsed: 0,
      },
    });
  } catch {
    // Possible causes: the email unique constraint collided with another row,
    // or a concurrent create won the race. Re-read and return whatever exists.
    const row = await db.user.findUnique({ where: { clerkId } });
    if (row) return row;
    throw new Error(`ensureUser: could not resolve or create user for ${clerkId}`);
  }
}
