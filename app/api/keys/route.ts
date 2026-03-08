// ===========================================================
// POST /api/keys — Create a new API key (Clerk session auth)
// GET  /api/keys — List user's API keys (Clerk session auth)
// ===========================================================

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { PLANS, type PlanId } from "@/lib/plans";
import { generateApiKey, hashApiKey, getKeyPrefix } from "@/lib/api-key-auth";

export async function GET() {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Authentication required." } },
        { status: 401 }
      );
    }

    const user = await db.user.findUnique({
      where: { clerkId },
      include: {
        apiKeys: { orderBy: { createdAt: "desc" } },
      },
    });

    if (!user) {
      return NextResponse.json({ keys: [] });
    }

    const plan = PLANS[(user.plan as PlanId) ?? "FREE"];

    return NextResponse.json({
      keys: user.apiKeys.map((k) => ({
        id: k.id,
        name: k.name,
        keyPrefix: k.keyPrefix,
        monthlyRequestCount: k.monthlyRequestCount,
        monthlyResetAt: k.monthlyResetAt,
        lastUsedAt: k.lastUsedAt,
        revokedAt: k.revokedAt,
        createdAt: k.createdAt,
      })),
      plan: user.plan,
      apiAccess: plan.apiAccess,
      apiRequestsLimit: plan.apiRequestsLimit,
      apiKeysMax: plan.apiKeysMax,
    });
  } catch (err) {
    console.error("[api/keys] GET error:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Something went wrong." } },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Authentication required." } },
        { status: 401 }
      );
    }

    const user = await db.user.findUnique({
      where: { clerkId },
      include: { apiKeys: { where: { revokedAt: null } } },
    });

    if (!user) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "User not found." } },
        { status: 404 }
      );
    }

    const plan = PLANS[(user.plan as PlanId) ?? "FREE"];
    if (!plan.apiAccess) {
      return NextResponse.json(
        { error: { code: "PLAN_REQUIRED", message: "API access requires a Pro or Team plan." } },
        { status: 403 }
      );
    }

    // Check key limit
    const activeKeys = user.apiKeys.length;
    if (activeKeys >= plan.apiKeysMax) {
      return NextResponse.json(
        { error: { code: "KEY_LIMIT", message: `You can have at most ${plan.apiKeysMax} active API keys on your ${plan.name} plan.` } },
        { status: 403 }
      );
    }

    // Parse body for name
    let name = "Default";
    try {
      const body = await req.json();
      if (typeof body.name === "string" && body.name.trim().length > 0) {
        name = body.name.trim().slice(0, 50);
      }
    } catch {
      // No body or invalid JSON — use default name
    }

    const rawKey = generateApiKey();
    const keyHash = hashApiKey(rawKey);
    const keyPrefix = getKeyPrefix(rawKey);

    // Calculate first monthly reset: first day of next month
    const now = new Date();
    const monthlyResetAt = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const apiKey = await db.apiKey.create({
      data: {
        userId: user.id,
        name,
        keyHash,
        keyPrefix,
        monthlyResetAt,
      },
    });

    return NextResponse.json({
      id: apiKey.id,
      name: apiKey.name,
      keyPrefix: apiKey.keyPrefix,
      key: rawKey, // FULL RAW KEY — only time it is returned
      createdAt: apiKey.createdAt,
    });
  } catch (err) {
    console.error("[api/keys] POST error:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Something went wrong." } },
      { status: 500 }
    );
  }
}
