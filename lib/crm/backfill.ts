// ===========================================================
// lib/crm/backfill.ts — "Sync contacts": give every existing user a contact
// and rebuild their history (signup, first and latest document, subscription,
// code redemptions) as timeline events, then score them. Idempotent: every
// event has a dedupe key shared with the live hooks, so running it again (or
// after go-live) adds nothing twice. It never enrolls anyone in a sequence
// and never grants consent.
// ===========================================================

import { db } from "@/lib/db";
import { syncContactForUser } from "@/lib/crm/contacts";
import { recordEvent } from "@/lib/crm/events";
import { recomputeContact } from "@/lib/crm/recompute";
import { logGrowthError } from "@/lib/growth/safe";

export type BackfillResult = {
  users: number;
  created: number;
  linked: number;
  merged: number;
  events: number;
  errors: number;
};

export async function backfillContacts(opts: { batchSize?: number } = {}): Promise<BackfillResult> {
  const batchSize = opts.batchSize ?? 200;
  const result: BackfillResult = { users: 0, created: 0, linked: 0, merged: 0, events: 0, errors: 0 };
  let cursor: string | undefined;

  for (;;) {
    const users = await db.user.findMany({
      select: { id: true, email: true, name: true, createdAt: true },
      orderBy: { id: "asc" },
      take: batchSize,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (users.length === 0) break;
    const ids = users.map((u) => u.id);

    const [docSpans, subscriptions, redemptions] = await Promise.all([
      db.document.groupBy({
        by: ["userId"],
        where: { userId: { in: ids } },
        _min: { createdAt: true },
        _max: { createdAt: true },
      }),
      db.subscription.findMany({
        where: { userId: { in: ids } },
        select: { id: true, userId: true, status: true, lsVariantId: true, createdAt: true },
      }),
      db.redemption.findMany({
        where: { userId: { in: ids } },
        select: { userId: true, redeemedAt: true, discountCode: { select: { code: true, plan: true, grantDays: true } } },
      }),
    ]);
    const spanByUser = new Map(docSpans.map((s) => [s.userId, { first: s._min.createdAt, last: s._max.createdAt }]));
    const subByUser = new Map(subscriptions.map((s) => [s.userId, s]));
    const redemptionsByUser = new Map<string, typeof redemptions>();
    for (const r of redemptions) redemptionsByUser.set(r.userId, [...(redemptionsByUser.get(r.userId) ?? []), r]);

    for (const user of users) {
      result.users++;
      try {
        const sync = await syncContactForUser(user);
        if (sync.created) result.created++;
        if (sync.linked) result.linked++;
        if (sync.merged) result.merged++;
        const contactId = sync.contactId;
        const count = async (recorded: Promise<unknown>) => {
          if (await recorded) result.events++;
        };

        await count(
          recordEvent({ contactId, type: "signed_up", dedupeKey: `signed_up:${user.id}`, occurredAt: user.createdAt, props: { via: "backfill" } })
        );

        const span = spanByUser.get(user.id);
        if (span?.first) {
          await db.contact.updateMany({ where: { id: contactId, firstDocumentAt: null }, data: { firstDocumentAt: span.first } });
          await count(
            recordEvent({ contactId, type: "first_document", dedupeKey: `first_document:${user.id}`, occurredAt: span.first, props: { via: "backfill" } })
          );
        }
        if (span?.last) {
          await db.contact.updateMany({
            where: { id: contactId, OR: [{ lastActiveAt: null }, { lastActiveAt: { lt: span.last } }] },
            data: { lastActiveAt: span.last },
          });
        }

        const sub = subByUser.get(user.id);
        if (sub) {
          // Live webhooks use their own dedupe keys; skip if any start is already on the timeline.
          const known = await db.contactEvent.findFirst({ where: { contactId, type: "subscription_started" }, select: { id: true } });
          if (!known) {
            await count(
              recordEvent({
                contactId,
                type: "subscription_started",
                dedupeKey: `subscription_started:backfill:${sub.id}`,
                occurredAt: sub.createdAt,
                props: { status: sub.status, variantId: sub.lsVariantId, via: "backfill" },
              })
            );
          }
        }

        for (const r of redemptionsByUser.get(user.id) ?? []) {
          await count(
            recordEvent({
              contactId,
              type: "code_redeemed",
              dedupeKey: `code_redeemed:${user.id}:${r.discountCode.code}`,
              occurredAt: r.redeemedAt,
              props: { code: r.discountCode.code, plan: r.discountCode.plan, grantDays: r.discountCode.grantDays, via: "backfill" },
            })
          );
        }

        await recomputeContact(contactId);
      } catch (err) {
        result.errors++;
        logGrowthError("backfill", err);
      }
    }

    cursor = users[users.length - 1].id;
    if (users.length < batchSize) break;
  }
  return result;
}
