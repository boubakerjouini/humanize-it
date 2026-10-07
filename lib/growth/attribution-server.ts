// ===========================================================
// lib/growth/attribution-server.ts — Server side of attribution: read the
// hz_ft / hz_lt cookies of the current request and copy them onto a Contact.
// First-touch columns are written once (only while firstTouchAt is null);
// lastTouch is refreshed every time a newer touch is known.
// ===========================================================

import { cookies } from "next/headers";
import { db } from "@/lib/db";
import type { Prisma } from "@/app/generated/prisma/client";
import {
  FIRST_TOUCH_COOKIE,
  LAST_TOUCH_COOKIE,
  decodeTouch,
  touchToFirstTouchFields,
  type Touch,
} from "@/lib/growth/attribution";

export type AttributionSnapshot = { first: Touch | null; last: Touch | null };

/**
 * Attribution of the current request, or null when no cookie jar is readable
 * (outside request scope, or inside after() in a Server Component). Never throws.
 */
export async function readAttribution(): Promise<AttributionSnapshot | null> {
  try {
    const jar = await cookies();
    return {
      first: decodeTouch(jar.get(FIRST_TOUCH_COOKIE)?.value),
      last: decodeTouch(jar.get(LAST_TOUCH_COOKIE)?.value),
    };
  } catch {
    return null;
  }
}

/** The touch to use as first touch: hz_ft, else hz_lt (e.g. hz_ft was cleared). */
export function firstTouchOf(snapshot: AttributionSnapshot | null | undefined): Touch | null {
  return snapshot?.first ?? snapshot?.last ?? null;
}

/**
 * Write first-touch fields if the contact has none yet, and refresh lastTouch.
 * Returns true when anything was written. Throws on DB errors; callers run it
 * inside a growth hook that catches.
 */
export async function applyFirstTouch(
  contactId: string,
  snapshot: AttributionSnapshot | null | undefined
): Promise<boolean> {
  const first = firstTouchOf(snapshot);
  if (!first) return false;
  let wrote = false;

  const res = await db.contact.updateMany({
    where: { id: contactId, firstTouchAt: null },
    data: touchToFirstTouchFields(first),
  });
  wrote = res.count > 0;

  const last = snapshot?.last ?? null;
  if (last) {
    await db.contact.update({
      where: { id: contactId },
      data: { lastTouch: last as unknown as Prisma.InputJsonValue },
    });
    wrote = true;
  }
  return wrote;
}
