import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/admin";
import { getAdminMetrics, getSignupSeries } from "@/lib/admin-metrics";
import { THEME } from "@/lib/theme";
import { KpiCard, SectionTitle, Sparkline } from "@/components/admin/kpi";
import {
  Users, FileText, DollarSign, Building2, Sparkles, TrendingUp, Crown, Zap,
  Gift, AlertTriangle, UserCheck, Hash,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  if (!(await getAdminUser())) redirect("/dashboard");
  const [m, signups] = await Promise.all([getAdminMetrics(), getSignupSeries(30)]);

  const money = (n: number) => `$${n.toLocaleString()}`;
  const planTotal = m.totalUsers || 1;

  return (
    <div style={{ maxWidth: 1040, margin: "0 auto", padding: "32px 28px", fontFamily: THEME.fontSans }}>
      <div style={{ marginBottom: 8 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: THEME.text, fontFamily: THEME.fontHeading, letterSpacing: "-0.02em" }}>Overview</h1>
        <p style={{ fontSize: 14, color: THEME.textDim, marginTop: 4 }}>Real revenue vs. comped access, growth, and usage.</p>
      </div>

      {/* Cleanup alert: non-FREE users whose grant already expired */}
      {m.grantsExpired > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: THEME.warnDim, border: `1px solid ${THEME.warn}`, borderRadius: THEME.radius, padding: "12px 16px", margin: "16px 0 4px" }}>
          <AlertTriangle size={16} color={THEME.warn} aria-hidden="true" />
          <span style={{ fontSize: 13, color: THEME.text }}>
            <strong>{m.grantsExpired}</strong> user{m.grantsExpired === 1 ? "" : "s"} still on a paid plan past their grant expiry — they should be downgraded to FREE.
          </span>
        </div>
      )}

      {/* Revenue (real money) */}
      <SectionTitle sub="Actual LemonSqueezy subscriptions only — discount-code grants are excluded.">Revenue</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
        <KpiCard icon={DollarSign} label="Paid MRR (real)" value={money(m.paidMrr)} sub={`${m.paidIndividuals} subs · ${m.paidSeats} paid seats`} accent={THEME.human} />
        <KpiCard icon={UserCheck} label="Paying customers" value={(m.paidIndividuals + m.paidOrgs).toLocaleString()} sub={`${m.paidPro} PRO · ${m.paidTeam} TEAM · ${m.paidOrgs} orgs`} accent={THEME.human} />
        <KpiCard icon={TrendingUp} label="True paid conversion" value={`${m.trueConversionPct.toFixed(1)}%`} sub="paying customers / all users" accent={THEME.human} />
      </div>

      {/* Comped (discount codes) */}
      <SectionTitle sub="PRO/TEAM access granted via discount codes — looks like paid, isn't revenue.">Comped access</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
        <KpiCard icon={Gift} label="Comped users" value={m.compedUsers.toLocaleString()} sub={`${m.compedPro} PRO · ${m.compedTeam} TEAM`} accent={THEME.accent} />
        <KpiCard icon={DollarSign} label="Comped value / mo" value={money(m.compedMrrValue)} sub="list-price value of comped plans" accent={THEME.accent} />
        <KpiCard icon={Hash} label="Redemptions" value={m.redemptionsTotal.toLocaleString()} sub={`${m.usersOnCode} users · ${m.grantsExpiringSoon} expiring ≤7d`} accent={THEME.accent} />
      </div>

      {/* Growth */}
      <SectionTitle>Growth</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
        <KpiCard icon={Users} label="Total users" value={m.totalUsers.toLocaleString()} sub={`+${m.newUsers7d} this week · +${m.newUsers30d} this month`} />
        <div style={{ background: THEME.surface2, border: `1px solid ${THEME.border}`, borderRadius: THEME.radiusLg, padding: 20, gridColumn: "span 2", minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <TrendingUp size={15} color={THEME.brand} aria-hidden="true" />
            <span style={{ fontSize: 12, color: THEME.textDim, fontWeight: 600 }}>Signups · last 30 days</span>
          </div>
          <Sparkline data={signups.map((d) => d.count)} width={520} height={48} />
        </div>
      </div>

      {/* Usage */}
      <SectionTitle>Usage</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
        <KpiCard icon={FileText} label="Documents" value={m.totalDocuments.toLocaleString()} sub={`+${m.docs7d} this week`} />
        <KpiCard icon={Sparkles} label="Words processed" value={m.wordsProcessed.toLocaleString()} />
        <KpiCard icon={Building2} label="Active seats" value={m.activeMembers.toLocaleString()} sub={`${m.paidOrgs} paid orgs`} accent={THEME.accent} />
      </div>

      {/* Plan distribution */}
      <SectionTitle>Plan distribution</SectionTitle>
      <div style={{ background: THEME.surface2, border: `1px solid ${THEME.border}`, borderRadius: THEME.radiusLg, padding: 24 }}>
        {([
          { plan: "FREE", icon: Zap, color: THEME.textMuted },
          { plan: "PRO", icon: Sparkles, color: THEME.brand },
          { plan: "TEAM", icon: Crown, color: THEME.accent },
        ] as const).map(({ plan, icon: Icon, color }) => {
          const count = m.planCounts[plan] ?? 0;
          const pct = Math.round((count / planTotal) * 100);
          const paid = plan === "PRO" ? m.paidPro : plan === "TEAM" ? m.paidTeam : 0;
          return (
            <div key={plan} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, color: THEME.text, fontWeight: 600 }}>
                  <Icon size={14} color={color} aria-hidden="true" /> {plan}
                </span>
                <span className="tnum" style={{ fontSize: 13, color: THEME.textDim }}>
                  {count.toLocaleString()} · {pct}%{plan !== "FREE" ? ` · ${paid} paid / ${count - paid} comped` : ""}
                </span>
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
