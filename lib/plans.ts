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
  /** Lemon Squeezy variant ID (monthly) — set LEMONSQUEEZY_PRO_VARIANT_ID / LEMONSQUEEZY_TEAM_VARIANT_ID */
  lsVariantId: string | null;
  /** Lemon Squeezy variant ID (annual) — set LEMONSQUEEZY_PRO_ANNUAL_VARIANT_ID / LEMONSQUEEZY_TEAM_ANNUAL_VARIANT_ID */
  lsVariantIdAnnual?: string | null;
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
    lsVariantId: null,
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
    apiAccess: false,
    watermark: false,
    rateLimit: 20,
    lsVariantId: process.env.LEMONSQUEEZY_PRO_VARIANT_ID ?? null,
    lsVariantIdAnnual: process.env.LEMONSQUEEZY_PRO_ANNUAL_VARIANT_ID ?? null,
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
    lsVariantId: process.env.LEMONSQUEEZY_TEAM_VARIANT_ID ?? null,
    lsVariantIdAnnual: process.env.LEMONSQUEEZY_TEAM_ANNUAL_VARIANT_ID ?? null,
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
