// ===========================================================
// /api/admin/email/pending-confirmations — "Send confirmation to N pending contacts"
//   GET   how many contacts have topics waiting for double opt-in (older than 1 hour)
//   POST  send them the confirmation again: waitlist_confirm when only the
//         extension waitlist is pending, doi_confirm otherwise. The dedupe key
//         doi:<contactId>:<yyyy-mm-dd> allows one per contact per day.
// Audited as email.doi.resend.
// ===========================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { Prisma } from "@/app/generated/prisma/client";
import { requireAdmin } from "@/lib/admin";
import { logAudit } from "@/lib/audit";
import { genericConfirmUrl, waitlistConfirmUrl } from "@/lib/email/links";
import { deliverBatch, prepareEmail, type Prepared } from "@/lib/email/send";
import { isTopic } from "@/lib/growth/constants";
import { emailSendingMode } from "@/lib/growth/flags";
import { fail, handleError } from "../_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const LIMIT = 200;

function pendingWhere(now: Date): Prisma.ContactWhereInput {
  return {
    email: { not: null },
    emailStatus: "ok",
    pendingTopics: { isEmpty: false },
    // Give the original confirmation an hour before nudging.
    consents: { none: { createdAt: { gt: new Date(now.getTime() - 3_600_000) } } },
  };
}

export async function GET() {
  try {
    await requireAdmin();
    const count = await db.contact.count({ where: pendingWhere(new Date()) });
    return NextResponse.json({ count });
  } catch (err) {
    return handleError("admin-pending-confirmations", err);
  }
}

export async function POST() {
  try {
    const admin = await requireAdmin();
    if (emailSendingMode() === "off") return fail("SENDING_OFF", "Email sending is switched off (EMAIL_SENDING_ENABLED).", 409);
    const now = new Date();
    const day = now.toISOString().slice(0, 10);
    const contacts = await db.contact.findMany({
      where: pendingWhere(now),
      select: { id: true, pendingTopics: true },
      orderBy: { createdAt: "asc" },
      take: LIMIT,
    });

    const outcome = { contacts: contacts.length, sent: 0, skipped: 0, deferred: 0, failed: 0, duplicate: 0 };
    const batch: Prepared[] = [];
    for (const c of contacts) {
      const topics = c.pendingTopics.filter(isTopic);
      const dedupeKey = `doi:${c.id}:${day}`;
      const waitlistOnly = topics.length > 0 && topics.every((t) => t === "extension_launch");
      const res = waitlistOnly
        ? await prepareEmail({ contactId: c.id, template: "waitlist_confirm", props: { confirmUrl: waitlistConfirmUrl(c.id) }, dedupeKey, pool: "bulk" })
        : await prepareEmail({ contactId: c.id, template: "doi_confirm", props: { confirmUrl: genericConfirmUrl(c.id), topics }, dedupeKey, pool: "bulk" });
      if (res.ok) {
        batch.push(res.prepared);
        continue;
      }
      const o = res.outcome;
      if (o.status === "duplicate") outcome.duplicate++;
      else if (o.status === "skipped") outcome.skipped++;
      else if (o.status === "failed") outcome.failed++;
      else if (o.status === "deferred") {
        outcome.deferred++;
        if (o.reason === "budget" || o.reason === "disabled" || o.reason === "flow_off") break;
      }
    }
    if (batch.length) {
      for (const o of await deliverBatch(batch)) {
        if (o.status === "sent" || o.status === "duplicate") outcome.sent++;
        else if (o.status === "failed") outcome.failed++;
      }
    }
    await logAudit({
      actorEmail: admin.email,
      action: "email.doi.resend",
      targetType: "email",
      summary: `Resent confirmation to ${outcome.sent} of ${outcome.contacts} pending contacts`,
      meta: outcome,
    });
    return NextResponse.json({ ok: true, ...outcome });
  } catch (err) {
    return handleError("admin-pending-confirmations", err);
  }
}
