// ===========================================================
// API key authentication for /api/v1/ routes
// ===========================================================

import crypto from "crypto";
import { db } from "@/lib/db";
import { PLANS, type PlanId } from "@/lib/plans";

/**
 * Generate a new API key in the format sk_live_<32 random chars>
 */
export function generateApiKey(): string {
  return `sk_live_${crypto.randomBytes(24).toString("base64url").slice(0, 32)}`;
}

/**
 * Mask an API key for display: sk_live_••••••1234
 */
export function maskApiKey(key: string): string {
  if (key.length < 12) return "••••••";
  return `${key.slice(0, 8)}${"••••••"}${key.slice(-4)}`;
}

interface ApiKeyAuthResult {
  userId: string;
  plan: PlanId;
  apiKeyId: string;
}

/**
 * Authenticate a request using an API key from the Authorization header.
 * Returns user info or null if invalid.
 */
export async function authenticateApiKey(request: Request): Promise<ApiKeyAuthResult | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer sk_live_")) return null;

  const key = authHeader.slice(7); // Remove "Bearer "

  const apiKey = await db.apiKey.findUnique({
    where: { key },
    include: { user: true },
  });

  if (!apiKey) return null;

  // Update last used timestamp and increment request count
  await db.apiKey.update({
    where: { id: apiKey.id },
    data: {
      lastUsedAt: new Date(),
      requestCount: { increment: 1 },
    },
  });

  const plan = (apiKey.user.plan as PlanId) ?? "FREE";
  const planConfig = PLANS[plan];

  // Check if plan allows API access
  if (!planConfig.apiAccess) return null;

  // Check monthly request limit
  if (apiKey.requestCount >= planConfig.apiRequestsLimit) return null;

  return {
    userId: apiKey.user.id,
    plan,
    apiKeyId: apiKey.id,
  };
}
