// ===========================================================
// lib/email/sequences.ts — The 7 email sequences as code, plus the pure
// decisions the engine makes about them (spec §5.1, §5.2).
//
// A sequence is an ordered list of steps with an hour offset from the
// enrollment's anchor, an optional condition and a props builder that is
// type-checked against the catalog's TemplateProps. Everything here is pure:
// the engine (lib/email/engine.ts) loads the SequenceContext from the database
// and runs the side effects a step declares (issuing a 7-day pass, granting
// win-back bonus words) before it builds the props.
// ===========================================================

import { FLOW_META, TEMPLATES, type SequenceKey, type TemplateKey, type TemplateProps } from "@/lib/email/catalog";
import { nextDueStep, type SequenceDef, type SequenceStep, type StepDecision } from "@/lib/email/schedule";
import type { SendOutcome } from "@/lib/email/send";
import { grantExpiryExitReason } from "@/lib/email/schedule";
import { isMagnetSlug, type MagnetSlug } from "@/lib/growth/constants";
import { referralsEnabled } from "@/lib/growth/flags";
import { WHATS_NEW } from "@/lib/email/whats-new";
import { PLANS, type PlanId } from "@/lib/plans";

export type PaidPlan = "PRO" | "TEAM";

/** Words granted by the win-back bonus step (spec §5.1). */
export const WINBACK_BONUS_WORDS = 3000;
/** A 7-day pass: one-time PRO code, redeemable for 72 hours. */
export const TRIAL_PASS_DAYS = 7;
export const TRIAL_PASS_REDEEM_HOURS = 72;
/** grantDays when neither the enrollment nor the redemption says (comped codes default to 365). */
export const DEFAULT_GRANT_DAYS = 365;
/** Usage above Pro's monthly allowance recommends Team in the keep-it offer. */
const TEAM_THRESHOLD_WORDS = PLANS.PRO.wordsLimit;
const APPEAL_KIT: MagnetSlug = "false-ai-flag-appeal-kit";

/** What a sequence remembers between steps (SequenceEnrollment.context). */
export type EnrollmentContext = {
  magnet?: MagnetSlug;
  grantDays?: number | null;
  /** The granted or checked-out plan; kept because the stored plan is FREE after a grant lapses. */
  plan?: PaidPlan;
  /** The 7-day pass issued for this enrollment, reused on retries. */
  trialCode?: string;
  trialExpiresAt?: string;
  bonusGranted?: boolean;
  checkoutEventId?: string;
};

export type SequenceContext = {
  now: Date;
  enrollment: {
    id: string;
    sequenceKey: SequenceKey;
    cycle: string;
    anchorAt: Date;
    enrolledAt: Date;
    stepIndex: number;
    context: EnrollmentContext;
  };
  contact: {
    id: string;
    userId: string | null;
    subscribedTopics: readonly string[];
    lifecycleEmails: boolean;
    magnets: readonly string[];
    firstDocumentAt: Date | null;
    lastActiveAt: Date | null;
  };
  /** Null for a lead without an account. */
  user: { plan: string; effectivePlan: PlanId; planExpiresAt: Date | null; createdAt: Date } | null;
  hasActivePaidSubscription: boolean;
  /** Sum of Document.wordCount over the last 30 days. */
  wordsUsed30d: number;
  /** A checkout_started event after the enrollment began. */
  checkoutSinceEnrollment: boolean;
};

export type StepEffect = "trial_pass" | "winback_bonus";

export type EngineStep = SequenceStep<SequenceContext> & {
  /** Side effect the engine runs before building the props; failure skips the step. */
  effect?: StepEffect;
  /** Plain-language condition for the admin steps table. */
  condition?: string;
};

export type EngineSequence = Omit<SequenceDef<SequenceContext>, "steps"> & { steps: EngineStep[] };

type StepInput<K extends TemplateKey> = {
  key: string;
  offsetHours: number;
  template: K;
  maxLateHours?: number;
  when?: (ctx: SequenceContext) => StepDecision;
  props: (ctx: SequenceContext) => TemplateProps[K];
  effect?: StepEffect;
  condition?: string;
};

/** Typed step: `props` must return exactly the template's props. */
function step<K extends TemplateKey>(s: StepInput<K>): EngineStep {
  return s;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** "October 21, 2026" (UTC), the form every template shows dates in. */
export function emailDate(value: Date | string): string {
  const d = value instanceof Date ? value : new Date(value);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export function parseEnrollmentContext(raw: unknown): EnrollmentContext {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  const ctx: EnrollmentContext = {};
  if (isMagnetSlug(o.magnet)) ctx.magnet = o.magnet;
  if (o.grantDays === null || (typeof o.grantDays === "number" && Number.isFinite(o.grantDays))) ctx.grantDays = o.grantDays;
  if (o.plan === "PRO" || o.plan === "TEAM") ctx.plan = o.plan;
  if (typeof o.trialCode === "string") ctx.trialCode = o.trialCode;
  if (typeof o.trialExpiresAt === "string") ctx.trialExpiresAt = o.trialExpiresAt;
  if (o.bonusGranted === true) ctx.bonusGranted = true;
  if (typeof o.checkoutEventId === "string") ctx.checkoutEventId = o.checkoutEventId;
  return ctx;
}

function grantDaysOf(ctx: SequenceContext): number {
  return ctx.enrollment.context.grantDays ?? DEFAULT_GRANT_DAYS;
}

function grantedPlan(ctx: SequenceContext): PaidPlan {
  const stored = ctx.enrollment.context.plan;
  if (stored) return stored;
  return ctx.user?.plan === "TEAM" ? "TEAM" : "PRO";
}

const isFree = (ctx: SequenceContext) => ctx.user?.effectivePlan === "FREE";
const proPrices = () => ({ proPrice: PLANS.PRO.price, proAnnual: PLANS.PRO.priceAnnual ?? 0 });
const sendIf = (ok: boolean): StepDecision => (ok ? "send" : "skip");

// ── Definitions ─────────────────────────────────────────────────────────────

function def(key: SequenceKey, audience: EngineSequence["audience"], trigger: string, steps: EngineStep[], exitWhen?: EngineSequence["exitWhen"]): EngineSequence {
  return { key, name: FLOW_META[key].name, description: FLOW_META[key].description, audience, trigger, steps, exitWhen };
}

const onboarding = def(
  "onboarding",
  "user",
  "Signup (welcome goes out right away)",
  [
    step({ key: "welcome", offsetHours: 0, template: "welcome", props: () => ({}) }),
    step({
      key: "first_run_nudge",
      offsetHours: 24,
      template: "first_run_nudge",
      when: (c) => sendIf(c.contact.firstDocumentAt === null),
      condition: "Only if they haven't run a first document",
      props: () => ({}),
    }),
    step({ key: "check_before_submit", offsetHours: 72, template: "check_before_submit", props: () => ({}) }),
    step({
      key: "what_paid_users_do",
      offsetHours: 168,
      template: "what_paid_users_do",
      when: (c) => sendIf(isFree(c)),
      condition: "Only on Free (and subscribed to tips)",
      props: () => proPrices(),
    }),
    step({ key: "founder_checkin", offsetHours: 240, template: "founder_checkin", props: () => ({}) }),
  ],
  (c) => (c.contact.userId ? null : "not_user")
);

const quotaUpgrade = def(
  "quota_upgrade",
  "user",
  "A Free user hits a limit (once per 30 days)",
  [
    step({ key: "limit_hit_menu", offsetHours: 20, template: "limit_hit_menu", props: () => proPrices() }),
    step({
      key: "trial_offer",
      offsetHours: 72,
      template: "trial_offer",
      when: (c) => sendIf(isFree(c) && !c.checkoutSinceEnrollment),
      condition: "Still Free, no checkout since, and the monthly pass cap not reached",
      effect: "trial_pass",
      props: (c) => ({
        code: c.enrollment.context.trialCode ?? "",
        expiresAt: emailDate(c.enrollment.context.trialExpiresAt ?? c.now),
        days: TRIAL_PASS_DAYS,
      }),
    }),
  ],
  (c) => {
    if (!c.user) return "not_user";
    if (c.hasActivePaidSubscription || c.user.effectivePlan !== "FREE") return "converted";
    return null;
  }
);

const grantExpiry = def(
  "grant_expiry",
  "user",
  "A comped plan or pass ends within 15 days (daily sweep, code redemption)",
  [
    step({
      key: "grant_ending_notice",
      offsetHours: -336,
      template: "grant_ending_notice",
      when: (c) => sendIf(grantDaysOf(c) >= 30),
      condition: "Grants of 30 days or more",
      props: (c) => ({ plan: grantedPlan(c), expiresAt: emailDate(c.enrollment.anchorAt) }),
    }),
    step({
      key: "grant_keep_offer",
      offsetHours: -168,
      template: "grant_keep_offer",
      when: (c) => sendIf(grantDaysOf(c) >= 30),
      condition: "Grants of 30 days or more (and subscribed to tips)",
      props: (c) => {
        const recommended: PaidPlan = c.wordsUsed30d > TEAM_THRESHOLD_WORDS ? "TEAM" : "PRO";
        return {
          plan: grantedPlan(c),
          expiresAt: emailDate(c.enrollment.anchorAt),
          wordsUsed30d: c.wordsUsed30d,
          recommended,
          monthly: PLANS[recommended].price,
          annual: PLANS[recommended].priceAnnual ?? 0,
        };
      },
    }),
    step({
      key: "trial_midpoint",
      offsetHours: -72,
      template: "trial_midpoint",
      when: (c) => sendIf(grantDaysOf(c) < 30),
      condition: "Short passes (under 30 days, and subscribed to tips)",
      props: (c) => ({ expiresAt: emailDate(c.enrollment.anchorAt) }),
    }),
    step({
      key: "grant_ends_tomorrow",
      offsetHours: -24,
      maxLateHours: 20,
      template: "grant_ends_tomorrow",
      props: (c) => ({ plan: grantedPlan(c), expiresAt: emailDate(c.enrollment.anchorAt) }),
    }),
    step({
      key: "grant_ended",
      offsetHours: 24,
      template: "grant_ended",
      props: (c) => ({ plan: grantedPlan(c), expiresAt: emailDate(c.enrollment.anchorAt) }),
    }),
    step({ key: "grant_feedback", offsetHours: 120, template: "grant_feedback", props: (c) => ({ plan: grantedPlan(c) }) }),
  ],
  (c) => {
    if (!c.user) return "not_user";
    // The critic's fix: a lapsed grant (FREE, no expiry, after the anchor) keeps running.
    return grantExpiryExitReason({
      anchorAt: c.enrollment.anchorAt,
      now: c.now,
      plan: c.user.plan,
      planExpiresAt: c.user.planExpiresAt,
      hasActivePaidSubscription: c.hasActivePaidSubscription,
    });
  }
);

const winbackInactive = def(
  "winback_inactive",
  "user",
  "Daily sweep: Free users inactive 21+ days after a first document (once per 90 days)",
  [
    step({
      key: "winback_one_thing",
      offsetHours: 0,
      template: "winback_one_thing",
      props: () => ({ headline: WHATS_NEW.headline, body: WHATS_NEW.body, ctaLabel: WHATS_NEW.ctaLabel, ctaUrl: WHATS_NEW.ctaUrl }),
    }),
    step({ key: "winback_ask", offsetHours: 168, template: "winback_ask", props: () => ({}) }),
    step({
      key: "winback_bonus",
      offsetHours: 336,
      template: "winback_bonus",
      // Bonus words ship behind REFERRALS_ENABLED with the rest of the bonus pool.
      when: () => sendIf(referralsEnabled()),
      condition: "Only while bonus words are enabled (REFERRALS_ENABLED); the words are granted first",
      effect: "winback_bonus",
      props: () => ({ words: WINBACK_BONUS_WORDS }),
    }),
  ],
  (c) => {
    if (!c.user) return "not_user";
    if (c.hasActivePaidSubscription || c.user.effectivePlan !== "FREE") return "converted";
    if (c.contact.lastActiveAt && c.contact.lastActiveAt > c.enrollment.enrolledAt) return "active_again";
    return null;
  }
);

const checkoutAbandoned = def(
  "checkout_abandoned",
  "user",
  "Daily sweep: a checkout started 24-72 hours ago without a subscription",
  [
    step({
      key: "checkout_help",
      offsetHours: 24,
      template: "checkout_help",
      props: (c) => {
        const plan = grantedPlan(c);
        return { plan, monthly: PLANS[plan].price, annual: PLANS[plan].priceAnnual ?? 0 };
      },
    }),
  ],
  (c) => {
    if (!c.user) return "not_user";
    return c.hasActivePaidSubscription ? "converted" : null;
  }
);

const nurtureProps = (c: SequenceContext) => (c.enrollment.context.magnet ? { magnet: c.enrollment.context.magnet } : {});

const leadNurture = def(
  "lead_nurture",
  "lead",
  "A lead confirms tips by double opt-in",
  [
    step({ key: "nurture_why_flags", offsetHours: 24, template: "nurture_why_flags", props: nurtureProps }),
    step({ key: "nurture_three_pass", offsetHours: 72, template: "nurture_three_pass", props: nurtureProps }),
    step({
      key: "nurture_evidence",
      offsetHours: 144,
      template: "nurture_evidence",
      props: (c) => ({ ...nurtureProps(c), hasAppealKit: c.contact.magnets.includes(APPEAL_KIT) }),
    }),
    step({
      key: "nurture_free_account",
      offsetHours: 216,
      template: "nurture_free_account",
      when: (c) => sendIf(c.contact.userId === null),
      condition: "Only if they still have no account",
      props: nurtureProps,
    }),
    step({ key: "nurture_keep_going", offsetHours: 336, template: "nurture_keep_going", props: nurtureProps }),
  ],
  (c) => {
    if (c.contact.userId) return "converted";
    if (!c.contact.subscribedTopics.includes("tips")) return "unsubscribed";
    return null;
  }
);

const extensionWaitlist = def(
  "extension_waitlist",
  "any",
  "A waitlist signup confirms",
  [step({ key: "waitlist_update", offsetHours: 168, template: "waitlist_update", props: () => ({}) })],
  (c) => (c.contact.subscribedTopics.includes("extension_launch") ? null : "unsubscribed")
);

export const SEQUENCES: Record<SequenceKey, EngineSequence> = {
  onboarding,
  quota_upgrade: quotaUpgrade,
  grant_expiry: grantExpiry,
  winback_inactive: winbackInactive,
  checkout_abandoned: checkoutAbandoned,
  lead_nurture: leadNurture,
  extension_waitlist: extensionWaitlist,
};

export function getSequence(key: string): EngineSequence | null {
  return Object.prototype.hasOwnProperty.call(SEQUENCES, key) ? SEQUENCES[key as SequenceKey] : null;
}

export function findStep(key: string, stepKey: string): EngineStep | null {
  return getSequence(key)?.steps.find((s) => s.key === stepKey) ?? null;
}

// ── Decisions (pure) ────────────────────────────────────────────────────────

export type StepPlan =
  | { kind: "idle" }
  | { kind: "exit"; reason: string }
  | { kind: "complete" }
  | { kind: "wait"; nextRunAt: Date }
  /** The step's condition says "not yet": leave the enrollment as it is. */
  | { kind: "hold"; step: EngineStep }
  | { kind: "skip"; step: EngineStep; reason: "late" | "condition" }
  | { kind: "send"; step: EngineStep };

/** What to do with one enrollment right now. Exit rules win over everything else. */
export function planEnrollmentStep(
  seq: EngineSequence,
  enr: { status: string; stepIndex: number; anchorAt: Date },
  ctx: SequenceContext,
  now: Date,
  lookAheadHours: number
): StepPlan {
  if (enr.status !== "active") return { kind: "idle" };
  const exit = seq.exitWhen?.(ctx) ?? null;
  if (exit) return { kind: "exit", reason: exit };
  const due = nextDueStep(seq, enr, now, { lookAheadHours });
  switch (due.kind) {
    case "idle":
    case "complete":
    case "wait":
      return due;
    case "skip_late":
      return { kind: "skip", step: due.step as EngineStep, reason: "late" };
    case "send": {
      const s = due.step as EngineStep;
      const decision = s.when ? s.when(ctx) : "send";
      if (decision === "skip") return { kind: "skip", step: s, reason: "condition" };
      if (decision === "wait") return { kind: "hold", step: s };
      return { kind: "send", step: s };
    }
  }
}

export type OutcomeAction = "advance" | "hold" | "stop";

/**
 * After a send attempt: advance to the next step, leave the enrollment for a
 * later run, or stop the whole run (budget gone, sending off, quota used up).
 */
export function actionForOutcome(o: SendOutcome): OutcomeAction {
  switch (o.status) {
    case "sent":
    case "duplicate":
    case "skipped":
      return "advance";
    case "failed":
      if (o.quotaExceeded) return "stop";
      return o.retryable ? "hold" : "advance";
    case "deferred":
      return o.reason === "budget" || o.reason === "disabled" || o.reason === "not_configured" ? "stop" : "hold";
  }
}

export type DeliverabilityContact = {
  userId: string | null;
  lifecycleEmails: boolean;
  subscribedTopics: readonly string[];
};

/** Can any step from `stepIndex` on still reach this contact? False → exit as unsubscribed. */
export function hasDeliverableStepsLeft(seq: Pick<EngineSequence, "steps">, stepIndex: number, contact: DeliverabilityContact): boolean {
  return seq.steps.slice(stepIndex).some((s) => {
    const meta = TEMPLATES[s.template];
    switch (meta.stream) {
      case "transactional":
        return true;
      case "lifecycle":
        return !!contact.userId && contact.lifecycleEmails;
      case "personal":
        return contact.lifecycleEmails;
      case "marketing":
        return !!meta.topic && contact.subscribedTopics.includes(meta.topic);
    }
  });
}

/** Steps (from the first) that would be skipped as late if enrolled now with this anchor: for the backfill dry run. */
export function lateStepsAt(seq: Pick<EngineSequence, "steps">, anchorAt: Date, now: Date): number {
  let late = 0;
  for (const s of seq.steps) {
    const due = anchorAt.getTime() + s.offsetHours * 3_600_000;
    if (now.getTime() - due > (s.maxLateHours ?? 48) * 3_600_000) late++;
  }
  return late;
}

/** A context with plausible values, for admin previews of a step. */
export function sampleContext(key: SequenceKey, now: Date = new Date()): SequenceContext {
  const anchorAt = key === "grant_expiry" ? new Date(now.getTime() + 14 * 86_400_000) : now;
  return {
    now,
    enrollment: {
      id: "preview",
      sequenceKey: key,
      cycle: "preview",
      anchorAt,
      enrolledAt: now,
      stepIndex: 0,
      context: {
        magnet: APPEAL_KIT,
        grantDays: key === "grant_expiry" ? DEFAULT_GRANT_DAYS : undefined,
        plan: key === "grant_expiry" ? "TEAM" : "PRO",
        trialCode: "PASS-SAMPLE",
        trialExpiresAt: new Date(now.getTime() + TRIAL_PASS_REDEEM_HOURS * 3_600_000).toISOString(),
      },
    },
    contact: {
      id: "preview",
      userId: key === "lead_nurture" ? null : "preview",
      subscribedTopics: ["tips", "extension_launch"],
      lifecycleEmails: true,
      magnets: [APPEAL_KIT],
      firstDocumentAt: null,
      lastActiveAt: null,
    },
    user: key === "lead_nurture" ? null : { plan: "FREE", effectivePlan: "FREE", planExpiresAt: null, createdAt: now },
    hasActivePaidSubscription: false,
    wordsUsed30d: 12_400,
    checkoutSinceEnrollment: false,
  };
}
