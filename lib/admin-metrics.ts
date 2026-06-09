// ===========================================================
// lib/admin-metrics.ts — honest platform metrics for the admin dashboard.
//
// The key distinction the old dashboard missed: a PRO/TEAM user can be either
//   • PAID  — has an active LemonSqueezy `Subscription` row (real money), or
//   • COMPED — got the plan by redeeming a discount code (app/api/redeem),
//              which sets User.plan + planExpiresAt with NO Subscription and
//              NO payment.
// Counting every non-FREE user as "paid" overstated revenue. These helpers
// separate real paid MRR from comped grants and surface redemption health.
// ===========================================================

import { db } from "@/lib/db";
import { PLANS, ORG_SEAT } from "@/lib/plans";

const DAY = 86_400_000;
export function since(days: number): Date {
  return new Date(Date.now() - days * DAY);
}
export function until(days: number): Date {
  return new Date(Date.now() + days * DAY);
}

export interface AdminMetrics {
  totalUsers: number;
  newUsers7d: number;
  newUsers30d: number;
  planCounts: Record<string, number>;

  // Real money
  paidIndividuals: number;
  paidPro: number;
  paidTeam: number;
  paidOrgs: number;
  paidSeats: number;
  paidMrr: number; // real recurring revenue
  trueConversionPct: number; // paying customers / total users

  // Comped (discount-code) access — looks like paid access, isn't revenue
  compedUsers: number;
  compedPro: number;
  compedTeam: number;
  compedMrrValue: number; // what comped users would be worth at list price

  // Redemption health
  redemptionsTotal: number;
  usersOnCode: number;
  grantsExpiringSoon: number; // planExpiresAt within 7 days
  grantsExpired: number; // plan != FREE but planExpiresAt already passed (cleanup signal)

  // Usage
  totalDocuments: number;
  docs7d: number;
  wordsProcessed: number;
  activeMembers: number;
}

export async function getAdminMetrics(): Promise<AdminMetrics> {
  const now = new Date();
  const [
    totalUsers,
    planGroups,
    newUsers7d,
    newUsers30d,
    totalDocuments,
    docs7d,
    wordAgg,
    activeSubs,
    paidOrgList,
    activeMembers,
    redemptionsTotal,
    usersOnCodeRows,
    grantsExpiringSoon,
    grantsExpired,
  ] = await Promise.all([
    db.user.count(),
    db.user.groupBy({ by: ["plan"], _count: { _all: true } }),
    db.user.count({ where: { createdAt: { gte: since(7) } } }),
    db.user.count({ where: { createdAt: { gte: since(30) } } }),
    db.document.count(),
    db.document.count({ where: { createdAt: { gte: since(7) } } }),
    db.document.aggregate({ _sum: { wordCount: true } }),
    db.subscription.findMany({ where: { status: "active" }, include: { user: { select: { plan: true } } } }),
    db.organization.findMany({ where: { status: "active", lsSubscriptionId: { not: null } }, select: { seatsTotal: true } }),
    db.membership.count({ where: { seatActive: true } }),
    db.redemption.count(),
    db.redemption.findMany({ select: { userId: true }, distinct: ["userId"] }),
    db.user.count({ where: { plan: { not: "FREE" }, planExpiresAt: { gte: now, lte: until(7) } } }),
    db.user.count({ where: { plan: { not: "FREE" }, planExpiresAt: { lt: now } } }),
  ]);

  const planCounts: Record<string, number> = { FREE: 0, PRO: 0, TEAM: 0 };
  for (const g of planGroups) planCounts[g.plan] = g._count._all;

  // Real money: individual active subscriptions, split by tier, + paid org seats.
  const paidPro = activeSubs.filter((s) => s.user.plan === "PRO").length;
  const paidTeam = activeSubs.filter((s) => s.user.plan === "TEAM").length;
  const paidIndividuals = activeSubs.length;
  const subsMrr = activeSubs.reduce((sum, s) => sum + (PLANS[s.user.plan]?.price ?? 0), 0);
  const paidSeats = paidOrgList.reduce((sum, o) => sum + o.seatsTotal, 0);
  const orgMrr = paidSeats * ORG_SEAT.pricePerSeatMonthly;
  const paidMrr = subsMrr + orgMrr;
  const payingCustomers = paidIndividuals + paidOrgList.length;
  const trueConversionPct = totalUsers > 0 ? (payingCustomers / totalUsers) * 100 : 0;

  // Comped: non-FREE users without a paying individual subscription.
  const compedPro = Math.max(0, planCounts.PRO - paidPro);
  const compedTeam = Math.max(0, planCounts.TEAM - paidTeam);
  const compedUsers = compedPro + compedTeam;
  const compedMrrValue = compedPro * (PLANS.PRO?.price ?? 0) + compedTeam * (PLANS.TEAM?.price ?? 0);

  return {
    totalUsers,
    newUsers7d,
    newUsers30d,
    planCounts,
    paidIndividuals,
    paidPro,
    paidTeam,
    paidOrgs: paidOrgList.length,
    paidSeats,
    paidMrr,
    trueConversionPct,
    compedUsers,
    compedPro,
    compedTeam,
    compedMrrValue,
    redemptionsTotal,
    usersOnCode: usersOnCodeRows.length,
    grantsExpiringSoon,
    grantsExpired,
    totalDocuments,
    docs7d,
    wordsProcessed: wordAgg._sum.wordCount ?? 0,
    activeMembers,
  };
}

export interface DayPoint {
  day: string; // YYYY-MM-DD
  count: number;
}

/** Daily signups for the last `days` days (UTC), zero-filled. */
export async function getSignupSeries(days = 30): Promise<DayPoint[]> {
  const rows = await db.$queryRaw<{ day: Date; n: number }[]>`
    SELECT date_trunc('day', "createdAt") AS day, count(*)::int AS n
    FROM "User"
    WHERE "createdAt" >= ${since(days)}
    GROUP BY 1 ORDER BY 1`;
  return zeroFill(rows, days);
}

/** Daily documents processed for the last `days` days (UTC), zero-filled. */
export async function getDocumentSeries(days = 30): Promise<DayPoint[]> {
  const rows = await db.$queryRaw<{ day: Date; n: number }[]>`
    SELECT date_trunc('day', "createdAt") AS day, count(*)::int AS n
    FROM "Document"
    WHERE "createdAt" >= ${since(days)}
    GROUP BY 1 ORDER BY 1`;
  return zeroFill(rows, days);
}

function zeroFill(rows: { day: Date; n: number }[], days: number): DayPoint[] {
  const map = new Map<string, number>();
  for (const r of rows) map.set(new Date(r.day).toISOString().slice(0, 10), Number(r.n));
  const out: DayPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const key = since(i).toISOString().slice(0, 10);
    out.push({ day: key, count: map.get(key) ?? 0 });
  }
  return out;
}

export interface CodeRow {
  id: string;
  code: string;
  plan: string;
  maxUses: number;
  usedCount: number;
  grantDays: number | null;
  redemptions: number;
}

/** Discount codes with live redemption counts, newest first. */
export async function getRedemptionAnalytics(): Promise<{ codes: CodeRow[]; total: number; byPlan: Record<string, number> }> {
  const codes = await db.discountCode.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { redemptions: true } } },
  });
  const byPlan: Record<string, number> = { PRO: 0, TEAM: 0 };
  let total = 0;
  const rows: CodeRow[] = codes.map((c) => {
    const r = c._count.redemptions;
    total += r;
    byPlan[c.plan] = (byPlan[c.plan] ?? 0) + r;
    return { id: c.id, code: c.code, plan: c.plan, maxUses: c.maxUses, usedCount: c.usedCount, grantDays: c.grantDays, redemptions: r };
  });
  return { codes: rows, total, byPlan };
}
