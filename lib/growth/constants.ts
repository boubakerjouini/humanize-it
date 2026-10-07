// ===========================================================
// lib/growth/constants.ts — Shared vocabulary of the growth engine (magnets,
// lead sources, consent topics, channels, pipeline and email statuses) and the
// exact consent copy shown next to each opt-in. Pure: safe in client and server
// code alike.
// ===========================================================

export const MAGNET_SLUGS = [
  "false-ai-flag-appeal-kit",
  "ai-detection-field-guide",
  "linkedin-humanizer-checklist",
] as const;
export type MagnetSlug = (typeof MAGNET_SLUGS)[number];

/** Every value Contact.source can take. */
export const LEAD_SOURCES = [
  "signup",
  "magnet_page",
  "detector_report",
  "exit_intent",
  "blog_inline",
  /** A magnet offered inside a free tool (the /ai-detector Appeal Kit box, the humanizer's limit message). */
  "tool_inline",
  "extension_waitlist",
  "founding_waitlist",
  "manual",
] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

/**
 * The subset a public form may claim. "signup" comes from Clerk and "manual"
 * from the admin, so accepting them from the open internet would let anyone
 * forge provenance.
 */
export const PUBLIC_LEAD_SOURCES = [
  "magnet_page",
  "detector_report",
  "exit_intent",
  "blog_inline",
  "tool_inline",
  "extension_waitlist",
  "founding_waitlist",
] as const satisfies readonly LeadSource[];
export type PublicLeadSource = (typeof PUBLIC_LEAD_SOURCES)[number];

/** Marketing consent topics. Lifecycle (service) email is a separate boolean. */
export const TOPICS = ["tips", "extension_launch"] as const;
export type Topic = (typeof TOPICS)[number];

/** Used in footers ("you subscribed to HumanizeIt {label}") and the preference center. */
export const TOPIC_LABELS: Record<Topic, string> = {
  tips: "writing tips and offers",
  extension_launch: "Chrome extension launch updates",
};

export const CHANNELS = [
  "organic_search",
  "ai_assistant",
  "social",
  "referral",
  "referral_program",
  "email",
  "paid",
  "outreach",
  "direct",
  "unknown",
] as const;
export type Channel = (typeof CHANNELS)[number];

export const PIPELINE_STAGES = [
  "to_contact",
  "contacted",
  "replied",
  "trial_offered",
  "trial_active",
  "won",
  "lost",
] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const EMAIL_STATUSES = ["ok", "bounced", "complained", "invalid"] as const;
export type EmailStatus = (typeof EMAIL_STATUSES)[number];

export const EMAIL_STREAMS = ["transactional", "lifecycle", "marketing", "personal"] as const;
export type EmailStream = (typeof EMAIL_STREAMS)[number];

export const OUTREACH_CHANNELS = [
  "whatsapp",
  "linkedin",
  "email",
  "phone",
  "dm",
  "community",
  "content",
  "in_person",
] as const;
export type OutreachChannel = (typeof OUTREACH_CHANNELS)[number];

export const OUTREACH_OUTCOMES = [
  "sent",
  "replied",
  "interested",
  "not_interested",
  "no_answer",
  "posted",
] as const;
export type OutreachOutcome = (typeof OUTREACH_OUTCOMES)[number];

/**
 * ContactEvent.type values. Lives here (not in lib/crm/events.ts, which imports
 * the DB) so pure modules such as the segment compiler can validate against it.
 */
export const EVENT_TYPES = [
  // Product
  "signed_up",
  "first_document",
  "document_analyzed",
  "document_humanized",
  "document_uploaded",
  "quota_hit",
  "checkout_started",
  // Billing
  "subscription_started",
  "subscription_plan_changed",
  "subscription_cancelled",
  "subscription_expired",
  "subscription_paused",
  "subscription_resumed",
  "payment_failed",
  "payment_recovered",
  // One-time purchases (Founding 100, word packs)
  "founding_purchased",
  "wordpack_purchased",
  // Plans and codes
  "grant_applied",
  "grant_expired",
  "code_redeemed",
  "plan_changed",
  "trial_code_issued",
  // Leads
  "lead_captured",
  "email_confirmed",
  "magnet_downloaded",
  "waitlist_joined",
  "converted",
  "merged",
  // Referrals and bonus words
  "referral_signup",
  "referral_rewarded",
  "referral_rejected",
  "bonus_granted",
  "bonus_used",
  // Founder services (first-document review, team setup)
  "service_requested",
  // CRM
  "note",
  "stage_changed",
  "stage_overridden",
  "pipeline_changed",
  "outreach_touch",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export function isEventType(value: unknown): value is EventType {
  return typeof value === "string" && (EVENT_TYPES as readonly string[]).includes(value);
}

/**
 * Versioned consent copy. ConsentRecord.wording stores the id, so the exact
 * text a person agreed to stays provable after the copy changes: add a new id
 * instead of editing an existing one.
 */
export const CONSENT_WORDING = {
  "tips-v1":
    "Send me writing tips and occasional offers from HumanizeIt (about 2 emails a month). Unsubscribe anytime.",
  "ext-v1":
    "Email me about the HumanizeIt Chrome extension: a few updates, then launch day. Unsubscribe anytime.",
  "inapp-tips-v1": "Yes, email me tips and occasional offers (about 2 a month). Unsubscribe anytime.",
} as const;
export type ConsentWordingId = keyof typeof CONSENT_WORDING;

export function isMagnetSlug(value: unknown): value is MagnetSlug {
  return typeof value === "string" && (MAGNET_SLUGS as readonly string[]).includes(value);
}

export function isTopic(value: unknown): value is Topic {
  return typeof value === "string" && (TOPICS as readonly string[]).includes(value);
}

export function isConsentWordingId(value: unknown): value is ConsentWordingId {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(CONSENT_WORDING, value);
}
