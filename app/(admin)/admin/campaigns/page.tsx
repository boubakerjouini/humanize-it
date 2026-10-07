"use client";

// ===========================================================
// /admin/campaigns — One-off marketing emails: status, recipients and results
// per campaign, and "New campaign". Arriving with ?segmentRef= or ?filter=
// (from the contacts page or a segment) opens a new draft for that audience.
// ===========================================================

import { Suspense, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { THEME } from "@/lib/theme";
import { Empty, PageHeader, Panel, Pill, fmtDate, primaryBtn, tableStyles } from "@/components/admin/crm-ui";
import { EmailStatusBanner } from "@/components/admin/email/status-banner";
import { CAMPAIGN_STATUS_COLORS, pct } from "@/components/admin/email/api";
import { useApi } from "@/components/admin/email/use-api";

type Stats = { queued: number; sent: number; delivered: number; bounced: number; complained: number; skipped: number; failed: number; cancelled: number };
type Campaign = {
  id: string;
  name: string;
  topic: string;
  subject: string;
  status: string;
  recipientCount: number;
  createdAt: string;
  confirmedAt: string | null;
  completedAt: string | null;
  stats: Stats | null;
};

function NewFromAudience() {
  const params = useSearchParams();
  const segmentRef = params.get("segmentRef");
  const filter = params.get("filter");
  useEffect(() => {
    if (!segmentRef && !filter) return;
    const next = new URLSearchParams();
    if (segmentRef) next.set("segmentRef", segmentRef);
    if (filter) next.set("filter", filter);
    window.location.replace(`/admin/campaigns/new?${next.toString()}`);
  }, [segmentRef, filter]);
  return null;
}

export default function CampaignsPage() {
  const { data, error, loading } = useApi<{ items: Campaign[] }>("/api/admin/campaigns");
  const items = data?.items ?? [];

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 28px", fontFamily: THEME.fontSans }}>
      <Suspense fallback={null}>
        <NewFromAudience />
      </Suspense>
      <PageHeader
        title="Campaigns"
        description="One-off emails to people who opted in. Draft, preview, test to yourself, then confirm with the recipient count."
        actions={
          <Link href="/admin/campaigns/new" style={primaryBtn}>
            <Plus size={14} aria-hidden="true" /> New campaign
          </Link>
        }
      />
      <EmailStatusBanner />

      <Panel flush>
        {error ? (
          <Empty title="Couldn't load campaigns" description={error} />
        ) : loading ? (
          <Empty title="Loading…" />
        ) : items.length === 0 ? (
          <Empty
            title="No campaigns yet"
            description="The extension launch email and occasional tips go out as campaigns."
            action={
              <Link href="/admin/campaigns/new" style={primaryBtn}>
                Write the first one
              </Link>
            }
          />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyles.table}>
              <thead>
                <tr>
                  {["Campaign", "Status", "Recipients", "Sent", "Delivered", "Bounced", "Created"].map((h) => (
                    <th key={h} scope="col" style={tableStyles.th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((c) => {
                  const s = c.stats;
                  return (
                    <tr key={c.id} style={tableStyles.tr}>
                      <td style={{ ...tableStyles.td, minWidth: 240 }}>
                        <Link href={`/admin/campaigns/${c.id}`} style={{ fontWeight: 600, color: THEME.text, textDecoration: "none" }}>
                          {c.name}
                        </Link>
                        <div style={{ fontSize: 12, color: THEME.textMuted, marginTop: 2 }}>{c.subject}</div>
                      </td>
                      <td style={tableStyles.td}>
                        <Pill color={CAMPAIGN_STATUS_COLORS[c.status] ?? THEME.textMuted}>{c.status}</Pill>
                      </td>
                      <td className="tnum" style={tableStyles.td}>{c.recipientCount || "—"}</td>
                      <td className="tnum" style={tableStyles.td}>
                        {s ? s.sent : "—"}
                        {s && s.queued ? <span style={{ color: THEME.textMuted }}> (+{s.queued} queued)</span> : null}
                      </td>
                      <td className="tnum" style={tableStyles.td}>{s ? pct(s.delivered, s.sent) : "—"}</td>
                      <td className="tnum" style={tableStyles.td}>{s ? pct(s.bounced, s.sent) : "—"}</td>
                      <td style={{ ...tableStyles.td, fontSize: 12 }}>{fmtDate(c.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
