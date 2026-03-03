export type PlanId = "FREE" | "PRO" | "TEAM";

export interface PlanConfig {
  id: PlanId;
  name: string;
  /** Monthly price in USD */
  price: number;
  /** Annual price in USD (one-time charge, billed yearly) */
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
  /** Stripe monthly price ID */
  stripePriceId: string | null;
  /** Stripe annual price ID — set STRIPE_PRO_ANNUAL_PRICE_ID / STRIPE_TEAM_ANNUAL_PRICE_ID */
  stripePriceIdAnnual?: string | null;
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
    stripePriceId: null,
  },
  PRO: {
    id: "PRO",
    name: "Pro",
    price: 9,
    priceAnnual: 79, // ~$6.58/mo billed annually
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
    stripePriceId: process.env.STRIPE_PRO_PRICE_ID ?? null,
    stripePriceIdAnnual: process.env.STRIPE_PRO_ANNUAL_PRICE_ID ?? null,
  },
  TEAM: {
    id: "TEAM",
    name: "Team",
    price: 29,
    priceAnnual: 249, // ~$20.75/mo billed annually
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
    stripePriceId: process.env.STRIPE_TEAM_PRICE_ID ?? null,
    stripePriceIdAnnual: process.env.STRIPE_TEAM_ANNUAL_PRICE_ID ?? null,
  },
} as const;

/**
 * Find a plan by its Stripe price ID (monthly or annual).
 * Returns null if the price ID does not match any configured plan.
 */
export function getPlanByStripePriceId(priceId: string): PlanConfig | null {
  return (
    Object.values(PLANS).find(
      (plan) =>
        plan.stripePriceId === priceId ||
        plan.stripePriceIdAnnual === priceId
    ) ?? null
  );
}
