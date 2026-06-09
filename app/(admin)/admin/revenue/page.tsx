import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/admin";
import { getAdminMetrics } from "@/lib/admin-metrics";
import { PLANS, ORG_SEAT } from "@/lib/plans";
import { THEME } from "@/lib/theme";
import { KpiCard, SectionTitle } from "@/components/admin/kpi";
import { DollarSign, UserCheck, Gift, AlertTriangle, Clock } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminRevenuePage() {
  if (!(await getAdminUser())) redirect("/dashboard");
  const m = await getAdminMetrics();
  const money = (n: number) => `$${n.toLocaleString()}`;

  const tiers = [
    { tier: "PRO", price: PLANS.PRO.price, paid: m.paidPro, comped: m.compedPro, color: THEME.brand },
    { tier: "TEAM", price: PLANS.TEAM.price, paid: m.paidTeam, comped: m.compedTeam, color: THEME.accent },
    { tier: "Org seats", price: ORG_SEAT.pricePerSeatMonthly, paid: m.paidSeats, comped: 0, color: THEME.human },
  ];

  return (
    <div style={{ maxWidth: 1040, margin: "0 auto", padding: "32px 28px", fontFamily: THEME.fontSans }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: THEME.text, fontFamily: THEME.fontHeading, letterSpacing: "-0.02em" }}>Revenue</h1>
      <p style={{ fontSize: 14, color: THEME.textDim, marginTop: 4 }}>What&apos;s actually paid vs. granted via discount codes.</p>

      <SectionTitle>Money in the door</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
        <KpiCard icon={DollarSign} label="Paid MRR (real)" value={money(m.paidMrr)} sub="active subscriptions + paid seats" accent={THEME.human} />
        <KpiCard icon={UserCheck} label="Paying customers" value={(m.paidIndividuals + m.paidOrgs).toLocaleString()} sub={`${m.trueConversionPct.toFixed(1)}% of all users`} accent={THEME.human} />
        <KpiCard icon={Gift} label="Comped value / mo" value={money(m.compedMrrValue)} sub={`${m.compedUsers} users on free grants`} accent={THEME.accent} />
      </div>

      <SectionTitle sub="Paid = real LemonSqueezy subscription. Comped = discount-code grant (no payment).">By tier</SectionTitle>
      <div style={{ background: THEME.surface2, border: `1px solid ${THEME.border}`, borderRadius: THEME.radiusLg, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr 1fr 1fr", gap: 0, padding: "12px 18px", borderBottom: `1px solid ${THEME.border}`, fontSize: 11, fontWeight: 700, color: THEME.textMuted, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          <span>Tier</span><span>List price</span><span>Paid</span><span>Comped</span><span>Paid MRR</span>
        </div>
        {tiers.map((t) => (
          <div key={t.tier} style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr 1fr 1fr", gap: 0, padding: "13px 18px", borderBottom: `1px solid ${THEME.border}`, fontSize: 13, color: THEME.text, alignItems: "center" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: t.color }} /> {t.tier}
            </span>
            <span className="tnum" style={{ color: THEME.textDim }}>{money(t.price)}</span>
            <span className="tnum" style={{ color: THEME.human, fontWeight: 600 }}>{t.paid}</span>
            <span className="tnum" style={{ color: THEME.accent }}>{t.comped || "—"}</span>
            <span className="tnum" style={{ fontWeight: 700 }}>{money(t.paid * t.price)}</span>
          </div>
        ))}
      </div>

      <SectionTitle>Grant health</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
        <KpiCard icon={Clock} label="Expiring ≤ 7 days" value={m.grantsExpiringSoon.toLocaleString()} sub="code grants about to lapse" accent={THEME.warn} />
        <KpiCard icon={AlertTriangle} label="Expired, still paid" value={m.grantsExpired.toLocaleString()} sub="should be downgraded to FREE" accent={m.grantsExpired > 0 ? THEME.ai : THEME.textMuted} />
        <KpiCard icon={Gift} label="Total redemptions" value={m.redemptionsTotal.toLocaleString()} sub={`${m.usersOnCode} distinct users`} accent={THEME.accent} />
      </div>

      <p style={{ fontSize: 12, color: THEME.textMuted, marginTop: 20, lineHeight: 1.6 }}>
        Note: most PRO/TEAM users today are <strong>comped via discount codes</strong>, not paying. &ldquo;Paid MRR&rdquo; reflects
        only real LemonSqueezy subscriptions — the number to grow.
      </p>
    </div>
  );
}
