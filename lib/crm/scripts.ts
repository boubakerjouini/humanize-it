// ===========================================================
// lib/crm/scripts.ts — Copy-paste outreach scripts, one set per pipeline stage
// (pure; safe in client components).
//
// Adapted from the Growth Kit's warm-DM and cold-email files (Hormozi's ACA:
// Acknowledge, Compliment, Ask). Positioning rules apply to every line: write
// naturally, avoid false AI flags, check before you submit. Never promise that
// a detector will be beaten, never quote pass rates, never suggest breaking
// school or work rules (the Terms forbid academic fraud).
//
// `use: "compose"` scripts can be inserted into the 1:1 email composer (people
// who already know us: past users, comped accounts, trials). Everything else
// is copy only: DMs go out from the founder's own apps, and cold email must
// never leave from the transactional Resend domain.
// ===========================================================

import type { PipelineStage } from "@/lib/growth/constants";
import { appUrl } from "@/lib/growth/flags";
import { PLANS } from "@/lib/plans";

export type ScriptChannel = "dm" | "linkedin" | "email";
export type ScriptUse = "copy" | "compose";

export type SalesScript = {
  id: string;
  name: string;
  /** Pipeline stages where the script is suggested first. */
  stages: readonly PipelineStage[];
  channel: ScriptChannel;
  use: ScriptUse;
  /** Who it is for, in a few words. */
  audience: string;
  subject?: string;
  body: string;
  /** What to do before or after sending. */
  notes?: string;
};

/** Every placeholder a script may contain. */
export const SCRIPT_PLACEHOLDERS = [
  "firstName",
  "detail",
  "company",
  "signupMonth",
  "plan",
  "expiresAt",
  "code",
  "docCount",
  "latestImprovement",
  "signupLink",
  "detectorUrl",
  "appealKitUrl",
] as const;
export type ScriptPlaceholder = (typeof SCRIPT_PLACEHOLDERS)[number];
export type ScriptVars = Partial<Record<ScriptPlaceholder, string | null | undefined>>;

const SITE = appUrl();
const DETECTOR_URL = `${SITE}/ai-detector`;
const APPEAL_KIT_URL = `${SITE}/free/false-ai-flag-appeal-kit`;
const PRO = PLANS.PRO;
const FREE = PLANS.FREE;

const SIGN_OFF = "Boubaker";

export const SALES_SCRIPTS: readonly SalesScript[] = [
  // ── to_contact: first touch ────────────────────────────────────────────────
  {
    id: "A",
    name: "A. Warm DM (friend or family)",
    stages: ["to_contact"],
    channel: "dm",
    use: "copy",
    audience: "People who already know you (WhatsApp, Messenger)",
    body:
      "Hey {firstName}, saw {detail}. Congrats! That's no small thing.\n\n" +
      "Quick one: I built a tool for people whose own writing gets wrongly flagged as AI by detectors. It shows which sentences look \"AI\" and why. " +
      "I'm giving 10 people 3 months of Pro free in exchange for honest feedback.\n\n" +
      "Does anyone you know who is writing a thesis, applying for jobs, or writing in their second language come to mind?",
    notes: "Create a DiscountCode with grantDays 90 in /admin/codes before you offer it. Follow up at most 3 times (day 3, 7, 14).",
  },
  {
    id: "B",
    name: "B. LinkedIn: content or marketing lead (Team)",
    stages: ["to_contact"],
    channel: "linkedin",
    use: "copy",
    audience: "Ex-colleagues who run content or marketing",
    body:
      "Hi {firstName}, saw you're leading content at {company}; building that team is no small thing.\n\n" +
      "Curious: does your team check client copy with AI detectors before it goes out? Some clients run every delivery through one now.\n\n" +
      "I'm setting up 3 small teams free for a month on HumanizeIt (shared words, seats, history, API) in exchange for feedback. " +
      "Worth a look, or is there someone on your team I should ask instead?",
    notes: "Team trial: a DiscountCode for TEAM with grantDays 30.",
  },
  {
    id: "job-hunter",
    name: "LinkedIn: contact who is job hunting",
    stages: ["to_contact"],
    channel: "linkedin",
    use: "copy",
    audience: "Contacts open to new roles",
    body:
      "Hey {firstName}, saw you're open to new roles. {detail} is a strong story to bring to interviews.\n\n" +
      "If you're using AI for first drafts of cover letters, I built a free checker that shows which lines sound generic or AI-like, " +
      "so you can rewrite them in your own words. No signup: {detectorUrl}\n\n" +
      "If it helps, I'd be glad to hear what felt off. And if you want the paid version for your search, it's yours free for 3 months.",
  },
  {
    id: "tutor",
    name: "Friend who teaches or tutors",
    stages: ["to_contact"],
    channel: "dm",
    use: "copy",
    audience: "ESL teachers, writing coaches, lecturers you know",
    body:
      "Hey {firstName}, you mentioned your students {detail}. The patience that takes is real.\n\n" +
      "I've been building a free AI checker that shows which patterns make a text look AI-written. I made it because careful non-native writing gets flagged a lot. " +
      "I also wrote a free appeal kit for students who get wrongly accused (email template plus an evidence checklist): {appealKitUrl}\n\n" +
      "Would it be useful for your students? If yes, I'd love 10 minutes of your opinion on what's missing, and I'll set you up with Pro free for 3 months.",
  },
  {
    id: "cold-agency",
    name: "Cold email: small content agency (Team)",
    stages: ["to_contact"],
    channel: "email",
    use: "copy",
    audience: "Agencies of 2 to 20 people",
    subject: "{company} + client AI checks",
    body:
      "Hi {firstName},\n\n" +
      "I saw {detail}.\n\n" +
      "Quick question: do any of your clients run deliveries through AI detectors now? A few agencies I've talked to get pushback even on copy their writers wrote by hand.\n\n" +
      "I build HumanizeIt. It shows which sentences in a draft read as AI and why (about 40 patterns), and rewrites those parts while keeping meaning and a client's voice. " +
      "Team workspaces share one word pool across seats, with an API if you have a pipeline.\n\n" +
      "I'm setting up 3 agencies free for a month, with a 30-minute workflow setup call with me, in exchange for feedback. Would that be useful, or is this not a problem you have?\n\n" +
      "Boubaker Jouini\nFounder, HumanizeIt - humanizeit.app\n[postal address]\nNot relevant? Reply \"no\" and I won't write again.",
    notes:
      "Send from a separate outreach mailbox and domain (SPF, DKIM, DMARC), never from the product's sending domain. Write the first line yourself; skip anyone you can't say something true and specific about. Under 30 a day.",
  },
  {
    id: "cold-coach",
    name: "Cold email: ESL tutor or writing coach (partner)",
    stages: ["to_contact"],
    channel: "email",
    use: "copy",
    audience: "Tutors and coaches whose clients write in a second language",
    subject: "Free resource for your students",
    body:
      "Hi {firstName},\n\n" +
      "I read {detail}. It's exactly what non-native writers need more of.\n\n" +
      "I'm writing because careful second-language writing gets flagged as \"AI\" by detectors more than people expect. " +
      "A Stanford study (Liang et al., 2023) found detectors flagged most TOEFL essays by non-native writers as AI-generated.\n\n" +
      "I built two free things for that:\n1. An AI checker that shows which patterns triggered a flag, no signup: {detectorUrl}\n" +
      "2. A False AI Flag Appeal Kit: an email template and an evidence checklist for someone wrongly accused: {appealKitUrl}\n\n" +
      "You're welcome to share both, no strings. If you'd like to try the paid rewriter yourself, I'll give you Pro free for 3 months.\n\n" +
      "Boubaker Jouini\nFounder, HumanizeIt - humanizeit.app\n[postal address]\nReply \"no\" and I won't write again.",
    notes: "Separate outreach mailbox only. Don't promise a commission: there is no affiliate program yet.",
  },
  {
    id: "C",
    name: "C. Past user: a question from the founder",
    stages: ["to_contact", "contacted"],
    channel: "email",
    use: "compose",
    audience: "Free users who signed up and drifted away",
    subject: "A quick question from the person who built HumanizeIt",
    body:
      "Hi {firstName},\n\n" +
      "It's Boubaker. I built HumanizeIt on my own, and you signed up back in {signupMonth}. I noticed you {detail}, and that's on me, not you.\n\n" +
      "Can I ask what you were trying to get done at the time? Even one line helps. Since then I've {latestImprovement}.\n\n" +
      "As a thank-you, I've added a free month of Pro to your account, whether you reply or not. Nothing to cancel, it just ends.\n\n" +
      "Thanks for trying something built by one person.\n\n" + SIGN_OFF,
    notes:
      "Grant 30 days of Pro on the customer page before you send, so the promise is already true. One follow-up only, on day 4.",
  },
  {
    id: "D",
    name: "D. Comped access ending",
    stages: ["trial_active", "won"],
    channel: "email",
    use: "compose",
    audience: "Comped Pro or Team accounts close to their end date",
    subject: "Your {plan} access ends on {expiresAt}",
    body:
      "Hi {firstName},\n\n" +
      "A quick heads-up: the free {plan} access from code {code} ends on {expiresAt}. After that your account moves to Free, " +
      "which doesn't keep your full document history, so save anything you want to keep.\n\n" +
      "Two questions: did it save you time, and what would you use it for if you kept it? " +
      "If you'd like to keep it, just reply and I'll send you the options.\n\n" + SIGN_OFF,
    notes: "No pitch link unless they reply.",
  },
  // ── contacted: follow-ups ──────────────────────────────────────────────────
  {
    id: "follow-up-1",
    name: "Follow-up 1 (day 3): one useful thing",
    stages: ["contacted"],
    channel: "dm",
    use: "copy",
    audience: "No reply after the first message",
    body:
      "Hey {firstName}, no pressure at all. One thing I learned while building this, in case it's useful: a detector score is a probability, not proof. " +
      "If anyone you know is ever flagged, their document version history is the strongest evidence they have. That's it!",
  },
  {
    id: "follow-up-2",
    name: "Follow-up 2 (day 7): the free guide",
    stages: ["contacted"],
    channel: "dm",
    use: "copy",
    audience: "Still no reply",
    body:
      "Hi {firstName}, I finished the free guide I mentioned: what to do if your writing is wrongly flagged as AI, with an email template and an evidence checklist. " +
      "Here it is in case it helps you or someone you know: {appealKitUrl}",
  },
  {
    id: "follow-up-3",
    name: "Follow-up 3 (day 14): easy exit",
    stages: ["contacted"],
    channel: "dm",
    use: "copy",
    audience: "Last message, then stop",
    body:
      "Hey {firstName}, I'll stop nudging, I know life is busy. If anyone ever mentions an AI flag or needs to make an AI draft sound like them, I'd love an intro. Hope {detail} goes well!",
  },
  {
    id: "past-user-follow-up",
    name: "Past user follow-up (day 4, once)",
    stages: ["contacted"],
    channel: "email",
    use: "compose",
    audience: "Past users who didn't answer script C",
    subject: "Re: A quick question from the person who built HumanizeIt",
    body:
      "Hi {firstName}, just floating this back up in case it got buried. One line about what you needed back then would genuinely help me. " +
      "And if the answer is \"I don't need it anymore\", that's useful too.\n\n" + SIGN_OFF,
  },
  // ── replied: answers to common replies ─────────────────────────────────────
  {
    id: "reply-cheating",
    name: "Reply: \"Isn't this for cheating?\"",
    stages: ["replied"],
    channel: "dm",
    use: "copy",
    audience: "Anyone who asks",
    body:
      "Fair question. No. It's for people whose own writing gets flagged, and for people who start from an AI draft where that's allowed (emails, posts, marketing) " +
      "and want the result to sound like them. Our Terms forbid academic fraud, and I don't promise anyone will \"beat\" a detector.",
  },
  {
    id: "reply-price",
    name: "Reply: \"How much is it?\"",
    stages: ["replied"],
    channel: "dm",
    use: "copy",
    audience: "Anyone who asks",
    body:
      `The detector is free with no signup. The free plan gives ${FREE.wordsLimit.toLocaleString("en-US")} words a day for rewriting. ` +
      `Pro is $${PRO.price} a month${PRO.priceAnnual ? ` or $${PRO.priceAnnual} a year` : ""}. For you it's free for 3 months anyway.`,
  },
  {
    id: "reply-detectors",
    name: "Reply: \"Does it work with Turnitin / GPTZero?\"",
    stages: ["replied"],
    channel: "dm",
    use: "copy",
    audience: "Anyone who asks",
    body:
      "I won't promise anything about a specific detector; they change often and nobody can guarantee their output. " +
      "What it does is show you the patterns they look for, so you can see why a text reads as AI and write it more naturally.",
  },
  {
    id: "reply-complaint",
    name: "Reply: they raised a complaint",
    stages: ["replied"],
    channel: "email",
    use: "compose",
    audience: "Past users who replied with a problem",
    subject: "Re: your feedback",
    body:
      "Hi {firstName},\n\nThank you, that's exactly what I needed. You're right that {detail}. I'm fixing it now, and I'll write back when it's live so you can judge for yourself.\n\n" +
      SIGN_OFF,
  },
  // ── trial_offered / trial_active ───────────────────────────────────────────
  {
    id: "trial-link",
    name: "Trial: send the link",
    stages: ["trial_offered"],
    channel: "dm",
    use: "copy",
    audience: "They said yes to the free months",
    body:
      "Even better. Here's your link with 3 months of Pro already on it: {signupLink}\n" +
      "Try it on something you wrote yourself, and tell me the first thing that confused you. That's the feedback I need most.",
    notes: "Create a DiscountCode (grantDays 90) in /admin/codes; they redeem it in Settings after signing up.",
  },
  {
    id: "trial-check-in",
    name: "Trial: check-in",
    stages: ["trial_active"],
    channel: "email",
    use: "compose",
    audience: "People using a free trial",
    subject: "How's it going so far?",
    body:
      "Hi {firstName},\n\nYou've run {docCount} documents so far, thank you for trying it. What was the first thing that confused you, and what's still missing? " +
      "Even one line helps me decide what to fix next.\n\n" + SIGN_OFF,
  },
  // ── won: testimonial and review ────────────────────────────────────────────
  {
    id: "E",
    name: "E. Testimonial ask",
    stages: ["won"],
    channel: "email",
    use: "compose",
    audience: "Happy customers and power users",
    subject: "Two sentences?",
    body:
      "Hi {firstName},\n\nYou've run {docCount} documents through HumanizeIt, thank you. Would you write two sentences about what it helps you with? " +
      "I'd love to quote you (first name only or anonymous, your choice).\n\n" + SIGN_OFF,
    notes: "Add the testimonial tag once they answer, so the auto task stops asking.",
  },
  {
    id: "after-call",
    name: "After a positive call: quote and review",
    stages: ["won"],
    channel: "email",
    use: "compose",
    audience: "People you talked to who liked it",
    subject: "Thank you",
    body:
      "Hi {firstName},\n\nThank you, that was really useful. Two small favors, only if you think it deserves it: could I quote what you said on the site " +
      "(first name and role, or anonymous, your choice)? And would you leave an honest review once the listing is live? I'll send the link.\n\n" + SIGN_OFF,
  },
  // ── lost ───────────────────────────────────────────────────────────────────
  {
    id: "not-interested",
    name: "Reply: \"Not interested\"",
    stages: ["lost"],
    channel: "dm",
    use: "copy",
    audience: "They said no",
    body: "Understood, thanks for replying. I won't write again.",
    notes: "Then honour it: move the card to Lost and stop.",
  },
];

const BY_ID = new Map(SALES_SCRIPTS.map((s) => [s.id, s]));

export function getScript(id: string): SalesScript | null {
  return BY_ID.get(id) ?? null;
}

/** Scripts suggested for a pipeline stage (none = the first-touch set). */
export function scriptsForStage(stage: PipelineStage | null | undefined): SalesScript[] {
  const key: PipelineStage = stage ?? "to_contact";
  return SALES_SCRIPTS.filter((s) => s.stages.includes(key));
}

/** Scripts that can be inserted into the 1:1 email composer. */
export function composableScripts(): SalesScript[] {
  return SALES_SCRIPTS.filter((s) => s.use === "compose");
}

/** Values that need no contact data. */
export const DEFAULT_SCRIPT_VARS: ScriptVars = {
  detectorUrl: DETECTOR_URL,
  appealKitUrl: APPEAL_KIT_URL,
};

/**
 * Replace the placeholders we have values for. Unknown or empty ones stay as
 * {name} and are listed in `missing`, so nothing goes out half-filled by accident.
 */
export function fillScript(text: string, vars: ScriptVars): { text: string; missing: string[] } {
  const all: ScriptVars = { ...DEFAULT_SCRIPT_VARS, ...vars };
  const missing = new Set<string>();
  const out = text.replace(/\{([a-zA-Z]+)\}/g, (match, key: string) => {
    const value = (all as Record<string, string | null | undefined>)[key];
    if (typeof value === "string" && value.trim()) return value;
    missing.add(key);
    return match;
  });
  return { text: out, missing: [...missing] };
}

/** Placeholders still present in a text (e.g. a composer body before sending). */
export function unfilledPlaceholders(text: string): string[] {
  return [...new Set([...text.matchAll(/\{([a-zA-Z]+)\}/g)].map((m) => m[1]))];
}

export function firstNameOf(name: string | null | undefined): string | null {
  const first = name?.trim().split(/\s+/)[0];
  return first ? first : null;
}

const MONTH = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
const DAY = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

/** Script variables from what the CRM knows about a contact. */
export function scriptVarsFor(c: {
  name?: string | null;
  company?: string | null;
  signedUpAt?: Date | string | null;
  plan?: string | null;
  planExpiresAt?: Date | string | null;
  code?: string | null;
  docCount?: number | null;
}): ScriptVars {
  const date = (v: Date | string | null | undefined) => {
    if (!v) return null;
    const d = v instanceof Date ? v : new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  };
  const signedUp = date(c.signedUpAt);
  const expires = date(c.planExpiresAt);
  const plan = c.plan && c.plan in PLANS ? PLANS[c.plan as keyof typeof PLANS].name : null;
  return {
    firstName: firstNameOf(c.name),
    company: c.company ?? null,
    signupMonth: signedUp ? MONTH.format(signedUp) : null,
    plan,
    expiresAt: expires ? DAY.format(expires) : null,
    code: c.code ?? null,
    docCount: typeof c.docCount === "number" ? c.docCount.toLocaleString("en-US") : null,
  };
}
