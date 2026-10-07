// ===========================================================
// app/api/offers/shared.ts — Founding 100 and Word Pack state, shared by
// /api/offers, /api/offers/checkout, the LemonSqueezy webhook and /lifetime.
//
// The "{n} of 100 left" counter must never go back up, so it counts the
// larger of two ledgers: Purchase rows (deleted with their user) and the
// append-only AuditLog entry the webhook writes for every founding sale.
// ===========================================================

import { db } from "@/lib/db";
import { FOUNDING, foundingVariantId, wordPackConfig } from "@/lib/plans";

/** AuditLog action written once per founding order (see the LemonSqueezy webhook). */
export const FOUNDING_AUDIT_ACTION = "offer.founding_purchased";
export const WORDPACK_AUDIT_ACTION = "offer.wordpack_purchased";

export type FoundingStatus = {
  /** The LemonSqueezy product exists (env set); otherwise the page collects a waitlist. */
  configured: boolean;
  /** Seats sold so far, or null when the database couldn't be read. */
  sold: number | null;
  left: number | null;
  /** Still on sale: configured and not sold out (an unreadable count is treated as open). */
  open: boolean;
};

export async function foundingSold(): Promise<number> {
  const [purchases, audited] = await Promise.all([
    db.purchase.count({ where: { kind: "founding" } }),
    db.auditLog.count({ where: { action: FOUNDING_AUDIT_ACTION } }),
  ]);
  return Math.max(purchases, audited);
}

export async function foundingStatus(): Promise<FoundingStatus> {
  const configured = !!foundingVariantId();
  let sold: number | null = null;
  try {
    sold = await foundingSold();
  } catch (err) {
    console.error("[offers] founding count failed:", err instanceof Error ? err.message : err);
  }
  const left = sold === null ? null : Math.max(0, FOUNDING.seats - sold);
  return { configured, sold, left, open: configured && (left === null || left > 0) };
}

export type WordPackStatus = { available: boolean; priceUsd: number; words: number; days: number } | { available: false };

export function wordPackStatus(): WordPackStatus {
  const pack = wordPackConfig();
  return pack ? { available: true, priceUsd: pack.priceUsd, words: pack.words, days: pack.days } : { available: false };
}
