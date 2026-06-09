import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/admin";
import { getSignupSeries, getDocumentSeries, getAdminMetrics } from "@/lib/admin-metrics";
import { THEME } from "@/lib/theme";
import { KpiCard, SectionTitle, BarSeries } from "@/components/admin/kpi";
import { Users, FileText, Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";

function ChartCard({ title, color, total, data }: { title: string; color: string; total: number; data: { day: string; count: number }[] }) {
  return (
    <div style={{ background: THEME.surface2, border: `1px solid ${THEME.border}`, borderRadius: THEME.radiusLg, padding: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: THEME.text, fontFamily: THEME.fontHeading }}>{title}</span>
        <span className="tnum" style={{ fontSize: 13, color: THEME.textDim }}>{total.toLocaleString()} in 30d</span>
      </div>
      <BarSeries data={data} color={color} height={140} />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 11, color: THEME.textMuted }}>
        <span>{data[0]?.day}</span>
        <span>{data[data.length - 1]?.day}</span>
      </div>
    </div>
  );
}

export default async function AdminGrowthPage() {
  if (!(await getAdminUser())) redirect("/dashboard");
  const [m, signups, docs] = await Promise.all([getAdminMetrics(), getSignupSeries(30), getDocumentSeries(30)]);
  const signupTotal = signups.reduce((s, d) => s + d.count, 0);
  const docTotal = docs.reduce((s, d) => s + d.count, 0);

  return (
    <div style={{ maxWidth: 1040, margin: "0 auto", padding: "32px 28px", fontFamily: THEME.fontSans }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: THEME.text, fontFamily: THEME.fontHeading, letterSpacing: "-0.02em" }}>Growth</h1>
      <p style={{ fontSize: 14, color: THEME.textDim, marginTop: 4 }}>Signups and document activity over time.</p>

      <SectionTitle>At a glance</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
        <KpiCard icon={Users} label="Total users" value={m.totalUsers.toLocaleString()} sub={`+${m.newUsers7d} this week · +${m.newUsers30d} this month`} />
        <KpiCard icon={FileText} label="Documents" value={m.totalDocuments.toLocaleString()} sub={`+${m.docs7d} this week`} />
        <KpiCard icon={Sparkles} label="Words processed" value={m.wordsProcessed.toLocaleString()} accent={THEME.accent} />
      </div>

      <SectionTitle>Last 30 days</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
        <ChartCard title="Signups / day" color={THEME.brand} total={signupTotal} data={signups} />
        <ChartCard title="Documents / day" color={THEME.accent} total={docTotal} data={docs} />
      </div>
    </div>
  );
}
