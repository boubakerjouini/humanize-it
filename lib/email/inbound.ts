// ===========================================================
// lib/email/inbound.ts — Forwards mail sent to @humanizeit.app to the founder.
//
// Each email.received webhook is forwarded as-is (Resend passthrough: original
// body, headers and attachments) to the admin inbox, and opens a CRM task so no
// support email is lost. Inbound mail is untrusted input: nothing here reads or
// acts on its body. Only the envelope (sender, subject) is used, for the
// loop guard, the daily caps and the task title. A retry of the same webhook
// reuses the idempotency key and the task's dedupe key, so it never doubles up.
// ===========================================================

import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { adminEmails } from "@/lib/admin";
import { getResend } from "@/lib/email/resend-client";
import { utcDay } from "@/lib/growth/daily-metrics";
import { isUniqueViolation, logGrowthError } from "@/lib/growth/safe";
import {
  INBOUND_DAILY_CAP,
  INBOUND_SENDER_DAILY_CAP,
  bareAddress,
  forwardTargets,
  inboundTaskTitle,
  isOwnAddress,
} from "@/lib/email/inbound-rules";

const FORWARD_FROM = "HumanizeIt Inbox <inbox@mail.humanizeit.app>";
const DAY_MS = 86_400_000;

export type InboundEnvelope = {
  emailId: string;
  from: string;
  to: string[];
  subject: string | null;
};

export type InboundResult =
  | { status: "forwarded"; forwardId: string }
  | { status: "skipped"; reason: "own_domain" | "not_configured" | "daily_cap" | "sender_cap" };

/** Count one use of today's slot for `key`; false once the cap is passed. */
async function claimSlot(key: string, cap: number): Promise<boolean> {
  const day = utcDay();
  const row = await db.dailyMetric.upsert({
    where: { day_key: { day, key } },
    create: { day, key, count: 1 },
    update: { count: { increment: 1 } },
    select: { count: true },
  });
  return row.count <= cap;
}

/** Best effort: a task in /admin/tasks so the email gets a reply. Never throws. */
async function openReplyTask(envelope: InboundEnvelope): Promise<void> {
  try {
    const sender = bareAddress(envelope.from);
    const contact = await db.contact.findUnique({ where: { email: sender }, select: { id: true } });
    await db.crmTask.create({
      data: {
        contactId: contact?.id ?? null,
        title: inboundTaskTitle(envelope.from, envelope.subject),
        body: `Received at ${envelope.to.join(", ")} and forwarded to your inbox. Reply from there, then complete this task.`,
        kind: "email",
        priority: "normal",
        source: "request",
        ruleKey: "inbound_email",
        dedupeKey: `inbound:${envelope.emailId}`,
        dueAt: new Date(Date.now() + DAY_MS),
        createdBy: "inbound-email",
      },
    });
  } catch (err) {
    if (!isUniqueViolation(err)) logGrowthError("inbound-task", err);
  }
}

/**
 * Forward one received email to the founder and open its reply task. Throws
 * only when Resend refuses the forward, so the webhook answers 500 and Resend
 * retries (same idempotency key: no duplicate).
 */
export async function forwardInbound(envelope: InboundEnvelope): Promise<InboundResult> {
  if (isOwnAddress(envelope.from)) return { status: "skipped", reason: "own_domain" };

  const resend = getResend();
  const targets = forwardTargets(process.env.INBOUND_FORWARD_TO, [...adminEmails()]);
  if (!resend || targets.length === 0) return { status: "skipped", reason: "not_configured" };

  if (!(await claimSlot("inbound.forwarded", INBOUND_DAILY_CAP))) return { status: "skipped", reason: "daily_cap" };
  const senderKey = `inbound.sender.${createHash("sha256").update(bareAddress(envelope.from)).digest("hex").slice(0, 16)}`;
  if (!(await claimSlot(senderKey, INBOUND_SENDER_DAILY_CAP))) return { status: "skipped", reason: "sender_cap" };

  const { data, error } = await resend.emails.receiving.forward(
    { emailId: envelope.emailId, to: targets, from: FORWARD_FROM, passthrough: true },
    { idempotencyKey: `inbound-forward/${envelope.emailId}` }
  );
  if (error || !data) throw new Error(`inbound forward failed: ${error?.name ?? "no data"}`);

  await openReplyTask(envelope);
  return { status: "forwarded", forwardId: data.id };
}
