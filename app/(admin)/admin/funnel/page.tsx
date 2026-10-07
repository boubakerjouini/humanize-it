// ===========================================================
// /admin/funnel — where people come from and how far they get:
// lead → signup → activated (first document within 7 days) → paying, by
// first-touch channel and by lead source, plus magnets, sequences, the
// Rule-of-100 outreach tracker, offer numbers (Founding 100, word packs) and
// comped plans about to end. ?days=30 (default) or 90. Read-only server page;
// lib/crm/metrics.ts does the counting.
// ===========================================================

import Link from "next/link";
import { redirect } from "next/navigation";
import { BadgeCheck, Crown, Flame, Inbox, MailCheck, Package, UserPlus, Zap } from "lucide-react";
import { getAdminUser } from "@/lib/admin";
import { getSignupSeries, type DayPoint } from "@/lib/admin-metrics";
import { THEME } from "@/lib/theme";
import { appUrl } from "@/lib/growth/flags";
import { MAGNETS } from "@/lib/growth/magnets";
import {
  FOUNDING_CAP,
  cohortTotals,
  getAttributionTable,
  getCompedExpiring,
  getFunnel,
  getLeadSeries,
  getMagnetTable,
  getOfferStats,
  getOutreachStats,
  getSequenceStats,
  type AttributionRow,
} from "@/lib/crm/metrics";
import { BarSeries, KpiCard, SectionTitle } from "@/components/admin/kpi";
import { Empty, PageHeader, Panel, fmtDate, tableStyles } from "@/components/admin/crm-ui";
import { FunnelChart } from "@/components/admin/crm/funnel-chart";
import { UtmBuilder } from "@/components/admin/crm/utm-builder";
import { humanizeKey } from "@/components/admin/crm/contact-bits";

export const dynamic = "force-dynamic";

const PERIODS = [30, 90] as const;

function pct(n: number, d: number): string {
  if (d <= 0) return "—";
  return `${Math.round((n / d) * 100)}%`;
}

function delta(now: number, before: number, days: number): string {
  const diff = now - before;
  const sign = diff > 0 ? "+" : diff < 0 ? "−" : "±";
  return `${sign}${Math.abs(diff)} vs the previous ${days} days`;
}

function ChartCard({ title, total, data, color }: { title: string; total: number; data: DayPoint[]; color: string }) {
  return (
    <Panel title={title} actions={<span className="tnum" style={{ fontSize: 13, color: THEME.textDim }}>{total.toLocaleString()} total</span>}>
      <BarSeries data={data} color={color} height={120} />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 11, color: THEME.textMuted }}>
        <span>{data[0]?.day}</span>
        <span>{data[data.length - 1]?.day}</span>
      </div>
    </Panel>
  );
}

function AttributionTable({ rows, keyLabel }: { rows: AttributionRow[]; keyLabel: string }) {
  if (rows.length === 0) return <Empty title="No new contacts in this period" />;
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={tableStyles.table}>
        <thead>
          <tr>
            {[keyLabel, "People", "Leads", "Signed up", "Activated", "Paying", "Paid %"].map((h) => (
              <th key={h} style={tableStyles.th}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} style={tableStyles.tr}>
              <td style={{ ...tableStyles.td, color: THEME.text, fontWeight: 600 }}>{humanizeKey(r.key)}</td>
              {[r.people, r.leads, r.signups, r.activated, r.paying].map((v, i) => (
                <td key={i} className="tnum" style={tableStyles.td}>
                  {v}
                </td>
              ))}
              <td className="tnum" style={tableStyles.td}>
                {pct(r.paying, r.people)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function FunnelPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  if (!(await getAdminUser())) redirect("/dashboard");
  const { days: daysRaw } = await searchParams;
  const days = PERIODS.find((p) => String(p) === daysRaw) ?? 30;

  const [funnel, byChannel, bySource, magnets, sequences, outreach, leadSeries, signupSeries, comped, offer] = await Promise.all([
    getFunnel(days),
    getAttributionTable(days, "channel"),
    getAttributionTable(days, "source"),
    getMagnetTable(days),
    getSequenceStats(days),
    getOutreachStats(30),
    getLeadSeries(days),
    getSignupSeries(days),
    getCompedExpiring(30),
    getOfferStats(days),
  ]);
  const f = funnel.current;
  const p = funnel.previous;
  const cohort = cohortTotals(byChannel);

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "32px 28px", fontFamily: THEME.fontSans }}>
      <PageHeader
        title="Funnel"
        description={`Lead → signup → activated → paying, last ${days} days.`}
        actions={
          <nav aria-label="Period" style={{ display: "inline-flex", border: `1px solid ${THEME.border}`, borderRadius: 9, overflow: "hidden" }}>
            {PERIODS.map((d) => (
              <Link
                key={d}
                href={`/admin/funnel?days=${d}`}
                aria-current={d === days ? "page" : undefined}
                style={{ padding: "7px 14px", fontSize: 13, fontWeight: 600, textDecoration: "none", background: d === days ? THEME.brand : THEME.surface2, color: d === days ? "#fff" : THEME.textDim }}
              >
                {d} days
              </Link>
            ))}
          </nav>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
        <KpiCard icon={Inbox} label="Leads captured" value={f.leads.toLocaleString()} sub={delta(f.leads, p.leads, days)} />
        <KpiCard icon={MailCheck} label="Confirmed (DOI)" value={pct(f.leadsConfirmed, f.leads)} sub={`${f.leadsConfirmed} of ${f.leads} leads`} />
        <KpiCard icon={UserPlus} label="Signups" value={f.signups.toLocaleString()} sub={delta(f.signups, p.signups, days)} />
        <KpiCard icon={Zap} label="Activated" value={f.activated.toLocaleString()} sub={`${pct(f.activated, f.signups)} of signups · first document within 7 days`} accent={THEME.human} />
        <KpiCard icon={BadgeCheck} label="New paying" value={f.newPaying.toLocaleString()} sub={delta(f.newPaying, p.newPaying, days)} accent={THEME.human} />
        <KpiCard icon={Crown} label="Founding seats sold" value={`${offer.foundingSold} / ${FOUNDING_CAP}`} sub={`${Math.max(0, FOUNDING_CAP - offer.foundingSold)} left`} accent={THEME.accent} />
      </div>

      <SectionTitle sub={`The ${cohort.people} ${cohort.people === 1 ? "person" : "people"} who first showed up in the last ${days} days (leads and direct signups), and how far they got.`}>Funnel</SectionTitle>
      <Panel>
        <FunnelChart
          steps={[
            { label: "New people", value: cohort.people, hint: "Leads captured plus people who signed up directly" },
            { label: "Signed up", value: cohort.signups },
            { label: "Activated", value: cohort.activated, hint: "First document within 7 days of signup" },
            { label: "Paying", value: cohort.paying, hint: "A paying subscription or seat today" },
          ]}
        />
      </Panel>

      <SectionTitle>Per day</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
        <ChartCard title="Leads / day" total={leadSeries.reduce((s, d) => s + d.count, 0)} data={leadSeries} color={THEME.accent} />
        <ChartCard title="Signups / day" total={signupSeries.reduce((s, d) => s + d.count, 0)} data={signupSeries} color={THEME.brand} />
      </div>

      <SectionTitle sub="The same people by first-touch channel. Paying means a paying subscription or seat today.">By channel</SectionTitle>
      <Panel flush>
        <AttributionTable rows={byChannel} keyLabel="Channel" />
      </Panel>

      <SectionTitle sub="Same people, by how we first got their email.">By lead source</SectionTitle>
      <Panel flush>
        <AttributionTable rows={bySource} keyLabel="Source" />
      </Panel>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 16, marginTop: 28 }}>
        <Panel title="Lead magnets" description={`People who asked for each in the last ${days} days`} flush>
          <table style={tableStyles.table}>
            <thead>
              <tr>
                {["Magnet", "Captures", "Confirmed", "Signed up"].map((h) => (
                  <th key={h} style={tableStyles.th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {magnets.map((m) => (
                <tr key={m.slug} style={tableStyles.tr}>
                  <td style={{ ...tableStyles.td, color: THEME.text }}>{MAGNETS[m.slug as keyof typeof MAGNETS]?.title ?? m.slug}</td>
                  <td className="tnum" style={tableStyles.td}>
                    {m.captures}
                  </td>
                  <td className="tnum" style={tableStyles.td}>
                    {pct(m.confirmed, m.captures)}
                  </td>
                  <td className="tnum" style={tableStyles.td}>
                    {m.signups}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel
          title="Rule of 100"
          description="Outreach touches per day, logged from the pipeline and contact pages"
          actions={
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: outreach.streak > 0 ? THEME.accentHi : THEME.textMuted }}>
              <Flame size={14} aria-hidden="true" /> {outreach.streak}-day streak
            </span>
          }
        >
          <div className="tnum" style={{ fontSize: 26, fontWeight: 700, color: THEME.text, lineHeight: 1 }}>
            {outreach.today}
            <span style={{ fontSize: 14, color: THEME.textMuted, fontWeight: 600 }}> / {outreach.goal} today</span>
          </div>
          <div style={{ marginTop: 14 }}>
            <BarSeries data={outreach.series} color={THEME.accent} height={80} />
          </div>
          <div style={{ fontSize: 11, color: THEME.textMuted, marginTop: 6 }}>Last 30 days. The streak counts days at goal ({outreach.goal}).</div>
        </Panel>
      </div>

      <SectionTitle>Offer and usage</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
        <KpiCard icon={Package} label="Word packs sold" value={offer.wordPacksSold.toLocaleString()} sub={`${offer.wordPacksInPeriod} in the last ${days} days`} />
        <KpiCard
          icon={Zap}
          label="Words per paid user"
          value={offer.wordsPerPaidUser === null ? "—" : offer.wordsPerPaidUser.toLocaleString()}
          sub={offer.paidUsers ? `average this billing period, ${offer.paidUsers} paying` : "no paying subscribers yet"}
        />
        <KpiCard icon={Zap} label="Passes per rewrite" value="—" sub="Not recorded yet: humanize passes aren't stored per rewrite." />
      </div>
      <Panel title="Signups vs cancellations" description="By month (UTC)" flush style={{ marginTop: 12 }}>
        <table style={tableStyles.table}>
          <thead>
            <tr>
              {["Month", "Signups", "Cancellations"].map((h) => (
                <th key={h} style={tableStyles.th}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {offer.months.map((m) => (
              <tr key={m.month} style={tableStyles.tr}>
                <td style={tableStyles.td}>{m.month}</td>
                <td className="tnum" style={tableStyles.td}>
                  {m.signups}
                </td>
                <td className="tnum" style={tableStyles.td}>
                  {m.cancels}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 16, marginTop: 28 }}>
        <Panel title="Sequences" description={`Last ${days} days`} flush>
          {sequences.length === 0 ? (
            <Empty title="No sequence email yet" description="Turn a sequence on in Sequences to start." />
          ) : (
            <table style={tableStyles.table}>
              <thead>
                <tr>
                  {["Sequence", "Enrolled", "Sent", "Not sent", "Converted"].map((h) => (
                    <th key={h} style={tableStyles.th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sequences.map((s) => (
                  <tr key={s.key} style={tableStyles.tr}>
                    <td style={{ ...tableStyles.td, color: THEME.text }}>{humanizeKey(s.key)}</td>
                    {[s.enrolled, s.sent, s.notSent, s.converted].map((v, i) => (
                      <td key={i} className="tnum" style={tableStyles.td}>
                        {v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel title="Comped plans ending in 30 days" description="Worth a personal email (script D)" flush>
          {comped.length === 0 ? (
            <Empty title="None ending soon" />
          ) : (
            <table style={tableStyles.table}>
              <tbody>
                {comped.map((u) => (
                  <tr key={u.userId} style={tableStyles.tr}>
                    <td style={tableStyles.td}>
                      <Link href={u.contactId ? `/admin/contacts/${u.contactId}` : `/admin/users/${u.userId}`} style={{ color: THEME.text, fontWeight: 600 }}>
                        {u.name || u.email}
                      </Link>
                    </td>
                    <td style={tableStyles.td}>{u.plan}</td>
                    <td style={{ ...tableStyles.td, whiteSpace: "nowrap" }}>ends {fmtDate(u.planExpiresAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>

      <SectionTitle sub="Tag every link you post, so the channel tables above can tell you what works.">UTM link builder</SectionTitle>
      <Panel>
        <UtmBuilder origin={appUrl()} />
      </Panel>
    </div>
  );
}
