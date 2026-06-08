// ===========================================================
// lib/organizations.ts — Per-seat organization helpers
//
// Model: an Organization owns `seatsTotal` paid seats. Each Membership with
// seatActive=true occupies one seat and entitles that user to TEAM-tier
// features. Accepting a seat sets the member's User.plan = TEAM so every
// existing feature gate (uploads, API, tones, history) immediately honours it;
// vacating a seat recomputes the member's plan from their own subscription.
// ===========================================================

import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import type { OrgRole, Prisma } from "@/app/generated/prisma/client";
import { ORG_SEAT } from "@/lib/plans";

// ---- Slugs & tokens ----

export function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base || "team";
}

/** Generate a slug unique across organizations (appends -2, -3, … on collision). */
export async function uniqueOrgSlug(name: string): Promise<string> {
  const base = slugify(name);
  let candidate = base;
  let n = 1;
  // Bounded loop — collisions are rare.
  while (await db.organization.findUnique({ where: { slug: candidate }, select: { id: true } })) {
    n += 1;
    candidate = `${base}-${n}`;
    if (n > 50) {
      candidate = `${base}-${randomBytes(3).toString("hex")}`;
      break;
    }
  }
  return candidate;
}

/** Cryptographically-random, URL-safe invite token. */
export function newInviteToken(): string {
  return randomBytes(24).toString("base64url");
}

// ---- Membership resolution ----

const membershipWithOrg = {
  include: { organization: true },
} satisfies Prisma.MembershipDefaultArgs;

export type MembershipWithOrg = Prisma.MembershipGetPayload<typeof membershipWithOrg>;

/** The user's active (seat-occupying) membership, if any. */
export async function getActiveMembership(userId: string): Promise<MembershipWithOrg | null> {
  return db.membership.findFirst({
    where: { userId, seatActive: true },
    include: { organization: true },
    orderBy: { createdAt: "asc" },
  });
}

/** Roles allowed to manage seats, invites and billing. */
export function isOrgManager(role: OrgRole): boolean {
  return role === "OWNER" || role === "ADMIN";
}

// ---- Seat accounting ----

export interface SeatUsage {
  seatsTotal: number;
  used: number;
  available: number;
  pendingInvites: number;
}

export async function orgSeatUsage(organizationId: string): Promise<SeatUsage> {
  const [org, used, pendingInvites] = await Promise.all([
    db.organization.findUnique({ where: { id: organizationId }, select: { seatsTotal: true } }),
    db.membership.count({ where: { organizationId, seatActive: true } }),
    db.invitation.count({ where: { organizationId, status: "PENDING" } }),
  ]);
  const seatsTotal = org?.seatsTotal ?? 0;
  // Pending invites reserve a seat so two managers can't oversubscribe.
  const available = Math.max(0, seatsTotal - used - pendingInvites);
  return { seatsTotal, used, available, pendingInvites };
}

// ---- Plan synchronization ----

/**
 * Recompute and persist a member's effective User.plan after a seat change.
 * Priority: active personal subscription > active org seat > FREE.
 */
export async function recomputeUserPlan(userId: string): Promise<void> {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { subscription: true, memberships: { where: { seatActive: true } } },
  });
  if (!user) return;

  const hasPaidSub =
    user.subscription &&
    (user.subscription.status === "active" || user.subscription.status === "past_due");

  let plan: "FREE" | "PRO" | "TEAM" = "FREE";
  if (hasPaidSub) {
    // Keep whatever their own subscription grants (looked up by variant elsewhere);
    // default such users to their existing plan if non-FREE.
    plan = user.plan === "FREE" ? "PRO" : user.plan;
  } else if (user.memberships.length > 0) {
    plan = "TEAM";
  }

  if (plan !== user.plan) {
    await db.user.update({ where: { id: userId }, data: { plan, planExpiresAt: null } });
  }
}

/** Grant a user a seat's TEAM entitlement immediately. */
export async function applySeatEntitlement(userId: string): Promise<void> {
  await db.user.update({
    where: { id: userId },
    data: { plan: "TEAM", planExpiresAt: null },
  });
}

/**
 * Restore a member's personal plan after they vacate a seat, using the snapshot
 * captured when the seat was granted. A still-valid personal grant (paid
 * subscription, or a redeem grant that hasn't expired) is preserved instead of
 * being wiped to FREE.
 */
export async function restorePersonalPlan(
  userId: string,
  priorPlan: "FREE" | "PRO" | "TEAM" | null,
  priorPlanExpiresAt: Date | null
): Promise<void> {
  const stillValid =
    priorPlan != null &&
    priorPlan !== "FREE" &&
    (priorPlanExpiresAt == null || priorPlanExpiresAt.getTime() > Date.now());

  await db.user.update({
    where: { id: userId },
    data: stillValid
      ? { plan: priorPlan, planExpiresAt: priorPlanExpiresAt }
      : { plan: "FREE", planExpiresAt: null },
  });
}

// ---- Pooled monthly word usage (aggregate, informational) ----

/** Reset an org's pooled monthly word counter when its period has elapsed. */
export async function checkAndResetOrgQuota(org: {
  id: string;
  quotaResetAt: Date;
}): Promise<void> {
  const next = new Date(org.quotaResetAt);
  next.setMonth(next.getMonth() + 1);
  if (new Date() >= next) {
    await db.organization.update({
      where: { id: org.id },
      data: { wordsUsed: 0, quotaResetAt: new Date() },
    });
  }
}

/** Total pooled word allowance for an org based on its seat count. */
export function orgPooledLimit(seatsTotal: number): number {
  return seatsTotal * ORG_SEAT.wordsPerSeat;
}
