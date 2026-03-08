// ===========================================================
// API key authentication for /api/v1/ routes — hash-based
// ===========================================================

import crypto from "crypto";
import { db } from "@/lib/db";
import { PLANS, type PlanId } from "@/lib/plans";

export function generateApiKey(): string {
  return `sk_live_${crypto.randomBytes(24).toString("base64url").slice(0, 32)}`;
}

export function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

export function getKeyPrefix(key: string): string {
  return key.slice(0, 12); // "sk_live_XXXX"
}

export function maskApiKey(prefix: string): string {
  return `${prefix}${"•".repeat(24)}`;
}

export interface ApiKeyAuthResult {
  userId: string;
  plan: PlanId;
  apiKeyId: string;
  monthlyRequestCount: number;
  monthlyResetAt: Date;
  apiRequestsLimit: number;
}

/**
 * Authenticate a request using an API key from the Authorization header.
 * Hash the incoming key and look up by keyHash.
 * Also checks: revokedAt is null, plan allows API, resets monthly count if needed.
 */
export async function authenticateApiKey(request: Request): Promise<ApiKeyAuthResult | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer sk_live_")) return null;

  const key = authHeader.slice(7); // Remove "Bearer "
  const keyHash = hashApiKey(key);

  const apiKey = await db.apiKey.findUnique({
    where: { keyHash },
    include: { user: true },
  });

  if (!apiKey) return null;

  // Revoked keys are invalid
  if (apiKey.revokedAt) return null;

  const plan = (apiKey.user.plan as PlanId) ?? "FREE";
  const planConfig = PLANS[plan];

  // Check if plan allows API access
  if (!planConfig.apiAccess) return null;

  // Reset monthly count if needed
  const now = new Date();
  let monthlyRequestCount = apiKey.monthlyRequestCount;
  let monthlyResetAt = apiKey.monthlyResetAt;

  if (now >= apiKey.monthlyResetAt) {
    // Calculate next reset: first day of next month
    const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    monthlyRequestCount = 0;
    monthlyResetAt = nextReset;

    await db.apiKey.update({
      where: { id: apiKey.id },
      data: {
        monthlyRequestCount: 0,
        monthlyResetAt: nextReset,
      },
    });
  }

  // Check monthly request limit
  if (monthlyRequestCount >= planConfig.apiRequestsLimit) return null;

  // Update last used timestamp and increment request count
  await db.apiKey.update({
    where: { id: apiKey.id },
    data: {
      lastUsedAt: now,
      monthlyRequestCount: { increment: 1 },
    },
  });

  return {
    userId: apiKey.user.id,
    plan,
    apiKeyId: apiKey.id,
    monthlyRequestCount: monthlyRequestCount + 1,
    monthlyResetAt,
    apiRequestsLimit: planConfig.apiRequestsLimit,
  };
}
