// ===========================================================
// lib/email/catalog.ts — The single source of truth for email templates:
// each key's props type, stream, consent topic and owning flow, plus the flow
// list the admin toggles (/admin/sequences). Pure: the flow on/off state lives
// in EmailFlowSetting and is read by lib/email/enroll.ts (isFlowEnabled).
//
// FLOW_META[key].playbook names the Growth Kit "Email Playbook" email each
// template transcribes, so copy can be lifted from the playbook verbatim. A
// null entry has no playbook email; write it from the spec's copy outline.
// ===========================================================

import type { EmailStream, MagnetSlug, Topic } from "@/lib/growth/constants";

type Base = { firstName?: string | null };
type PaidPlan = "PRO" | "TEAM";
type PatternHit = { id: string; label: string; hits: number };

export type TemplateProps = {
  // Transactional
  magnet_delivery: Base & { magnet: MagnetSlug; confirmUrl: string; downloadUrl: string; consentPending: boolean };
  detector_report: Base & {
    instantScore: number;
    deepScore?: number;
    confidence?: "low" | "medium" | "high";
    /** Labels come from the detector's pattern catalog, never from the request. */
    patterns: PatternHit[];
    wordCount?: number;
    confirmUrl?: string;
  };
  waitlist_confirm: Base & { confirmUrl: string };
  doi_confirm: Base & { confirmUrl: string; topics: Topic[] };
  founding_confirm: Base & { confirmUrl: string };
  // Onboarding
  welcome: Base;
  first_run_nudge: Base;
  check_before_submit: Base;
  founder_checkin: Base;
  what_paid_users_do: Base & { proPrice: number; proAnnual: number };
  // Quota upgrade
  limit_hit_menu: Base & { proPrice: number; proAnnual: number };
  trial_offer: Base & { code: string; expiresAt: string; days: number };
  // Grant expiry
  grant_ending_notice: Base & { plan: PaidPlan; expiresAt: string };
  grant_keep_offer: Base & {
    plan: PaidPlan;
    expiresAt: string;
    wordsUsed30d: number;
    recommended: PaidPlan;
    monthly: number;
    annual: number;
  };
  trial_midpoint: Base & { expiresAt: string };
  grant_ends_tomorrow: Base & { plan: PaidPlan; expiresAt: string };
  grant_ended: Base & { plan: PaidPlan; expiresAt: string };
  grant_feedback: Base & { plan: PaidPlan };
  // Win-back
  winback_one_thing: Base & { headline: string; body: string; ctaLabel: string; ctaUrl: string };
  /** followUp: winback_one_thing (tips) was sent first; moreToCome: winback_bonus follows. */
  winback_ask: Base & { followUp?: boolean; moreToCome?: boolean };
  winback_bonus: Base & { words: number };
  // Checkout abandoned
  checkout_help: Base & { plan: PaidPlan; monthly: number; annual: number };
  // Lead nurture
  nurture_why_flags: Base & { magnet?: MagnetSlug };
  nurture_three_pass: Base & { magnet?: MagnetSlug };
  nurture_evidence: Base & { magnet?: MagnetSlug; hasAppealKit: boolean };
  nurture_free_account: Base & { magnet?: MagnetSlug };
  nurture_keep_going: Base & { magnet?: MagnetSlug };
  // Extension waitlist
  waitlist_update: Base;
  // Referral notice
  referral_reward: Base & { words: number; role: "referrer" | "referee" };
  // Admin-written
  campaign: Base & { subject: string; preheader?: string; bodyMd: string };
  personal_note: Base & { subject: string; bodyMd: string };
};

export type TemplateKey = keyof TemplateProps;

export const TRANSACTIONAL_FLOW_KEYS = [
  "magnet_delivery",
  "detector_report",
  "waitlist_confirm",
  "doi_confirm",
  "referral_reward",
] as const;
export const SEQUENCE_KEYS = [
  "onboarding",
  "quota_upgrade",
  "grant_expiry",
  "winback_inactive",
  "checkout_abandoned",
  "lead_nurture",
  "extension_waitlist",
] as const;
export const FLOW_KEYS = [...TRANSACTIONAL_FLOW_KEYS, ...SEQUENCE_KEYS] as const;

export type TransactionalFlowKey = (typeof TRANSACTIONAL_FLOW_KEYS)[number];
export type SequenceKey = (typeof SEQUENCE_KEYS)[number];
export type FlowKey = (typeof FLOW_KEYS)[number];

export type TemplateMeta = {
  stream: EmailStream;
  /** Marketing consent topic; null for non-marketing streams and for campaigns (topic comes from the campaign). */
  topic: Topic | null;
  /** Flow whose toggle gates this template; null = always allowed (campaigns, personal notes). */
  flow: FlowKey | null;
};

export const TEMPLATES: { [K in TemplateKey]: TemplateMeta } = {
  magnet_delivery: { stream: "transactional", topic: null, flow: "magnet_delivery" },
  detector_report: { stream: "transactional", topic: null, flow: "detector_report" },
  waitlist_confirm: { stream: "transactional", topic: null, flow: "waitlist_confirm" },
  doi_confirm: { stream: "transactional", topic: null, flow: "doi_confirm" },
  // Founding 100 list sign-ups (/lifetime): the same double opt-in, with copy that names the offer.
  founding_confirm: { stream: "transactional", topic: null, flow: "doi_confirm" },

  welcome: { stream: "lifecycle", topic: null, flow: "onboarding" },
  first_run_nudge: { stream: "lifecycle", topic: null, flow: "onboarding" },
  check_before_submit: { stream: "lifecycle", topic: null, flow: "onboarding" },
  founder_checkin: { stream: "lifecycle", topic: null, flow: "onboarding" },
  what_paid_users_do: { stream: "marketing", topic: "tips", flow: "onboarding" },

  limit_hit_menu: { stream: "marketing", topic: "tips", flow: "quota_upgrade" },
  trial_offer: { stream: "marketing", topic: "tips", flow: "quota_upgrade" },

  grant_ending_notice: { stream: "lifecycle", topic: null, flow: "grant_expiry" },
  grant_keep_offer: { stream: "marketing", topic: "tips", flow: "grant_expiry" },
  trial_midpoint: { stream: "marketing", topic: "tips", flow: "grant_expiry" },
  grant_ends_tomorrow: { stream: "lifecycle", topic: null, flow: "grant_expiry" },
  grant_ended: { stream: "lifecycle", topic: null, flow: "grant_expiry" },
  grant_feedback: { stream: "lifecycle", topic: null, flow: "grant_expiry" },

  winback_one_thing: { stream: "marketing", topic: "tips", flow: "winback_inactive" },
  winback_ask: { stream: "lifecycle", topic: null, flow: "winback_inactive" },
  winback_bonus: { stream: "marketing", topic: "tips", flow: "winback_inactive" },

  checkout_help: { stream: "marketing", topic: "tips", flow: "checkout_abandoned" },

  nurture_why_flags: { stream: "marketing", topic: "tips", flow: "lead_nurture" },
  nurture_three_pass: { stream: "marketing", topic: "tips", flow: "lead_nurture" },
  nurture_evidence: { stream: "marketing", topic: "tips", flow: "lead_nurture" },
  nurture_free_account: { stream: "marketing", topic: "tips", flow: "lead_nurture" },
  nurture_keep_going: { stream: "marketing", topic: "tips", flow: "lead_nurture" },

  waitlist_update: { stream: "marketing", topic: "extension_launch", flow: "extension_waitlist" },

  referral_reward: { stream: "lifecycle", topic: null, flow: "referral_reward" },

  campaign: { stream: "marketing", topic: null, flow: null },
  personal_note: { stream: "personal", topic: null, flow: null },
};

export const TEMPLATE_KEYS = Object.keys(TEMPLATES) as TemplateKey[];

export type FlowKind = "transactional" | "notice" | "sequence";

export type PlaybookMapping = {
  /** Playbook sequence the flow follows; null when the playbook has none. */
  sequence: string | null;
  /** Template → playbook email ("welcome.1"); null = no playbook email, use the spec outline. */
  emails: Partial<Record<TemplateKey, string | null>>;
  notes?: string;
};

export type FlowMeta = {
  name: string;
  kind: FlowKind;
  description: string;
  audience: string;
  playbook: PlaybookMapping;
};

export const FLOW_META: Record<FlowKey, FlowMeta> = {
  magnet_delivery: {
    name: "Lead magnet delivery",
    kind: "transactional",
    description: "Sends the PDF someone requested, with the double opt-in button when they ticked tips.",
    audience: "Anyone who requested a magnet",
    playbook: { sequence: "lead_nurture", emails: { magnet_delivery: "lead_nurture.1" } },
  },
  detector_report: {
    name: "Detector report",
    kind: "transactional",
    description: "Emails the AI-detector scores and fix list. Never the text itself.",
    audience: "Anyone who asked for their report",
    playbook: { sequence: null, emails: { detector_report: null } },
  },
  waitlist_confirm: {
    name: "Waitlist confirmation",
    kind: "transactional",
    description: "Double opt-in for the Chrome extension waitlist.",
    audience: "Anyone who joined the waitlist",
    playbook: {
      sequence: "extension_waitlist",
      emails: { waitlist_confirm: "extension_waitlist.1" },
      notes: "Keep a confirm button as the CTA: this email is the double opt-in.",
    },
  },
  doi_confirm: {
    name: "Subscription confirmation",
    kind: "transactional",
    description: "Double opt-in for pending topics: the neutral reminder sent from the email log, and the Founding 100 list confirmation.",
    audience: "Contacts with pending topics, and Founding 100 list sign-ups",
    playbook: { sequence: null, emails: { doi_confirm: null, founding_confirm: null } },
  },
  referral_reward: {
    name: "Referral reward notice",
    kind: "notice",
    description: "Tells both sides their bonus words arrived. Only while referrals are enabled.",
    audience: "Referrers and referees",
    playbook: { sequence: null, emails: { referral_reward: null } },
  },
  onboarding: {
    name: "Onboarding",
    kind: "sequence",
    description: "Welcome, first-check nudge, the self-check habit, an honest Pro note and a founder check-in.",
    audience: "New signups",
    playbook: {
      sequence: "welcome",
      emails: {
        welcome: "welcome.1",
        check_before_submit: "welcome.2",
        first_run_nudge: "welcome.3",
        what_paid_users_do: "welcome.4",
        founder_checkin: null,
      },
      notes:
        "Playbook timing: welcome.2 day 1, welcome.3 day 3 (only without a document), welcome.4 day 7 (only on Free).",
    },
  },
  quota_upgrade: {
    name: "Quota upgrade",
    kind: "sequence",
    description: "After a Free user hits a limit: the options menu, then one 7-day pass.",
    audience: "Free users who hit a limit",
    playbook: {
      sequence: "quota_hit",
      emails: { limit_hit_menu: "quota_hit.1", trial_offer: "quota_hit.2" },
      notes:
        "quota_hit.2 sells Pro annual rather than a 7-day pass. quota_hit.1's referral line only while referralsEnabled(). Playbook re-entry: 14 days.",
    },
  },
  grant_expiry: {
    name: "Grant expiry",
    kind: "sequence",
    description: "Notices before and after a comped plan or pass ends, plus one honest keep-it offer.",
    audience: "Users with planExpiresAt and no paid subscription",
    playbook: {
      sequence: "comped_expiry",
      emails: {
        grant_ending_notice: "comped_expiry.1",
        grant_keep_offer: "comped_expiry.2",
        grant_ends_tomorrow: "comped_expiry.3",
        trial_midpoint: null,
        grant_ended: null,
        grant_feedback: null,
      },
      notes:
        "Exit with grantExpiryExitReason() (lib/email/schedule.ts): a lapsed grant (FREE, no expiry, after the anchor) keeps running.",
    },
  },
  winback_inactive: {
    name: "Win-back",
    kind: "sequence",
    description: "One thing that changed, a no-pitch question, then bonus words.",
    audience: "Free users inactive 21+ days after a first document",
    playbook: {
      sequence: "winback",
      emails: { winback_one_thing: "winback.1", winback_ask: "winback.3", winback_bonus: null },
      notes:
        "Playbook winback.2 (the Appeal Kit) has no template here. winback_bonus may only send after grantBonusWords succeeded.",
    },
  },
  checkout_abandoned: {
    name: "Checkout abandoned",
    kind: "sequence",
    description: "A personal question the day after a started checkout without a subscription.",
    audience: "Users with a checkout_started 24-72h ago",
    playbook: { sequence: null, emails: { checkout_help: null } },
  },
  lead_nurture: {
    name: "Lead nurture",
    kind: "sequence",
    description: "Three value emails, one ask (a free account), then a re-permission email.",
    audience: "Confirmed tips subscribers without an account",
    playbook: {
      sequence: "lead_nurture",
      emails: {
        nurture_why_flags: "lead_nurture.2",
        nurture_three_pass: "lead_nurture.3",
        nurture_evidence: "winback.2",
        nurture_free_account: "lead_nurture.4",
        nurture_keep_going: null,
      },
      notes: "lead_nurture.1 is the magnet_delivery email. nurture_evidence reuses the winback.2 Appeal Kit copy.",
    },
  },
  extension_waitlist: {
    name: "Extension waitlist",
    kind: "sequence",
    description: "One update a week after joining. The launch email itself is a campaign.",
    audience: "Contacts subscribed to extension_launch",
    playbook: {
      sequence: "extension_waitlist",
      emails: { waitlist_update: null },
      notes: "extension_waitlist.1 is the waitlist_confirm email.",
    },
  },
};

/** Campaigns are written in the admin editor; these playbook broadcasts are their first drafts. */
export const CAMPAIGN_PLAYBOOK = ["broadcast.relaunch", "broadcast.detector_watch"] as const;

export function isTemplateKey(value: unknown): value is TemplateKey {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(TEMPLATES, value);
}

export function isFlowKey(value: unknown): value is FlowKey {
  return typeof value === "string" && (FLOW_KEYS as readonly string[]).includes(value);
}

export function isSequenceKey(value: unknown): value is SequenceKey {
  return typeof value === "string" && (SEQUENCE_KEYS as readonly string[]).includes(value);
}

export function templateMeta<K extends TemplateKey>(key: K): TemplateMeta {
  return TEMPLATES[key];
}

export function templatesOfFlow(flow: FlowKey): TemplateKey[] {
  return TEMPLATE_KEYS.filter((key) => TEMPLATES[key].flow === flow);
}
