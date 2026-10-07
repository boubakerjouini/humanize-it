// ===========================================================
// lib/crm/contact-360.ts — Everything the admin sees about one contact.
//
// The contact row itself must load; every other panel (emails, enrollments,
// tasks, notes, referral, timeline) is its own query with a .catch fallback,
// so one missing table or slow join degrades a panel instead of the page.
// The activity timeline merges ContactEvent, EmailMessage, ConsentRecord,
// AdminNote, completed CrmTasks and AuditLog into one shape: {at, kind, title,
// detail, actor}.
// ===========================================================

import { db } from "@/lib/db";
import { effectivePlanId } from "@/lib/quota";
import { emailHash } from "@/lib/email/address";
import { emailSendingMode, referralsEnabled } from "@/lib/growth/flags";
import { availableBonusWords } from "@/lib/crm/bonus";
import { listContactTags } from "@/lib/crm/tags";
import { evaluate, loadScoringInput } from "@/lib/crm/recompute";
import { gradeFor, type ScoreLine } from "@/lib/crm/scoring";
import { STAGE_LABELS, isStage } from "@/lib/crm/lifecycle";
import { logGrowthError } from "@/lib/growth/safe";

export type ContactType = "user" | "lead" | "prospect";

export function contactType(c: { userId: string | null; email: string | null }): ContactType {
  if (c.userId) return "user";
  return c.email ? "lead" : "prospect";
}

/** Paying subscription statuses (past_due is still a customer). */
const PAYING_STATUSES = new Set(["active", "on_trial", "past_due"]);

// ── Timeline ────────────────────────────────────────────────────────────────

export type TimelineKind = "event" | "email" | "consent" | "note" | "task" | "audit";
export type TimelineItem = {
  id: string;
  at: Date;
  kind: TimelineKind;
  type: string;
  title: string;
  detail: string | null;
  actor: string | null;
};

type Props = Record<string, unknown>;

function asProps(value: unknown): Props {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Props) : {};
}

const CHANNEL_NAMES: Record<string, string> = { whatsapp: "WhatsApp", linkedin: "LinkedIn", dm: "DM", in_person: "in person" };
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);
const humanize = (s: string) => s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
const stageLabel = (s: unknown) => (isStage(s) ? STAGE_LABELS[s] : str(s) ?? "?");

/** Compact "key: value" detail for props without a dedicated description. */
function propsDetail(p: Props): string | null {
  const parts = Object.entries(p)
    .filter(([, v]) => v !== null && v !== undefined && typeof v !== "object")
    .slice(0, 5)
    .map(([k, v]) => `${k}: ${String(v)}`);
  return parts.length ? parts.join(" · ") : null;
}

/** Readable title and detail for a ContactEvent. Pure. */
export function describeEvent(type: string, rawProps: unknown): { title: string; detail: string | null } {
  const p = asProps(rawProps);
  switch (type) {
    case "signed_up":
      return { title: "Signed up", detail: null };
    case "first_document":
      return { title: "Ran a first document", detail: null };
    case "document_analyzed":
    case "document_humanized":
    case "document_uploaded":
      return { title: humanize(type), detail: typeof p.words === "number" ? `${p.words.toLocaleString("en-US")} words` : null };
    case "quota_hit":
      return { title: "Hit a limit", detail: [str(p.kind), str(p.plan)].filter(Boolean).join(" · ") || null };
    case "checkout_started":
      return { title: `Started a ${str(p.plan) ?? ""} checkout`.replace(/\s+/g, " "), detail: p.annual ? "annual" : null };
    case "stage_changed":
      return { title: `Stage: ${stageLabel(p.from)} → ${stageLabel(p.to)}`, detail: str(p.reason) };
    case "stage_overridden":
      return { title: p.to ? `Stage pinned to ${stageLabel(p.to)}` : "Stage override cleared", detail: null };
    case "pipeline_changed":
      return { title: `Pipeline: ${humanize(str(p.from) ?? "none")} → ${humanize(str(p.to) ?? "none")}`, detail: null };
    case "outreach_touch":
      return {
        title: `Outreach touch via ${CHANNEL_NAMES[str(p.channel) ?? ""] ?? humanize(str(p.channel) ?? "unknown")}`,
        detail: [str(p.outcome) && humanize(String(p.outcome)), str(p.script) && `script ${p.script}`, str(p.note)].filter(Boolean).join(" · ") || null,
      };
    case "note":
      return { title: "Note", detail: str(p.body) };
    case "lead_captured":
      return { title: "Lead captured", detail: [str(p.source), str(p.magnet)].filter(Boolean).join(" · ") || null };
    case "bonus_granted":
      return { title: `Bonus words granted`, detail: [typeof p.words === "number" ? `${p.words} words` : null, str(p.reason)].filter(Boolean).join(" · ") || null };
    case "plan_changed":
      return { title: `Plan set to ${str(p.plan) ?? "?"}`, detail: [str(p.action), typeof p.days === "number" ? `${p.days} days` : null].filter(Boolean).join(" · ") || null };
    default:
      return { title: humanize(type), detail: propsDetail(p) };
  }
}

/** Admin actions the timeline already shows as their own event; their audit rows would be duplicates. */
const AUDIT_SHOWN_AS_EVENT = new Set(["contact.touch", "contact.pipeline.set", "contact.stage.override", "note.add", "contact.bonus.grant"]);

const CONSENT_ACTION: Record<string, string> = { grant: "Subscribed to", confirm: "Confirmed", withdraw: "Unsubscribed from" };

/** Merged activity, newest first. Each source is its own query; a failing one is skipped. */
export async function loadTimeline(contactId: string, opts: { userId?: string | null; limit?: number } = {}): Promise<TimelineItem[]> {
  const limit = opts.limit ?? 100;
  const userId = opts.userId ?? null;
  const [events, emails, consents, notes, tasks, audits] = await Promise.all([
    db.contactEvent.findMany({ where: { contactId }, orderBy: { occurredAt: "desc" }, take: limit }).catch(() => []),
    db.emailMessage
      .findMany({
        where: { contactId },
        orderBy: { queuedAt: "desc" },
        take: limit,
        select: { id: true, template: true, subject: true, status: true, skipReason: true, queuedAt: true, sentAt: true, stream: true },
      })
      .catch(() => []),
    db.consentRecord.findMany({ where: { contactId }, orderBy: { createdAt: "desc" }, take: limit }).catch(() => []),
    userId ? db.adminNote.findMany({ where: { subjectId: userId }, orderBy: { createdAt: "desc" }, take: limit }).catch(() => []) : Promise.resolve([]),
    db.crmTask
      .findMany({ where: { contactId, status: "done", completedAt: { not: null } }, orderBy: { completedAt: "desc" }, take: limit })
      .catch(() => []),
    db.auditLog
      .findMany({
        where: { OR: [{ targetType: "contact", targetId: contactId }, ...(userId ? [{ targetType: "user", targetId: userId }] : [])] },
        orderBy: { createdAt: "desc" },
        take: limit,
      })
      .catch(() => []),
  ]);

  const items: TimelineItem[] = [
    // Notes on leads are "note" events; they're listed in the Notes panel and here.
    ...events.map((e) => ({ id: `ev_${e.id}`, at: e.occurredAt, kind: "event" as const, type: e.type, ...describeEvent(e.type, e.props), actor: e.actor === "system" ? null : e.actor })),
    ...emails.map((m) => ({
      id: `em_${m.id}`,
      at: m.sentAt ?? m.queuedAt,
      kind: "email" as const,
      type: m.status,
      title: `Email: ${m.subject ?? m.template}`,
      detail: [m.stream, m.status, m.skipReason].filter(Boolean).join(" · "),
      actor: null,
    })),
    ...consents.map((c) => ({
      id: `cr_${c.id}`,
      at: c.createdAt,
      kind: "consent" as const,
      type: c.action,
      title: `${CONSENT_ACTION[c.action] ?? humanize(c.action)} ${c.topic}`,
      detail: [c.method, c.source].filter(Boolean).join(" · ") || null,
      actor: c.actor,
    })),
    ...notes.map((n) => ({ id: `nt_${n.id}`, at: n.createdAt, kind: "note" as const, type: "note", title: "Note", detail: n.body, actor: n.authorEmail })),
    ...tasks.map((t) => ({
      id: `tk_${t.id}`,
      at: t.completedAt as Date,
      kind: "task" as const,
      type: t.kind,
      title: `Task done: ${t.title}`,
      detail: t.ruleKey ? `rule ${t.ruleKey}` : null,
      actor: t.completedBy,
    })),
    ...audits.filter((a) => !AUDIT_SHOWN_AS_EVENT.has(a.action)).map((a) => ({ id: `au_${a.id}`, at: a.createdAt, kind: "audit" as const, type: a.action, title: a.summary || a.action, detail: a.action, actor: a.actorEmail })),
  ];
  return items.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, limit);
}

// ── Notes ───────────────────────────────────────────────────────────────────

export type ContactNote = { id: string; source: "admin_note" | "event"; body: string; author: string; createdAt: Date };

/** Account contacts keep notes as AdminNote (shared with the customer page); leads as "note" events. */
export async function loadNotes(contactId: string, userId: string | null): Promise<ContactNote[]> {
  const [adminNotes, eventNotes] = await Promise.all([
    userId ? db.adminNote.findMany({ where: { subjectId: userId }, orderBy: { createdAt: "desc" }, take: 50 }).catch(() => []) : Promise.resolve([]),
    db.contactEvent.findMany({ where: { contactId, type: "note" }, orderBy: { occurredAt: "desc" }, take: 50 }).catch(() => []),
  ]);
  return [
    ...adminNotes.map((n) => ({ id: n.id, source: "admin_note" as const, body: n.body, author: n.authorEmail, createdAt: n.createdAt })),
    ...eventNotes.map((e) => ({ id: e.id, source: "event" as const, body: str(asProps(e.props).body) ?? "", author: e.actor, createdAt: e.occurredAt })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

// ── 360 payload ─────────────────────────────────────────────────────────────

function parseBreakdown(value: unknown): ScoreLine[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((l) => {
    const line = asProps(l);
    return typeof line.key === "string" && typeof line.points === "number"
      ? [{ key: line.key, label: str(line.label) ?? line.key, points: line.points, detail: str(line.detail) ?? "" }]
      : [];
  });
}

export async function buildContact360(contactId: string, now: Date = new Date()) {
  const contact = await db.contact.findUnique({ where: { id: contactId } });
  if (!contact) return null;
  const userId = contact.userId;

  const [user, lastRedemption, emails, enrollments, tasks, notes, tags, consents, suppressions, referredBy, referralStats, timeline, live] = await Promise.all([
    userId
      ? db.user
          .findUnique({
            where: { id: userId },
            select: {
              id: true,
              email: true,
              name: true,
              plan: true,
              role: true,
              planExpiresAt: true,
              wordsUsed: true,
              rewriteCount: true,
              createdAt: true,
              subscription: { select: { status: true, lsCurrentPeriodEnd: true } },
              _count: { select: { documents: true } },
            },
          })
          .catch(() => null)
      : Promise.resolve(null),
    userId
      ? db.redemption
          .findFirst({ where: { userId }, orderBy: { redeemedAt: "desc" }, select: { discountCode: { select: { code: true } } } })
          .catch(() => null)
      : Promise.resolve(null),
    db.emailMessage
      .findMany({
        where: { contactId },
        orderBy: { queuedAt: "desc" },
        take: 20,
        select: {
          id: true,
          template: true,
          stream: true,
          subject: true,
          status: true,
          skipReason: true,
          error: true,
          sequenceKey: true,
          campaignId: true,
          queuedAt: true,
          sentAt: true,
          deliveredAt: true,
        },
      })
      .catch(() => []),
    db.sequenceEnrollment.findMany({ where: { contactId }, orderBy: { enrolledAt: "desc" } }).catch(() => []),
    db.crmTask.findMany({ where: { contactId }, orderBy: [{ status: "desc" }, { dueAt: "asc" }, { createdAt: "desc" }], take: 50 }).catch(() => []),
    loadNotes(contactId, userId).catch(() => []),
    listContactTags(contactId).catch(() => []),
    db.consentRecord.findMany({ where: { contactId }, orderBy: { createdAt: "desc" }, take: 20 }).catch(() => []),
    contact.email
      ? db.emailSuppression.findMany({ where: { emailHash: emailHash(contact.email) }, orderBy: { createdAt: "desc" } }).catch(() => [])
      : Promise.resolve([]),
    db.referral
      .findUnique({ where: { refereeContactId: contactId }, select: { status: true, code: true, referrer: { select: { id: true, name: true, email: true } } } })
      .catch(() => null),
    db.referral.groupBy({ by: ["status"], where: { referrerContactId: contactId }, _count: { _all: true }, _sum: { rewardWords: true } }).catch(() => []),
    loadTimeline(contactId, { userId, limit: 100 }),
    // Live evaluation explains *why* the stage is what it is (the stored row only has the result).
    loadScoringInput(contactId, now)
      .then((input) => (input ? evaluate(input) : null))
      .catch((err) => {
        logGrowthError("contact-360-evaluate", err);
        return null;
      }),
  ]);

  const effectivePlan = user ? effectivePlanId(user) : null;
  const subscriptionStatus = user?.subscription?.status ?? null;
  const breakdown = parseBreakdown(contact.scoreBreakdown);

  return {
    contact: {
      ...contact,
      type: contactType(contact),
      grade: gradeFor(contact.score),
      scoreBreakdown: breakdown,
    },
    stageReason: live?.reason ?? null,
    liveStage: live?.stage ?? null,
    liveScore: live?.score.score ?? null,
    account: user
      ? {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          plan: user.plan,
          effectivePlan,
          planExpiresAt: user.planExpiresAt,
          wordsUsed: user.wordsUsed,
          rewriteCount: user.rewriteCount,
          createdAt: user.createdAt,
          documentCount: user._count.documents,
          subscriptionStatus,
          renewsAt: user.subscription?.lsCurrentPeriodEnd ?? null,
          paying: subscriptionStatus !== null && PAYING_STATUSES.has(subscriptionStatus),
          lastCode: lastRedemption?.discountCode.code ?? null,
        }
      : null,
    emails,
    enrollments,
    tasks,
    notes,
    tags,
    consents,
    suppressions: suppressions.map((s) => ({ id: s.id, scope: s.scope, reason: s.reason, source: s.source, note: s.note, createdAt: s.createdAt })),
    referral: {
      enabled: referralsEnabled(),
      code: contact.referralCode,
      referredBy: referredBy ? { status: referredBy.status, code: referredBy.code, referrer: referredBy.referrer } : null,
      made: referralStats.map((r) => ({ status: r.status, count: r._count._all, words: r._sum.rewardWords ?? 0 })),
      bonusWords: contact.bonusWords,
      bonusAvailable: availableBonusWords(contact, now),
      bonusExpiresAt: contact.bonusWordsExpireAt,
    },
    timeline,
    emailMode: emailSendingMode(),
  };
}

export type Contact360 = NonNullable<Awaited<ReturnType<typeof buildContact360>>>;

// ── Customer 360 summary (users page) ───────────────────────────────────────

/** The CRM slice of the customer page: contact, recent emails, enrollments, timeline. Never throws. */
export async function loadCustomerCrm(userId: string) {
  const contact = await db.contact
    .findUnique({
      where: { userId },
      select: {
        id: true,
        stage: true,
        stageOverride: true,
        score: true,
        source: true,
        channel: true,
        referrerHost: true,
        landingPath: true,
        utmSource: true,
        utmMedium: true,
        utmCampaign: true,
        utmContent: true,
        subscribedTopics: true,
        pendingTopics: true,
        lifecycleEmails: true,
        emailStatus: true,
        emailVerifiedAt: true,
        lastActiveAt: true,
        lastEmailedAt: true,
        pipelineStage: true,
      },
    })
    .catch(() => null);
  if (!contact) return { contact: null, emails: [], enrollments: [], timeline: [], emailCounts: null };

  const [emails, enrollments, timeline, counts] = await Promise.all([
    db.emailMessage
      .findMany({
        where: { contactId: contact.id },
        orderBy: { queuedAt: "desc" },
        take: 10,
        select: { id: true, template: true, subject: true, stream: true, status: true, queuedAt: true, sentAt: true },
      })
      .catch(() => []),
    db.sequenceEnrollment
      .findMany({
        where: { contactId: contact.id },
        orderBy: { enrolledAt: "desc" },
        select: { id: true, sequenceKey: true, status: true, stepIndex: true, nextRunAt: true, exitReason: true, enrolledAt: true },
      })
      .catch(() => []),
    loadTimeline(contact.id, { userId, limit: 30 }).catch(() => []),
    db.emailMessage.groupBy({ by: ["status"], where: { contactId: contact.id }, _count: { _all: true } }).catch(() => []),
  ]);
  const nextStepAt = enrollments
    .filter((e) => e.status === "active" && e.nextRunAt)
    .map((e) => e.nextRunAt as Date)
    .sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
  return {
    contact: { ...contact, grade: gradeFor(contact.score) },
    emails,
    enrollments,
    timeline,
    emailCounts: { byStatus: Object.fromEntries(counts.map((c) => [c.status, c._count._all])), nextStepAt },
  };
}
