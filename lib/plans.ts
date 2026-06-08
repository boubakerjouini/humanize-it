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
  toneOptions: number;
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
    toneOptions: 3,
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
    toneOptions: 3,
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
