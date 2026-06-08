import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getAdminUser } from "@/lib/admin";
import { PLANS, ORG_SEAT } from "@/lib/plans";
import { THEME } from "@/lib/theme";
import { Users, FileText, DollarSign, Building2, Sparkles, TrendingUp, Crown, Zap } from "lucide-react";

export const dynamic = "force-dynamic";

function since(days: number): Date {
  return new Date(Date.now() - days * 86_400_000);
}

async function getMetrics() {
  const [
    totalUsers,
    planGroups,
    newUsers7d,
    newUsers30d,
    totalDocuments,
    docs7d,
    wordAgg,
    activeSubs,
    activeOrgs,
    totalMembers,
  ] = await Promise.all([
    db.user.count(),
    db.user.groupBy({ by: ["plan"], _count: { _all: true } }),
    db.user.count({ where: { createdAt: { gte: since(7) } } }),
    db.user.count({ where: { createdAt: { gte: since(30) } } }),
    db.document.count(),
    db.document.count({ where: { createdAt: { gte: since(7) } } }),
    db.document.aggregate({ _sum: { wordCount: true } }),
    db.subscription.findMany({ where: { status: "active" }, include: { user: { select: { plan: true } } } }),
    db.organization.findMany({ where: { status: "active" }, select: { seatsTotal: true } }),
    db.membership.count({ where: { seatActive: true } }),
  ]);

  const planCounts: Record<string, number> = { FREE: 0, PRO: 0, TEAM: 0 };
  for (const g of planGroups) planCounts[g.plan] = g._count._all;

  // Estimated MRR: individual active subscriptions + org seat subscriptions.
  const subsMrr = activeSubs.reduce((sum, s) => sum + (PLANS[s.user.plan]?.price ?? 0), 0);
  const seatsTotal = activeOrgs.reduce((sum, o) => sum + o.seatsTotal, 0);
  const orgMrr = seatsTotal * ORG_SEAT.pricePerSeatMonthly;

  return {
    totalUsers,
    planCounts,
    newUsers7d,
    newUsers30d,
    totalDocuments,
    docs7d,
    wordsProcessed: wordAgg._sum.wordCount ?? 0,
    activeSubs: activeSubs.length,
    orgCount: activeOrgs.length,
    seatsTotal,
    totalMembers,
    mrr: subsMrr + orgMrr,
  };
}

function Stat({ icon: Icon, label, value, sub, accent }: { icon: typeof Users; label: string; value: string; sub?: string; accent?: string }) {
  const color = accent ?? THEME.brand;
  return (
    <div style={{ background: THEME.surface2, border: `1px solid ${THEME.border}`, borderRadius: THEME.radiusLg, padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Icon size={15} color={color} aria-hidden="true" />
        <span style={{ fontSize: 12, color: THEME.textDim, fontWeight: 600 }}>{label}</span>
      </div>
      <div className="tnum" style={{ fontSize: 28, fontWeight: 700, color: THEME.text, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: THEME.textMuted, marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

export default async function AdminOverviewPage() {
  // Defense-in-depth: don't rely on the layout alone — RSC requests can reach a
  // page segment without re-running the parent layout's guard.
  if (!(await getAdminUser())) redirect("/dashboard");
  const m = await getMetrics();
  const conversion = m.totalUsers > 0 ? Math.round(((m.planCounts.PRO + m.planCounts.TEAM) / m.totalUsers) * 100) : 0;

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 28px", fontFamily: THEME.fontSans }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: THEME.text, fontFamily: THEME.fontHeading, letterSpacing: "-0.02em" }}>Overview</h1>
        <p style={{ fontSize: 14, color: THEME.textDim, marginTop: 4 }}>Live metrics across the platform.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, marginBottom: 24 }}>
        <Stat icon={DollarSign} label="Est. MRR" value={`$${m.mrr.toLocaleString()}`} sub={`${m.activeSubs} subs · ${m.seatsTotal} seats`} accent={THEME.human} />
        <Stat icon={Users} label="Total users" value={m.totalUsers.toLocaleString()} sub={`+${m.newUsers7d} this week · +${m.newUsers30d} this month`} />
        <Stat icon={TrendingUp} label="Paid conversion" value={`${conversion}%`} sub={`${m.planCounts.PRO + m.planCounts.TEAM} paid users`} accent={THEME.accent} />
        <Stat icon={FileText} label="Documents" value={m.totalDocuments.toLocaleString()} sub={`+${m.docs7d} this week`} />
        <Stat icon={Sparkles} label="Words processed" value={m.wordsProcessed.toLocaleString()} />
        <Stat icon={Building2} label="Organizations" value={m.orgCount.toLocaleString()} sub={`${m.totalMembers} seated members`} accent={THEME.accent} />
      </div>

      {/* Plan breakdown */}
      <div style={{ background: THEME.surface2, border: `1px solid ${THEME.border}`, borderRadius: THEME.radiusLg, padding: 24 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: THEME.text, fontFamily: THEME.fontHeading, marginBottom: 16 }}>Plan distribution</h2>
        {([
          { plan: "FREE", icon: Zap, color: THEME.textMuted },
          { plan: "PRO", icon: Sparkles, color: THEME.brand },
          { plan: "TEAM", icon: Crown, color: THEME.accent },
        ] as const).map(({ plan, icon: Icon, color }) => {
          const count = m.planCounts[plan] ?? 0;
          const pct = m.totalUsers > 0 ? Math.round((count / m.totalUsers) * 100) : 0;
          return (
            <div key={plan} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, color: THEME.text, fontWeight: 600 }}>
                  <Icon size={14} color={color} aria-hidden="true" /> {plan}
                </span>
                <span className="tnum" style={{ fontSize: 13, color: THEME.textDim }}>{count.toLocaleString()} · {pct}%</span>
              </div>
              <div style={{ height: 6, background: THEME.surface3, borderRadius: 999 }}>
                <div style={{ height: 6, width: `${pct}%`, background: color, borderRadius: 999, transition: "width 0.5s ease" }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
