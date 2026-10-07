// ===========================================================
// lib/plans.ts — Plan limits and the offer around them (tones, Voice Match,
// the guarantee, Founding 100, the Word Pack, founder services). Every number
// shown on the site, in the app and in emails comes from here, so copy can't
// drift from what the code enforces. Imported by client components too: env
// reads that must stay server-side live in functions, not constants.
// ===========================================================

export type PlanId = "FREE" | "PRO" | "TEAM";

export interface PlanConfig {
  id: PlanId;
  name: string;
  /** Monthly price in USD */
  price: number;
  /** Annual price in USD (billed yearly) */
  priceAnnual?: number;
  wordsLimit: number;
  wordsLimitPeriod: "day" | "month";
  rewriteLimit: number;
  rewriteLimitPeriod: "day" | "month";
  maxTextLength: number;
  /** How many of TONES the plan may use (Free: Standard only). Enforced in /api/humanize. */
  toneOptions: number;
  /** Saved Voice Match profiles (Pro annual gets PRO_ANNUAL_VOICE_PROFILES instead). */
  voiceProfiles: number;
  /** Days of history retained; null = unlimited; 0 = none */
  historyDays: number | null;
  apiAccess: boolean;
  watermark: boolean;
  /** Requests per minute */
  rateLimit: number;
  /** API requests per month (0 = no access) */
  apiRequestsLimit: number;
  /** Max API keys allowed (0 for FREE, 3 for PRO, 10 for TEAM) */
  apiKeysMax: number;
  /** Lemon Squeezy variant ID (monthly) — set LEMONSQUEEZY_PRO_VARIANT_ID / LEMONSQUEEZY_TEAM_VARIANT_ID */
  lsVariantId: string | null;
  /** Lemon Squeezy variant ID (annual) — set LEMONSQUEEZY_PRO_ANNUAL_VARIANT_ID / LEMONSQUEEZY_TEAM_ANNUAL_VARIANT_ID */
  lsVariantIdAnnual?: string | null;
  uploadEnabled: boolean;
  uploadMaxWords: number;
  uploadMonthlyLimit: number;
}

export const PLANS: Record<PlanId, PlanConfig> = {
  FREE: {
    id: "FREE",
    name: "Free",
    price: 0,
    wordsLimit: 500,
    wordsLimitPeriod: "day",
    rewriteLimit: 1,
    rewriteLimitPeriod: "day",
    maxTextLength: 5_000,
    toneOptions: 1,
    voiceProfiles: 0,
    historyDays: 0,
    apiAccess: false,
    watermark: true,
    rateLimit: 5,
    apiRequestsLimit: 0,
    apiKeysMax: 0,
    lsVariantId: null,
    uploadEnabled: false,
    uploadMaxWords: 0,
    uploadMonthlyLimit: 0,
  },
  PRO: {
    id: "PRO",
    name: "Pro",
    price: 9,
    priceAnnual: 79,
    wordsLimit: 50_000,
    wordsLimitPeriod: "month",
    rewriteLimit: -1, // unlimited
    rewriteLimitPeriod: "month",
    maxTextLength: 10_000,
    toneOptions: 5,
    voiceProfiles: 1,
    historyDays: 30,
    apiAccess: true,
    watermark: false,
    rateLimit: 20,
    apiRequestsLimit: 1_000,
    apiKeysMax: 3,
    lsVariantId: process.env.LEMONSQUEEZY_PRO_VARIANT_ID ?? null,
    lsVariantIdAnnual: process.env.LEMONSQUEEZY_PRO_ANNUAL_VARIANT_ID ?? null,
    uploadEnabled: true,
    uploadMaxWords: 10_000,
    uploadMonthlyLimit: 20,
  },
  TEAM: {
    id: "TEAM",
    name: "Team",
    price: 29,
    priceAnnual: 249,
    wordsLimit: 200_000,
    wordsLimitPeriod: "month",
    rewriteLimit: -1, // unlimited
    rewriteLimitPeriod: "month",
    maxTextLength: 10_000,
    toneOptions: 5,
    voiceProfiles: 10,
    historyDays: null, // unlimited
    apiAccess: true,
    watermark: false,
    rateLimit: 60,
    apiRequestsLimit: 10_000,
    apiKeysMax: 10,
    lsVariantId: process.env.LEMONSQUEEZY_TEAM_VARIANT_ID ?? null,
    lsVariantIdAnnual: process.env.LEMONSQUEEZY_TEAM_ANNUAL_VARIANT_ID ?? null,
    uploadEnabled: true,
    uploadMaxWords: 50_000,
    uploadMonthlyLimit: 100,
  },
} as const;

/**
 * Find a plan by its Lemon Squeezy variant ID (monthly or annual).
 */
export function getPlanByVariantId(variantId: string): PlanConfig | null {
  return (
    Object.values(PLANS).find(
      (plan) =>
        plan.lsVariantId === variantId ||
        plan.lsVariantIdAnnual === variantId
    ) ?? null
  );
}

// ===========================================================
// Organizations — per-seat program
// An Organization buys N seats. Each seat grants a member TEAM-tier features
// and contributes `wordsPerSeat` to the org's pooled monthly word allowance.
// ===========================================================

export const ORG_SEAT = {
  /** Monthly price per seat (USD). */
  pricePerSeatMonthly: 12,
  /** Annual price per seat (USD, billed yearly — ~2 months free). */
  pricePerSeatAnnual: 120,
  /** Pooled monthly words granted per purchased seat. */
  wordsPerSeat: 100_000,
  /** A new org must start with at least this many seats. */
  minSeats: 2,
  /** Safety cap on a single self-serve org. */
  maxSeats: 500,
  /** Lemon Squeezy variant for the per-seat subscription (quantity = seats). */
  lsVariantId: process.env.LEMONSQUEEZY_SEAT_VARIANT_ID ?? null,
  lsVariantIdAnnual: process.env.LEMONSQUEEZY_SEAT_ANNUAL_VARIANT_ID ?? null,
} as const;

/** Members of an org inherit TEAM-tier feature flags. */
export const ORG_MEMBER_PLAN: PlanConfig = PLANS.TEAM;

/** Total pooled monthly word allowance for an org with `seats` seats. */
export function orgWordsLimit(seats: number): number {
  return Math.max(0, seats) * ORG_SEAT.wordsPerSeat;
}

/** Monthly list price for `seats` seats (before any discount). */
export function orgMonthlyPrice(seats: number): number {
  return Math.max(0, seats) * ORG_SEAT.pricePerSeatMonthly;
}

// ===========================================================
// Tones — Free gets Standard; paid plans get all five the editor offers.
// "storytelling" predates the editor list and stays reachable on paid plans
// for API callers, but it is not advertised as one of the five.
// ===========================================================

export const TONES = ["standard", "formal", "casual", "academic", "professional"] as const;
export type AdvertisedTone = (typeof TONES)[number];
export const FREE_TONE: AdvertisedTone = "standard";

/** Whether `planId` may rewrite with `tone`. Unknown tones are the caller's problem (they coerce to standard). */
export function isToneAllowed(planId: PlanId, tone: string): boolean {
  return PLANS[planId].toneOptions > 1 || tone === FREE_TONE;
}

// ===========================================================
// Voice Match — saved style fingerprints. Annual Pro gets 3 (an annual-only
// bonus), and so do Founding members, who prepaid two years.
// ===========================================================

export const PRO_ANNUAL_VOICE_PROFILES = 3;

export function voiceProfileLimit(planId: PlanId, opts: { annual?: boolean; founding?: boolean } = {}): number {
  if (planId === "PRO" && (opts.annual || opts.founding)) return PRO_ANNUAL_VOICE_PROFILES;
  return PLANS[planId].voiceProfiles;
}

// ===========================================================
// The "Sounds Like You" guarantee — one policy everywhere (/refunds, the home
// FAQ, the plan menu, emails). It is about satisfaction, never a detector score.
// ===========================================================

export const GUARANTEE_DAYS = 14;
export const TEAM_ANNUAL_GUARANTEE_DAYS = 30;

// ===========================================================
// One-time offers (LemonSqueezy one-time products). Each is hidden while its
// variant env var is unset; read the env inside functions so client bundles
// never inline a server-only value.
// ===========================================================

type Env = Record<string, string | undefined>;

/** Founding 100: two years of Pro, paid once, hard cap of 100 buyers. */
export const FOUNDING = {
  priceUsd: 99,
  seats: 100,
  months: 24,
  /** planExpiresAt moves this many days out per purchase. */
  grantDays: 730,
} as const;

export function foundingVariantId(env: Env = process.env): string | null {
  return env.LEMONSQUEEZY_FOUNDING_VARIANT_ID?.trim() || null;
}

/**
 * The plan expiry a founding purchase sets: two years from now, or from the
 * end of a live Pro grant so a stacked purchase never shortens what was paid.
 */
export function foundingExpiry(user: { plan: string; planExpiresAt: Date | null }, now: Date = new Date()): Date {
  const live = user.plan === "PRO" && user.planExpiresAt && user.planExpiresAt.getTime() > now.getTime();
  const base = live ? user.planExpiresAt!.getTime() : now.getTime();
  return new Date(base + FOUNDING.grantDays * 86_400_000);
}

export type WordPackConfig = { variantId: string; priceUsd: number; words: number; days: number };

const positiveInt = (raw: string | undefined, fallback: number): number => {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : fallback;
};

/** Word Pack (downsell, Test A): $5 for 20,000 bonus words valid 60 days. Null when not on sale. */
export function wordPackConfig(env: Env = process.env): WordPackConfig | null {
  const variantId = env.LEMONSQUEEZY_WORDPACK_VARIANT_ID?.trim();
  if (!variantId) return null;
  return {
    variantId,
    priceUsd: 5,
    words: positiveInt(env.WORDPACK_WORDS, 20_000),
    days: positiveInt(env.WORDPACK_DAYS, 60),
  };
}

export type OneTimeOffer = "founding" | "wordpack";

/** Which one-time offer a LemonSqueezy variant sells, if any (subscription variants return null). */
export function oneTimeOfferForVariant(variantId: string, env: Env = process.env): OneTimeOffer | null {
  if (!variantId) return null;
  if (variantId === foundingVariantId(env)) return "founding";
  if (variantId === wordPackConfig(env)?.variantId) return "wordpack";
  return null;
}

// ===========================================================
// Founder services — real founder time, so each has a hard monthly cap shared
// by everyone (resets on the 1st, UTC) and one request per account.
// Requests become CrmTasks of the same kind for the founder's task list.
// ===========================================================

export const FOUNDER_SERVICES = {
  founder_review: {
    name: "Founder's First-Document Review",
    plans: ["PRO"] as PlanId[],
    monthlyCap: 10,
  },
  team_setup: {
    name: "30-minute Workflow Setup",
    plans: ["TEAM"] as PlanId[],
    monthlyCap: 10,
  },
} as const;
export type FounderService = keyof typeof FOUNDER_SERVICES;
export const FOUNDER_SERVICE_KINDS = Object.keys(FOUNDER_SERVICES) as FounderService[];

export function isFounderService(value: unknown): value is FounderService {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(FOUNDER_SERVICES, value);
}

/** First instant of the current UTC month: the caps count requests from here. */
export function monthStartUtc(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}
