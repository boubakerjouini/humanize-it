// ===========================================================
// /admin/referrals — referral program report: codes created, referees,
// rewards, words granted, top referrers, recent referrals and why some were
// rejected. The program is off unless REFERRALS_ENABLED is set; the page says
// so and still shows any history. Every read falls back to empty.
// ===========================================================

import Link from "next/link";
import { redirect } from "next/navigation";
import { Gift, Share2, Ticket, UserPlus } from "lucide-react";
import { getAdminUser } from "@/lib/admin";
import { db } from "@/lib/db";
import { THEME } from "@/lib/theme";
import { referralsEnabled } from "@/lib/growth/flags";
import { REFERRAL_REWARD_WORDS } from "@/lib/growth/referrals";
import { KpiCard } from "@/components/admin/kpi";
import { Empty, PageHeader, Panel, Pill, fmtDate, tableStyles } from "@/components/admin/crm-ui";
import { contactLabel } from "@/components/admin/crm/contact-bits";

export const dynamic = "force-dynamic";

const STATUS_COLORS: Record<string, string> = { pending: THEME.warn, rewarded: THEME.human, rejected: THEME.ai };

export default async function ReferralsPage() {
  if (!(await getAdminUser())) redirect("/dashboard");
  const enabled = referralsEnabled();

  const [codes, byStatus, words, top, recent, rejections] = await Promise.all([
    db.contact.count({ where: { referralCode: { not: null } } }).catch(() => 0),
    db.referral.groupBy({ by: ["status"], _count: { _all: true } }).catch(() => []),
    db.referral.aggregate({ _sum: { rewardWords: true } }).catch(() => null),
    db.referral
      .groupBy({ by: ["referrerContactId"], _count: { _all: true }, orderBy: { _count: { referrerContactId: "desc" } }, take: 10 })
      .catch(() => []),
    db.referral
      .findMany({
        orderBy: { createdAt: "desc" },
        take: 25,
        include: {
          referrer: { select: { id: true, name: true, email: true } },
          referee: { select: { id: true, name: true, email: true } },
        },
      })
      .catch(() => []),
    db.referral.groupBy({ by: ["rejectReason"], where: { status: "rejected" }, _count: { _all: true } }).catch(() => []),
  ]);

  const count = (status: string) => byStatus.find((s) => s.status === status)?._count._all ?? 0;
  const referees = byStatus.reduce((sum, s) => sum + s._count._all, 0);
  const referrers = top.length
    ? await db.contact
        .findMany({ where: { id: { in: top.map((t) => t.referrerContactId) } }, select: { id: true, name: true, email: true, referralCode: true } })
        .catch(() => [])
    : [];
  const rewardedBy = top.length
    ? await db.referral
        .groupBy({ by: ["referrerContactId"], where: { status: "rewarded", referrerContactId: { in: top.map((t) => t.referrerContactId) } }, _count: { _all: true } })
        .catch(() => [])
    : [];

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 28px", fontFamily: THEME.fontSans }}>
      <PageHeader
        title="Referrals"
        description={`Both people get ${REFERRAL_REWARD_WORDS.toLocaleString("en-US")} bonus words once the friend runs a first document.`}
        actions={<Pill color={enabled ? THEME.human : THEME.textMuted}>{enabled ? "Program on" : "Program off"}</Pill>}
      />
      {!enabled ? (
        <div role="note" style={{ padding: "12px 16px", marginBottom: 16, borderRadius: THEME.radius, background: THEME.surface1, border: `1px solid ${THEME.border}`, fontSize: 13, color: THEME.textDim }}>
          The referral program is off. Set <code>REFERRALS_ENABLED=true</code> to show referral links in the app. History below stays visible either way.
        </div>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 16 }}>
        <KpiCard icon={Ticket} label="Codes created" value={codes.toLocaleString()} />
        <KpiCard icon={UserPlus} label="Referees" value={referees.toLocaleString()} sub={`${count("pending")} pending · ${count("rejected")} rejected`} />
        <KpiCard icon={Share2} label="Rewarded" value={count("rewarded").toLocaleString()} accent={THEME.human} />
        <KpiCard icon={Gift} label="Words granted" value={((words?._sum.rewardWords ?? 0) * 2).toLocaleString()} accent={THEME.accent} sub="referrer and friend each get the reward" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16, marginBottom: 16 }}>
        <Panel title="Top referrers" flush>
          {top.length === 0 ? (
            <Empty title="No referrals yet" />
          ) : (
            <table style={tableStyles.table}>
              <thead>
                <tr>
                  {["Referrer", "Code", "Referees", "Rewarded"].map((h) => (
                    <th key={h} style={tableStyles.th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {top.map((t) => {
                  const c = referrers.find((r) => r.id === t.referrerContactId);
                  return (
                    <tr key={t.referrerContactId} style={tableStyles.tr}>
                      <td style={tableStyles.td}>
                        <Link href={`/admin/contacts/${t.referrerContactId}`} style={{ color: THEME.text, fontWeight: 600 }}>
                          {c ? contactLabel(c) : t.referrerContactId}
                        </Link>
                      </td>
                      <td style={{ ...tableStyles.td, fontFamily: THEME.fontMono }}>{c?.referralCode ?? "—"}</td>
                      <td className="tnum" style={tableStyles.td}>
                        {t._count._all}
                      </td>
                      <td className="tnum" style={tableStyles.td}>
                        {rewardedBy.find((r) => r.referrerContactId === t.referrerContactId)?._count._all ?? 0}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Panel>
        <Panel title="Rejection reasons" flush>
          {rejections.length === 0 ? (
            <Empty title="No rejections" />
          ) : (
            <table style={tableStyles.table}>
              <tbody>
                {rejections.map((r) => (
                  <tr key={r.rejectReason ?? "none"} style={tableStyles.tr}>
                    <td style={tableStyles.td}>{r.rejectReason ? r.rejectReason.replace(/_/g, " ") : "no reason recorded"}</td>
                    <td className="tnum" style={{ ...tableStyles.td, textAlign: "right" }}>
                      {r._count._all}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>

      <Panel title="Recent referrals" flush>
        {recent.length === 0 ? (
          <Empty title="Nothing yet" description={enabled ? "Referrals show up here as friends sign up." : undefined} />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyles.table}>
              <thead>
                <tr>
                  {["Referrer", "Friend", "Status", "Words", "Date"].map((h) => (
                    <th key={h} style={tableStyles.th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recent.map((r) => (
                  <tr key={r.id} style={tableStyles.tr}>
                    <td style={tableStyles.td}>
                      <Link href={`/admin/contacts/${r.referrer.id}`} style={{ color: THEME.text }}>
                        {contactLabel(r.referrer)}
                      </Link>
                    </td>
                    <td style={tableStyles.td}>
                      <Link href={`/admin/contacts/${r.referee.id}`} style={{ color: THEME.text }}>
                        {contactLabel(r.referee)}
                      </Link>
                    </td>
                    <td style={tableStyles.td}>
                      <Pill color={STATUS_COLORS[r.status] ?? THEME.textMuted}>{r.status}</Pill>
                      {r.rejectReason ? <div style={{ fontSize: 11, color: THEME.textMuted }}>{r.rejectReason.replace(/_/g, " ")}</div> : null}
                    </td>
                    <td className="tnum" style={tableStyles.td}>
                      {r.rewardWords ? r.rewardWords.toLocaleString() : "—"}
                    </td>
                    <td style={{ ...tableStyles.td, whiteSpace: "nowrap" }}>{fmtDate(r.rewardedAt ?? r.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
