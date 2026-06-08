// ===========================================================
// lib/admin.ts — Platform admin authorization
//
// A user is an admin if EITHER:
//   • their email is in the allowlist (ADMIN_EMAILS env, comma-separated),
//     which always includes the founder address, OR
//   • their User.role is ADMIN in the database.
//
// All /admin pages and /api/admin/* routes must call requireAdmin().
// ===========================================================

import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import type { User } from "@/app/generated/prisma/client";

/** Hard-coded founder admin — always allowed even with no env configured. */
const FOUNDER_ADMIN = "boubakerseddik.jouini@gmail.com";

/** Normalized set of allowlisted admin emails. */
export function adminEmails(): Set<string> {
  const fromEnv = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return new Set<string>([FOUNDER_ADMIN, ...fromEnv]);
}

/** True when the given email is allowlisted as an admin. */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmails().has(email.trim().toLowerCase());
}

/** True when a loaded user record is an admin (allowlist or role). */
export function isAdminUser(user: Pick<User, "email" | "role"> | null | undefined): boolean {
  if (!user) return false;
  return user.role === "ADMIN" || isAdminEmail(user.email);
}

/**
 * Resolve the current admin user for a server context, or null if the caller
 * is not signed in / not an admin. Use in layouts, pages and API routes.
 */
export async function getAdminUser(): Promise<User | null> {
  const { userId: clerkId } = await auth();
  if (!clerkId) return null;

  const user = await db.user.findUnique({ where: { clerkId } });
  if (!user) return null;

  return isAdminUser(user) ? user : null;
}

/**
 * Throwing guard for API routes. Returns the admin user or throws an Error
 * tagged with `status` so the handler can map it to a 401/403 response.
 */
export async function requireAdmin(): Promise<User> {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    const err = new Error("Authentication required.") as Error & { status: number };
    err.status = 401;
    throw err;
  }
  const user = await db.user.findUnique({ where: { clerkId } });
  if (!isAdminUser(user)) {
    const err = new Error("Admin access required.") as Error & { status: number };
    err.status = 403;
    throw err;
  }
  return user as User;
}
