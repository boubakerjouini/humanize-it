import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/admin";
import { getRedemptionAnalytics, getAdminMetrics } from "@/lib/admin-metrics";
import { THEME } from "@/lib/theme";
import { KpiCard, SectionTitle } from "@/components/admin/kpi";
import { Gift, Hash, Clock, Ticket } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminRedemptionsPage() {
  if (!(await getAdminUser())) redirect("/dashboard");
  const [m, { codes, total, byPlan }] = await Promise.all([getAdminMetrics(), getRedemptionAnalytics()]);

  return (
    <div style={{ maxWidth: 1040, margin: "0 auto", padding: "32px 28px", fontFamily: THEME.fontSans }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: THEME.text, fontFamily: THEME.fontHeading, letterSpacing: "-0.02em" }}>Redemptions</h1>
      <p style={{ fontSize: 14, color: THEME.textDim, marginTop: 4 }}>Discount-code uptake — how comped access is being distributed.</p>

      <SectionTitle>Summary</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
        <KpiCard icon={Gift} label="Total redemptions" value={total.toLocaleString()} sub={`${m.usersOnCode} distinct users`} accent={THEME.accent} />
        <KpiCard icon={Hash} label="By plan" value={`${byPlan.PRO ?? 0} PRO · ${byPlan.TEAM ?? 0} TEAM`} sub="redeemed grants" accent={THEME.brand} />
        <KpiCard icon={Clock} label="Expiring ≤ 7 days" value={m.grantsExpiringSoon.toLocaleString()} sub="grants about to lapse" accent={THEME.warn} />
      </div>

      <SectionTitle>Codes</SectionTitle>
      {codes.length === 0 ? (
        <div style={{ background: THEME.surface2, border: `1px solid ${THEME.border}`, borderRadius: THEME.radiusLg, padding: 28, textAlign: "center", color: THEME.textMuted, fontSize: 14 }}>
          <Ticket size={20} aria-hidden="true" style={{ marginBottom: 8 }} />
          <div>No discount codes yet. Create them under Discount codes.</div>
        </div>
      ) : (
        <div style={{ background: THEME.surface2, border: `1px solid ${THEME.border}`, borderRadius: THEME.radiusLg, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 0.7fr 0.9fr 0.9fr 0.8fr", padding: "12px 18px", borderBottom: `1px solid ${THEME.border}`, fontSize: 11, fontWeight: 700, color: THEME.textMuted, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            <span>Code</span><span>Plan</span><span>Duration</span><span>Used</span><span>Redemptions</span>
          </div>
          {codes.map((c) => (
            <div key={c.id} style={{ display: "grid", gridTemplateColumns: "1.4fr 0.7fr 0.9fr 0.9fr 0.8fr", padding: "13px 18px", borderBottom: `1px solid ${THEME.border}`, fontSize: 13, color: THEME.text, alignItems: "center" }}>
              <span style={{ fontFamily: THEME.fontMono, fontWeight: 600 }}>{c.code}</span>
              <span style={{ color: c.plan === "TEAM" ? THEME.accent : THEME.brand, fontWeight: 600 }}>{c.plan}</span>
              <span style={{ color: THEME.textDim }}>{c.grantDays ? `${c.grantDays}d` : "Lifetime"}</span>
              <span className="tnum" style={{ color: THEME.textDim }}>{c.usedCount}/{c.maxUses}</span>
              <span className="tnum" style={{ fontWeight: 700 }}>{c.redemptions}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
