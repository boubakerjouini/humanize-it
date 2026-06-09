// ===========================================================
// lib/clerk-identity.ts — batch-resolve REAL email + name from Clerk by
// clerkId, for admin views. Many DB rows still carry a placeholder email
// (`<clerkId>@placeholder.humanize-it.app`) / null name; enriching live from
// Clerk shows real identity regardless of DB backfill state. Best-effort:
// returns an empty map if Clerk is unreachable so callers fall back to DB.
// ===========================================================

import { clerkClient } from "@clerk/nextjs/server";

export interface Identity {
  email: string | null;
  name: string | null;
  imageUrl: string | null;
}

export async function resolveIdentities(clerkIds: string[]): Promise<Map<string, Identity>> {
  const map = new Map<string, Identity>();
  const ids = [...new Set(clerkIds)].filter(Boolean);
  if (ids.length === 0) return map;
  try {
    const client = await clerkClient();
    // getUserList accepts a userId[] filter; chunk to stay within request limits.
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100);
      const res = await client.users.getUserList({ userId: chunk, limit: chunk.length });
      for (const u of res.data) {
        const primary = u.emailAddresses.find((e) => e.id === u.primaryEmailAddressId) ?? u.emailAddresses[0];
        const name = [u.firstName, u.lastName].filter(Boolean).join(" ") || null;
        map.set(u.id, { email: primary?.emailAddress ?? null, name, imageUrl: u.imageUrl ?? null });
      }
    }
  } catch {
    /* best-effort — caller falls back to DB values */
  }
  return map;
}
