// ===========================================================
// lib/crm/bonus.ts — The bonus-word pool (referral rewards, word packs, manual
// thank-yous). It lives on Contact, never on User, and is drawn only after the
// plan allowance runs out. A balance may expire (bonusWordsExpireAt; null =
// never); an expired balance counts as 0 and is never resurrected by a later
// grant. Every grant is a `bonus_granted` event with a unique dedupe key, so a
// retried grant can't pay twice.
// ===========================================================

import { db } from "@/lib/db";
import { isUniqueViolation, logGrowthError } from "@/lib/growth/safe";

/** The usable balance: 0 once expired. */
export function availableBonusWords(c: { bonusWords: number; bonusWordsExpireAt: Date | null }, now: Date = new Date()): number {
  if (c.bonusWordsExpireAt && c.bonusWordsExpireAt.getTime() <= now.getTime()) return 0;
  return Math.max(0, c.bonusWords);
}

const live = (now: Date) => ({ OR: [{ bonusWordsExpireAt: null }, { bonusWordsExpireAt: { gt: now } }] });

export type GrantBonusOptions = {
  /** When these words expire; null/undefined = never. A live balance keeps the later of the two. */
  expiresAt?: Date | null;
  actor?: string;
  props?: Record<string, string | number | boolean | null>;
};

/**
 * Add `words` to a contact's pool, once per `dedupeKey`. Returns true when this
 * call granted them, false on a duplicate, a missing contact or any error.
 */
export async function grantBonusWords(
  contactId: string,
  words: number,
  reason: string,
  dedupeKey: string,
  opts: GrantBonusOptions = {}
): Promise<boolean> {
  const amount = Math.floor(words);
  if (!Number.isFinite(amount) || amount <= 0) return false;
  const expiresAt = opts.expiresAt ?? null;
  try {
    return await db.$transaction(async (tx) => {
      await tx.contactEvent.create({
        data: {
          contactId,
          type: "bonus_granted",
          dedupeKey,
          actor: (opts.actor ?? "system").slice(0, 200),
          props: { ...opts.props, words: amount, reason: reason.slice(0, 100), expiresAt: expiresAt ? expiresAt.toISOString() : null },
        },
      });
      const now = new Date();
      for (let attempt = 0; attempt < 3; attempt++) {
        // Empty or expired balance: start over with this grant's expiry.
        const fresh = await tx.contact.updateMany({
          where: { id: contactId, OR: [{ bonusWords: { lte: 0 } }, { bonusWordsExpireAt: { lte: now } }] },
          data: { bonusWords: amount, bonusWordsExpireAt: expiresAt },
        });
        if (fresh.count === 1) return true;

        // Live balance: add to it, then keep the later expiry (null = never).
        const topUp = await tx.contact.updateMany({
          where: { id: contactId, bonusWords: { gt: 0 }, ...live(now) },
          data: { bonusWords: { increment: amount } },
        });
        if (topUp.count === 1) {
          if (expiresAt === null) {
            await tx.contact.update({ where: { id: contactId }, data: { bonusWordsExpireAt: null } });
          } else {
            await tx.contact.updateMany({
              where: { id: contactId, bonusWordsExpireAt: { lt: expiresAt } },
              data: { bonusWordsExpireAt: expiresAt },
            });
          }
          return true;
        }
      }
      // Rolls back the event too, so a retry can grant under the same key.
      throw new Error("bonus balance changed concurrently");
    });
  } catch (err) {
    if (!isUniqueViolation(err)) logGrowthError("bonus-grant", err);
    return false;
  }
}

/**
 * Atomically take `words` from a user's live pool. False when the pool is too
 * small, expired, missing, or the table doesn't exist (feature previews).
 */
export async function consumeBonusWords(userId: string, words: number): Promise<boolean> {
  const amount = Math.ceil(Math.max(0, words));
  if (amount === 0) return true;
  try {
    const res = await db.contact.updateMany({
      where: { userId, bonusWords: { gte: amount }, ...live(new Date()) },
      data: { bonusWords: { decrement: amount } },
    });
    return res.count > 0;
  } catch {
    return false;
  }
}

/** Give back words taken by consumeBonusWords (e.g. the model call failed). Never throws. */
export async function refundBonusWords(userId: string, words: number): Promise<void> {
  const amount = Math.ceil(Math.max(0, words));
  if (amount === 0) return;
  try {
    await db.contact.updateMany({ where: { userId }, data: { bonusWords: { increment: amount } } });
  } catch (err) {
    logGrowthError("bonus-refund", err);
  }
}

/** Read-only check (the Free rewrite gate). Never throws. */
export async function hasBonusWords(userId: string, words: number): Promise<boolean> {
  try {
    const contact = await db.contact.findUnique({ where: { userId }, select: { bonusWords: true, bonusWordsExpireAt: true } });
    return !!contact && availableBonusWords(contact) >= Math.max(0, words);
  } catch {
    return false;
  }
}

/** Usable balance for display (/api/usage). 0 when missing or on error. */
export async function bonusBalance(userId: string): Promise<{ words: number; expiresAt: Date | null }> {
  try {
    const contact = await db.contact.findUnique({ where: { userId }, select: { bonusWords: true, bonusWordsExpireAt: true } });
    if (!contact) return { words: 0, expiresAt: null };
    const words = availableBonusWords(contact);
    return { words, expiresAt: words > 0 ? contact.bonusWordsExpireAt : null };
  } catch {
    return { words: 0, expiresAt: null };
  }
}
