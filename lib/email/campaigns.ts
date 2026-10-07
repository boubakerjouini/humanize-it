// ===========================================================
// lib/email/campaigns.ts — One-off marketing emails written in the admin
// (spec §5.5): draft → preview → test send → confirm with the typed recipient
// count → queued rows drained within the bulk budget.
//
// Safety rails, all enforced here rather than in the UI:
//   - a send needs status "tested" AND a content hash equal to the tested one,
//     so editing after the test forces a new test;
//   - the admin types the eligible count computed server-side at that moment;
//   - nothing goes out with the kill switch off or the circuit breaker tripped;
//   - every queued message is re-checked for consent when it is drained, so
//     someone who unsubscribes in between is skipped.
// Targets are a system segment ("sys:<key>"), a saved segment id, or the
// contacts-page filter carried inline as "filter:<base64url JSON>".
// ===========================================================

import { createHash } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import type { EmailCampaign, Prisma, User } from "@/app/generated/prisma/client";
import { adminEmails } from "@/lib/admin";
import { emailDomain, emailHash, normalizeEmail } from "@/lib/email/address";
import { remainingBudget } from "@/lib/email/budget";
import { checkEligibility, type SkipReason, type SuppressionScope } from "@/lib/email/eligibility";
import { TemplateNotImplementedError, buildRenderCtx, firstNameFrom, renderEmail } from "@/lib/email/render";
import { deliverBatch, prepareEmail, sendEmail, type Prepared, type SendOutcome } from "@/lib/email/send";
import { compileSegment, parseSegmentFilter, type SegmentFilter } from "@/lib/crm/segments";
import { resolveSegment } from "@/lib/crm/segment-resolve";
import { getOrCreateContactForUser, upsertLeadContact } from "@/lib/crm/contacts";
import { TOPICS, isTopic, type Topic } from "@/lib/growth/constants";
import { effectiveAllowlist, emailSendingMode, isAllowlisted, parseEmailList, postalAddress, type EmailSendingMode } from "@/lib/growth/flags";
import { withJobLock } from "@/lib/growth/locks";
import { logGrowthError } from "@/lib/growth/safe";

export const CAMPAIGN_STATUSES = ["draft", "tested", "sending", "sent", "cancelled"] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];
export const FILTER_REF_PREFIX = "filter:";
/** Upper bound on one campaign's audience (Resend free: 100 emails a day anyway). */
export const AUDIENCE_LIMIT = 5000;
const MAX_ATTEMPTS = 3;
const DRAIN_PAGE = 100;
/** Bounds one drain call even if rows keep bouncing between states. */
const MAX_DRAIN_PAGES = 60;

export const campaignDraftSchema = z.object({
  name: z.string().trim().min(1).max(120),
  topic: z.enum(TOPICS),
  segmentRef: z.string().trim().min(1).max(8000),
  subject: z.string().trim().min(1).max(150),
  preheader: z.string().trim().max(200).nullish(),
  bodyMd: z.string().trim().min(1).max(20_000),
});
export type CampaignDraft = z.infer<typeof campaignDraftSchema>;

export class CampaignError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 400
  ) {
    super(message);
    this.name = "CampaignError";
  }
}

// ── Pure helpers ────────────────────────────────────────────────────────────

type HashInput = { subject: string; preheader?: string | null; bodyMd: string; topic: string; segmentRef: string };

/** sha256 over everything a test send proves; any change means a new test. */
export function campaignContentHash(c: HashInput): string {
  return createHash("sha256")
    .update([c.subject, c.preheader ?? "", c.bodyMd, c.topic, c.segmentRef].join("\u0000"))
    .digest("hex");
}

/** Did an edit touch tested content? */
export function contentChanged(before: HashInput, after: HashInput): boolean {
  return campaignContentHash(before) !== campaignContentHash(after);
}

/** {{firstName}} → the recipient's first name, or "there". */
export function personalize(text: string, firstName: string | null | undefined): string {
  return text.replace(/\{\{\s*firstName\s*\}\}/g, firstName?.trim() || "there");
}

export type SendGuardInput = {
  status: string;
  storedHash: string | null;
  currentHash: string;
  confirmCount: number;
  eligible: number;
  mode: EmailSendingMode;
  breakerTripped: boolean;
};

/** Every rule a confirmed send must pass, in a stable order. */
export function checkSendGuard(i: SendGuardInput): { ok: true } | { ok: false; code: string; message: string } {
  if (i.mode === "off") return { ok: false, code: "SENDING_OFF", message: "Email sending is switched off (EMAIL_SENDING_ENABLED)." };
  if (i.breakerTripped) return { ok: false, code: "CIRCUIT_BREAKER", message: "The circuit breaker is tripped: check bounces and complaints first." };
  if (i.status !== "tested") return { ok: false, code: "NOT_TESTED", message: "Send a test email before sending the campaign." };
  if (!i.storedHash || i.storedHash !== i.currentHash) {
    return { ok: false, code: "CHANGED_SINCE_TEST", message: "The campaign changed after the test send. Send a new test." };
  }
  if (i.eligible === 0) return { ok: false, code: "NO_RECIPIENTS", message: "Nobody in this audience can receive the campaign." };
  if (!Number.isInteger(i.confirmCount) || i.confirmCount !== i.eligible) {
    return { ok: false, code: "COUNT_MISMATCH", message: `The audience is now ${i.eligible} recipients. Type that number to confirm.` };
  }
  return { ok: true };
}

export function encodeFilterRef(filter: SegmentFilter): string {
  return FILTER_REF_PREFIX + Buffer.from(JSON.stringify(filter), "utf8").toString("base64url");
}

export function decodeFilterRef(ref: string): SegmentFilter | null {
  if (!ref.startsWith(FILTER_REF_PREFIX)) return null;
  try {
    const parsed = parseSegmentFilter(JSON.parse(Buffer.from(ref.slice(FILTER_REF_PREFIX.length), "base64url").toString("utf8")));
    return parsed.ok ? parsed.filter : null;
  } catch {
    return null;
  }
}

// ── Audience ────────────────────────────────────────────────────────────────

export type Target = { ref: string; name: string; description: string | null; where: Prisma.ContactWhereInput; filter: SegmentFilter };

export async function resolveTarget(ref: string, now: Date = new Date()): Promise<Target | null> {
  const inline = decodeFilterRef(ref);
  if (inline) {
    const rules = inline.rules.length;
    return { ref, name: "Contacts filter", description: `${rules} rule${rules === 1 ? "" : "s"} from the contacts page`, where: compileSegment(inline, now), filter: inline };
  }
  if (ref.startsWith(FILTER_REF_PREFIX)) return null;
  const seg = await resolveSegment(ref, now);
  return seg ? { ref, name: seg.name, description: seg.description, where: seg.where, filter: seg.filter } : null;
}

export type ExclusionReason = SkipReason | "not_allowlisted";
export type Audience = {
  total: number;
  eligible: { contactId: string; email: string }[];
  excluded: Partial<Record<ExclusionReason, number>>;
  truncated: boolean;
};

/** The target segment, filtered by the same eligibility rules the send pipeline applies. */
export async function computeAudience(c: Pick<EmailCampaign, "segmentRef" | "topic">, now: Date = new Date()): Promise<Audience> {
  const target = await resolveTarget(c.segmentRef, now);
  if (!target) throw new CampaignError("BAD_SEGMENT", "The campaign's audience no longer exists.");
  const topic: Topic = isTopic(c.topic) ? c.topic : "tips";
  const contacts = await db.contact.findMany({
    where: { AND: [target.where, { email: { not: null } }] },
    select: { id: true, email: true, userId: true, lifecycleEmails: true, subscribedTopics: true, emailVerifiedAt: true, emailStatus: true },
    orderBy: { createdAt: "asc" },
    take: AUDIENCE_LIMIT + 1,
  });
  const truncated = contacts.length > AUDIENCE_LIMIT;
  const list = contacts.slice(0, AUDIENCE_LIMIT).map((ct) => ({ ...ct, email: normalizeEmail(ct.email) }));

  const hashes = list.flatMap((ct) => (ct.email ? [emailHash(ct.email)] : []));
  const suppressions = hashes.length
    ? await db.emailSuppression.findMany({ where: { emailHash: { in: hashes } }, select: { emailHash: true, scope: true } })
    : [];
  const scopesByHash = new Map<string, SuppressionScope[]>();
  for (const s of suppressions) {
    if (s.scope !== "all" && s.scope !== "nonessential" && s.scope !== "marketing") continue;
    scopesByHash.set(s.emailHash, [...(scopesByHash.get(s.emailHash) ?? []), s.scope]);
  }

  const mode = emailSendingMode();
  const admins = adminEmails();
  const postal = postalAddress() !== null;
  const eligible: Audience["eligible"] = [];
  const excluded: Audience["excluded"] = {};
  for (const ct of list) {
    const verdict = checkEligibility({
      contact: ct,
      stream: "marketing",
      topic,
      suppressions: ct.email ? (scopesByHash.get(emailHash(ct.email)) ?? []) : [],
      now,
      postalAddressConfigured: postal,
    });
    let reason: ExclusionReason | null = verdict.ok ? null : verdict.reason;
    // Outside production only allowlisted inboxes get mail: count what will really go out.
    if (!reason && mode === "allowlist" && !isAllowlisted(ct.email, admins)) reason = "not_allowlisted";
    if (reason || !ct.email) {
      const key = reason ?? "no_email";
      excluded[key] = (excluded[key] ?? 0) + 1;
    } else {
      eligible.push({ contactId: ct.id, email: ct.email });
    }
  }
  return { total: list.length, eligible, excluded, truncated };
}

// ── CRUD ────────────────────────────────────────────────────────────────────

const EDITABLE: readonly string[] = ["draft", "tested"];

export async function createCampaign(input: CampaignDraft, admin: Pick<User, "email">): Promise<EmailCampaign> {
  if (!(await resolveTarget(input.segmentRef))) throw new CampaignError("BAD_SEGMENT", "Unknown audience.");
  return db.emailCampaign.create({
    data: { ...input, preheader: input.preheader || null, status: "draft", createdBy: admin.email },
  });
}

/** Content edits drop the campaign back to draft: the test no longer proves anything. */
export async function updateCampaign(id: string, input: CampaignDraft): Promise<EmailCampaign> {
  const current = await db.emailCampaign.findUnique({ where: { id } });
  if (!current) throw new CampaignError("NOT_FOUND", "Campaign not found.", 404);
  if (!EDITABLE.includes(current.status)) throw new CampaignError("LOCKED", "A campaign can't be edited once it has been sent.", 409);
  if (input.segmentRef !== current.segmentRef && !(await resolveTarget(input.segmentRef))) {
    throw new CampaignError("BAD_SEGMENT", "Unknown audience.");
  }
  const next = { ...input, preheader: input.preheader || null };
  const reset = contentChanged(current, next);
  const res = await db.emailCampaign.updateMany({
    where: { id, status: { in: [...EDITABLE] } },
    data: { ...next, ...(reset ? { status: "draft", contentHash: null } : {}) },
  });
  if (res.count !== 1) throw new CampaignError("LOCKED", "The campaign is being sent; edits are closed.", 409);
  return (await db.emailCampaign.findUnique({ where: { id } }))!;
}

export async function deleteCampaign(id: string): Promise<EmailCampaign> {
  const current = await db.emailCampaign.findUnique({ where: { id } });
  if (!current) throw new CampaignError("NOT_FOUND", "Campaign not found.", 404);
  const res = await db.emailCampaign.deleteMany({ where: { id, status: { in: [...EDITABLE] } } });
  if (res.count !== 1) throw new CampaignError("LOCKED", "Only drafts can be deleted; cancel a sending campaign instead.", 409);
  return current;
}

export type CampaignStats = { queued: number; sent: number; delivered: number; bounced: number; complained: number; skipped: number; failed: number; cancelled: number };

/** Message counts per campaign. "sent" counts everything that left (delivered and bounced included). */
export async function campaignStats(ids: string[]): Promise<Map<string, CampaignStats>> {
  const out = new Map<string, CampaignStats>();
  if (ids.length === 0) return out;
  const rows = await db.emailMessage.groupBy({ by: ["campaignId", "status"], where: { campaignId: { in: ids } }, _count: { _all: true } });
  for (const r of rows) {
    if (!r.campaignId) continue;
    const s = out.get(r.campaignId) ?? { queued: 0, sent: 0, delivered: 0, bounced: 0, complained: 0, skipped: 0, failed: 0, cancelled: 0 };
    const n = r._count._all;
    switch (r.status) {
      case "queued":
      case "sending":
        s.queued += n;
        break;
      case "sent":
        s.sent += n;
        break;
      case "delivered":
        s.sent += n;
        s.delivered += n;
        break;
      case "bounced":
        s.sent += n;
        s.bounced += n;
        break;
      case "complained":
        s.sent += n;
        s.delivered += n;
        s.complained += n;
        break;
      case "failed":
        s.failed += n;
        break;
      case "cancelled":
        s.cancelled += n;
        break;
      default:
        s.skipped += n;
    }
    out.set(r.campaignId, s);
  }
  return out;
}

async function loadCampaign(id: string): Promise<EmailCampaign> {
  const c = await db.emailCampaign.findUnique({ where: { id } });
  if (!c) throw new CampaignError("NOT_FOUND", "Campaign not found.", 404);
  return c;
}

function campaignTopic(c: Pick<EmailCampaign, "topic">): Topic {
  return isTopic(c.topic) ? c.topic : "tips";
}

function campaignProps(c: EmailCampaign, firstName: string | null) {
  return {
    subject: personalize(c.subject, firstName),
    ...(c.preheader ? { preheader: personalize(c.preheader, firstName) } : {}),
    bodyMd: personalize(c.bodyMd, firstName),
  };
}

// ── Preview, test, send ─────────────────────────────────────────────────────

/** Render for the admin's own contact and count the audience. Route handlers only (react-email render). */
export async function previewCampaign(id: string, admin: Pick<User, "email" | "name">) {
  const c = await loadCampaign(id);
  const ownEmail = normalizeEmail(admin.email);
  const own = ownEmail ? await db.contact.findUnique({ where: { email: ownEmail }, select: { id: true, name: true } }) : null;
  const firstName = firstNameFrom(own?.name ?? admin.name);
  const ctx = buildRenderCtx({ contactId: own?.id ?? null, template: "campaign", topic: campaignTopic(c), firstName });
  let rendered: { subject: string; html: string; text: string };
  try {
    rendered = await renderEmail("campaign", campaignProps(c, firstName), ctx);
  } catch (err) {
    if (err instanceof TemplateNotImplementedError) {
      throw new CampaignError("TEMPLATE_MISSING", "The campaign email template isn't built yet (emails/admin).", 503);
    }
    throw err;
  }
  const audience = await computeAudience(c);
  return {
    ...rendered,
    recipients: { total: audience.total, eligible: audience.eligible.length, excluded: audience.excluded, truncated: audience.truncated },
    hash: campaignContentHash(c),
  };
}

/**
 * Where a test may go: only allowlisted inboxes (EMAIL_ALLOWLIST plus
 * ADMIN_EMAILS) ever receive one, in every mode. The admin's own address
 * comes first when it is on that list, then the EMAIL_ALLOWLIST test inboxes
 * in the order EMAIL_ALLOWLIST lists them, then other admins, so the default
 * pick never lands in someone else's real inbox.
 */
export function testRecipients(adminEmail: string): { own: string; ownAllowed: boolean; choices: string[] } {
  const own = normalizeEmail(adminEmail) ?? "";
  const ownAllowed = !!own && isAllowlisted(own, adminEmails());
  // Configured order: list delivered@resend.dev first so the default isn't a simulated bounce.
  const testInboxes = [...new Set(parseEmailList(process.env.EMAIL_ALLOWLIST))].filter((e) => e !== own);
  const otherAdmins = [...effectiveAllowlist(adminEmails())].filter((e) => e !== own && !testInboxes.includes(e)).sort();
  return { own, ownAllowed, choices: [...(ownAllowed ? [own] : []), ...testInboxes, ...otherAdmins] };
}

/**
 * Send the campaign with "[TEST]" in the subject, to the admin's own inbox or
 * another allowlisted test inbox (`to`). A delivered test marks it tested.
 */
export async function testSendCampaign(
  id: string,
  admin: Pick<User, "id" | "email" | "name">,
  opts: { to?: string } = {}
): Promise<SendOutcome> {
  if (emailSendingMode() === "off") throw new CampaignError("SENDING_OFF", "Email sending is switched off (EMAIL_SENDING_ENABLED).", 409);
  const c = await loadCampaign(id);
  if (!EDITABLE.includes(c.status)) throw new CampaignError("LOCKED", "This campaign has already been sent.", 409);
  const to = (opts.to ? normalizeEmail(opts.to) : null) ?? "";
  const toOther = !!to && to !== normalizeEmail(admin.email);
  if (toOther && !testRecipients(admin.email).choices.includes(to)) {
    throw new CampaignError("NOT_ALLOWLISTED", "Tests only go to allowlisted inboxes (EMAIL_ALLOWLIST or ADMIN_EMAILS).", 400);
  }
  // A test inbox such as delivered@resend.dev gets a plain contact row, like any address we email.
  const contactId = toOther
    ? ((await upsertLeadContact({ email: to, source: "manual" }))?.contactId ?? null)
    : await getOrCreateContactForUser(admin.id);
  if (!contactId) throw new CampaignError("NO_CONTACT", "No contact record for the test inbox.", 409);
  const firstName = firstNameFrom(admin.name);
  const hash = campaignContentHash(c);
  const outcome = await sendEmail({
    contactId,
    template: "campaign",
    props: campaignProps(c, firstName),
    dedupeKey: `test:${c.id}:${Date.now()}`,
    pool: "inline",
    topicOverride: campaignTopic(c),
    isTest: true,
  });
  if (outcome.status === "sent" || outcome.status === "duplicate") {
    await db.emailCampaign.updateMany({
      where: { id, status: { in: [...EDITABLE] }, updatedAt: c.updatedAt },
      data: { status: "tested", contentHash: hash, testSentAt: new Date(), testSentTo: toOther ? to : admin.email },
    });
  }
  return outcome;
}

/**
 * Confirmed send: re-checks every guard against the database, then queues one
 * message per eligible contact in the same transaction that flips the status.
 * Draining happens afterwards (after() in the route, then the daily job).
 */
export async function sendCampaign(id: string, admin: Pick<User, "email">, confirmCount: number): Promise<{ queued: number }> {
  const c = await loadCampaign(id);
  const now = new Date();
  const audience = await computeAudience(c, now);
  const { breakerState } = await import("@/lib/email/circuit-breaker");
  const guard = checkSendGuard({
    status: c.status,
    storedHash: c.contentHash,
    currentHash: campaignContentHash(c),
    confirmCount,
    eligible: audience.eligible.length,
    mode: emailSendingMode(),
    breakerTripped: (await breakerState(now)).tripped,
  });
  if (!guard.ok) throw new CampaignError(guard.code, guard.message, 409);

  const target = await resolveTarget(c.segmentRef, now);
  const topic = campaignTopic(c);
  await db.$transaction(async (tx) => {
    const flipped = await tx.emailCampaign.updateMany({
      where: { id, status: "tested", contentHash: c.contentHash },
      data: {
        status: "sending",
        confirmedAt: now,
        confirmedBy: admin.email,
        recipientCount: audience.eligible.length,
        filterSnapshot: { ref: c.segmentRef, name: target?.name ?? null, filter: target?.filter ?? null, excluded: audience.excluded } as Prisma.InputJsonValue,
      },
    });
    if (flipped.count !== 1) throw new CampaignError("CONFLICT", "The campaign changed while confirming. Reload and try again.", 409);
    await tx.emailMessage.createMany({
      data: audience.eligible.map((r) => ({
        contactId: r.contactId,
        toEmailHash: emailHash(r.email),
        toDomain: emailDomain(r.email),
        template: "campaign",
        stream: "marketing",
        topic,
        dedupeKey: `camp:${id}:${r.contactId}`,
        status: "queued",
        campaignId: id,
      })),
      skipDuplicates: true,
    });
  });
  return { queued: audience.eligible.length };
}

/** Stop a campaign: queued messages are cancelled; what already left stays sent. */
export async function cancelCampaign(id: string): Promise<{ cancelled: number }> {
  const c = await loadCampaign(id);
  if (c.status === "sent" || c.status === "cancelled") throw new CampaignError("LOCKED", `The campaign is already ${c.status}.`, 409);
  const res = await db.emailMessage.updateMany({ where: { campaignId: id, status: { in: ["queued", "failed"] } }, data: { status: "cancelled" } });
  await db.emailCampaign.update({ where: { id }, data: { status: "cancelled", completedAt: new Date() } });
  return { cancelled: res.count };
}

// ── Draining ────────────────────────────────────────────────────────────────

export type DrainStats = { sent: number; skipped: number; failed: number; deferred: number; stoppedReason: string | null; completed: boolean };

const pendingWhere = (campaignId: string): Prisma.EmailMessageWhereInput => ({
  campaignId,
  OR: [{ status: { in: ["queued", "sending"] } }, { status: "failed", attempts: { lt: MAX_ATTEMPTS } }],
});

async function drainOnce(c: EmailCampaign, deadlineMs: number | undefined, stats: DrainStats): Promise<void> {
  const topic = campaignTopic(c);
  const runStart = new Date();
  let slots = await remainingBudget("bulk");
  for (let page = 0; slots > 0 && !stats.stoppedReason && page < MAX_DRAIN_PAGES; page++) {
    if (deadlineMs && Date.now() > deadlineMs) {
      stats.stoppedReason = "deadline";
      return;
    }
    // Rows without a contact (deleted since) can never be sent.
    await db.emailMessage.updateMany({ where: { campaignId: c.id, status: "queued", contactId: null }, data: { status: "cancelled", skipReason: "contact_missing" } });
    const rows = await db.emailMessage.findMany({
      where: {
        campaignId: c.id,
        contactId: { not: null },
        // A row that failed during this run waits for the next one instead of burning its attempts now.
        OR: [{ status: "queued" }, { status: "failed", attempts: { lt: MAX_ATTEMPTS }, updatedAt: { lt: runStart } }],
      },
      select: { id: true, dedupeKey: true, contactId: true, contact: { select: { name: true } } },
      orderBy: { queuedAt: "asc" },
      take: Math.min(slots, DRAIN_PAGE),
    });
    if (rows.length === 0) return;

    const batch: Prepared[] = [];
    for (const row of rows) {
      const firstName = firstNameFrom(row.contact?.name);
      const res = await prepareEmail({
        contactId: row.contactId!,
        template: "campaign",
        props: campaignProps(c, firstName),
        dedupeKey: row.dedupeKey,
        pool: "bulk",
        campaignId: c.id,
        topicOverride: topic,
      });
      if (res.ok) {
        batch.push(res.prepared);
        continue;
      }
      const o = res.outcome;
      if (o.status === "skipped") {
        stats.skipped++;
        // A skip recorded nowhere (contact gone) would otherwise stay queued forever.
        if (!o.messageId) await db.emailMessage.updateMany({ where: { id: row.id, status: "queued" }, data: { status: "cancelled", skipReason: o.reason } });
      }
      else if (o.status === "failed") stats.failed++;
      else if (o.status === "deferred") {
        stats.deferred++;
        if (o.reason === "allowlist") {
          // Will never pass in this mode: close the row so the campaign can complete.
          await db.emailMessage.updateMany({ where: { id: row.id, status: "queued" }, data: { status: "cancelled", skipReason: "not_allowlisted" } });
        } else {
          stats.stoppedReason = o.reason;
          break;
        }
      }
    }
    if (batch.length > 0) {
      const outcomes = await deliverBatch(batch);
      for (const o of outcomes) {
        if (o.status === "sent" || o.status === "duplicate") stats.sent++;
        else if (o.status === "failed") {
          stats.failed++;
          if (o.quotaExceeded) stats.stoppedReason = "quota_exceeded";
        }
      }
    }
    // Skipped and closed rows leave the queue without spending budget.
    slots -= batch.length;
  }
  if (slots <= 0 && !stats.stoppedReason) stats.stoppedReason = "budget";
}

/** Send what is queued for one campaign within today's bulk budget; marks it sent when nothing is left. */
export async function drainCampaign(id: string, opts: { deadlineMs?: number } = {}): Promise<DrainStats> {
  const stats: DrainStats = { sent: 0, skipped: 0, failed: 0, deferred: 0, stoppedReason: null, completed: false };
  if (emailSendingMode() === "off") {
    stats.stoppedReason = "disabled";
    return stats;
  }
  const run = await withJobLock(`campaign:${id}`, 5 * 60_000, async () => {
    const c = await db.emailCampaign.findUnique({ where: { id } });
    if (!c || c.status !== "sending") return;
    await drainOnce(c, opts.deadlineMs, stats);
    const left = await db.emailMessage.count({ where: pendingWhere(id) });
    if (left === 0) {
      await db.emailCampaign.updateMany({ where: { id, status: "sending" }, data: { status: "sent", completedAt: new Date() } });
      stats.completed = true;
    }
  });
  if (run.locked) stats.stoppedReason = "locked";
  return stats;
}

/** Daily job step 5: drain every sending campaign, oldest first. */
export async function drainCampaigns(opts: { deadlineMs?: number } = {}): Promise<{ campaigns: number; sent: number; completed: number; stoppedReason: string | null }> {
  const out = { campaigns: 0, sent: 0, completed: 0, stoppedReason: null as string | null };
  const sending = await db.emailCampaign.findMany({ where: { status: "sending" }, orderBy: { confirmedAt: "asc" }, select: { id: true } });
  for (const { id } of sending) {
    try {
      const s = await drainCampaign(id, opts);
      out.campaigns++;
      out.sent += s.sent;
      if (s.completed) out.completed++;
      if (s.stoppedReason && s.stoppedReason !== "locked" && s.stoppedReason !== "budget") {
        out.stoppedReason = s.stoppedReason;
        break;
      }
      if (s.stoppedReason === "budget") {
        out.stoppedReason = "budget";
        break;
      }
    } catch (err) {
      logGrowthError("campaign-drain", err);
    }
  }
  return out;
}
