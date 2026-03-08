// ===========================================================
// API key management — GET (list) / POST (generate new)
// ===========================================================

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { PLANS, type PlanId } from "@/lib/plans";
import { generateApiKey, maskApiKey } from "@/lib/api-key-auth";

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
      include: { apiKeys: { orderBy: { createdAt: "desc" }, take: 1 } },
    });

    if (!user) {
      return NextResponse.json({ apiKey: null, usage: { requestCount: 0, limit: 0 } });
    }

    const plan = PLANS[(user.plan as PlanId) ?? "FREE"];
    const apiKey = user.apiKeys[0] ?? null;

    return NextResponse.json({
      apiKey: apiKey ? {
        id: apiKey.id,
        maskedKey: maskApiKey(apiKey.key),
        lastUsedAt: apiKey.lastUsedAt,
        requestCount: apiKey.requestCount,
        createdAt: apiKey.createdAt,
      } : null,
      usage: {
        requestCount: apiKey?.requestCount ?? 0,
        limit: plan.apiRequestsLimit,
      },
      plan: user.plan,
      apiAccess: plan.apiAccess,
    });
  } catch (err) {
    console.error("[api-keys] GET error:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Something went wrong." } },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Authentication required." } },
        { status: 401 }
      );
    }

    const user = await db.user.findUnique({ where: { clerkId } });
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

    // Delete existing keys for this user
    await db.apiKey.deleteMany({ where: { userId: user.id } });

    // Generate new key
    const key = generateApiKey();
    const apiKey = await db.apiKey.create({
      data: {
        userId: user.id,
        key,
      },
    });

    return NextResponse.json({
      apiKey: {
        id: apiKey.id,
        key, // Return full key only on creation
        maskedKey: maskApiKey(key),
        createdAt: apiKey.createdAt,
      },
    });
  } catch (err) {
    console.error("[api-keys] POST error:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Something went wrong." } },
      { status: 500 }
    );
  }
}
