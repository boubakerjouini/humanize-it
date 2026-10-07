"use client";

// ===========================================================
// /admin/email-log — Every email the engine handled, in three tabs:
//   Messages        status, reason and retries, filterable, 50 per page
//   Suppressions    the hashed do-not-email list: add by address, lift
//   Deliverability  30-day delivery, bounce and complaint rates per stream
// Plus "Send confirmation to N pending contacts" for double opt-ins nobody clicked.
// ===========================================================

import { useState } from "react";
import Link from "next/link";
import { MailQuestion, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { THEME } from "@/lib/theme";
import { EMAIL_STREAMS } from "@/lib/growth/constants";
import { Empty, PageHeader, Panel, Pill, Row, StatusChip, dangerBtn, disabledStyle, fmtDateTime, fmtRelative, ghostBtn, primaryBtn, tableStyles } from "@/components/admin/crm-ui";
import { ConfirmDialog, Tabs, tabId, tabPanelId } from "@/components/admin/crm-dialogs";
import { EmailStatusBanner } from "@/components/admin/email/status-banner";
import { api, reasonLabel } from "@/components/admin/email/api";
import { useApi } from "@/components/admin/email/use-api";

type Message = {
  id: string;
  template: string;
  stream: string;
  subject: string | null;
  status: string;
  skipReason: string | null;
  error: string | null;
  attempts: number;
  sequenceKey: string | null;
  stepKey: string | null;
  campaignId: string | null;
  toDomain: string | null;
  queuedAt: string;
  sentAt: string | null;
  contact: { id: string; email: string | null; name: string | null } | null;
  campaign: { name: string } | null;
};
type Suppression = {
  id: string;
  hashPrefix: string;
  scope: string;
  reason: string;
  source: string | null;
  note: string | null;
  createdAt: string;
  contact: { id: string; email: string; name: string | null } | null;
};
type StreamHealth = {
  stream: string;
  sent: number;
  delivered: number;
  bounced: number;
  complained: number;
  deliveredRate: number;
  bounceRate: number;
  complaintRate: number;
  bounceLevel: "ok" | "warn" | "bad";
  complaintLevel: "ok" | "warn" | "bad";
};

const MESSAGE_STATUSES = ["queued", "sending", "sent", "delivered", "bounced", "complained", "failed", "skipped", "cancelled", "suppressed"];
const LEVEL_COLORS = { ok: THEME.human, warn: THEME.warn, bad: THEME.ai } as const;
const TAB_PREFIX = "email-log";

const control: React.CSSProperties = {
  padding: "7px 10px",
  borderRadius: 9,
  border: `1px solid ${THEME.border}`,
  background: THEME.surface2,
  color: THEME.text,
  fontSize: 13,
};

function MessagesTab() {
  const [filters, setFilters] = useState({ status: "", stream: "", q: "", from: "", to: "" });
  const [page, setPage] = useState(1);
  const qs = new URLSearchParams({ page: String(page) });
  for (const [k, v] of Object.entries(filters)) if (v) qs.set(k, k === "to" ? `${v}T23:59:59Z` : v);
  const { data, error } = useApi<{ items: Message[]; total: number; page: number; pageSize: number }>(`/api/admin/email/messages?${qs.toString()}`);
  const update = (k: keyof typeof filters, v: string) => {
    setFilters((f) => ({ ...f, [k]: v }));
    setPage(1);
  };

  return (
    <Panel flush>
      <Row gap={8} style={{ padding: "12px 14px", borderBottom: `1px solid ${THEME.border}` }}>
        <select aria-label="Status" value={filters.status} onChange={(e) => update("status", e.target.value)} style={control}>
          <option value="">All statuses</option>
          {MESSAGE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select aria-label="Stream" value={filters.stream} onChange={(e) => update("stream", e.target.value)} style={control}>
          <option value="">All streams</option>
          {EMAIL_STREAMS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <input aria-label="Search contact" placeholder="Contact email or name" value={filters.q} onChange={(e) => update("q", e.target.value)} style={{ ...control, minWidth: 200 }} />
        <label style={{ fontSize: 12, color: THEME.textMuted, display: "inline-flex", alignItems: "center", gap: 6 }}>
          From
          <input type="date" value={filters.from} onChange={(e) => update("from", e.target.value)} style={control} />
        </label>
        <label style={{ fontSize: 12, color: THEME.textMuted, display: "inline-flex", alignItems: "center", gap: 6 }}>
          To
          <input type="date" value={filters.to} onChange={(e) => update("to", e.target.value)} style={control} />
        </label>
      </Row>
      {error ? (
        <Empty title="Couldn't load messages" description={error} />
      ) : !data ? (
        <Empty title="Loading…" />
      ) : data.items.length === 0 ? (
        <Empty title="No messages" description="Nothing matches these filters yet." />
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={tableStyles.table}>
            <thead>
              <tr>
                {["When", "Contact", "Email", "Status", "Reason", "Tries"].map((h) => (
                  <th key={h} scope="col" style={tableStyles.th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.items.map((m) => (
                <tr key={m.id} style={tableStyles.tr}>
                  <td style={{ ...tableStyles.td, fontSize: 12, whiteSpace: "nowrap" }} title={fmtDateTime(m.sentAt ?? m.queuedAt)}>
                    {fmtRelative(m.sentAt ?? m.queuedAt)}
                  </td>
                  <td style={{ ...tableStyles.td, maxWidth: 220 }}>
                    {m.contact ? (
                      <Link href={`/admin/contacts/${m.contact.id}`} style={{ color: THEME.text, textDecoration: "none", fontWeight: 600 }}>
                        {m.contact.name || m.contact.email || m.contact.id}
                      </Link>
                    ) : (
                      <span style={{ color: THEME.textMuted }}>deleted{m.toDomain ? ` (@${m.toDomain})` : ""}</span>
                    )}
                  </td>
                  <td style={{ ...tableStyles.td, maxWidth: 320 }}>
                    <div style={{ color: THEME.text }}>{m.subject ?? m.template.replace(/_/g, " ")}</div>
                    <div style={{ fontSize: 11, color: THEME.textMuted }}>
                      {m.stream}
                      {m.sequenceKey ? ` · ${m.sequenceKey}/${m.stepKey}` : ""}
                      {m.campaign ? ` · campaign: ${m.campaign.name}` : ""}
                    </div>
                  </td>
                  <td style={tableStyles.td}>
                    <StatusChip status={m.status} />
                  </td>
                  <td style={{ ...tableStyles.td, fontSize: 12, maxWidth: 260, overflowWrap: "anywhere" }}>
                    {m.skipReason ? reasonLabel(m.skipReason) : m.error ? <span style={{ color: THEME.ai }}>{m.error}</span> : "—"}
                  </td>
                  <td className="tnum" style={tableStyles.td}>{m.attempts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && data.total > data.pageSize ? (
        <Row justify="space-between" style={{ padding: "10px 14px" }}>
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} style={disabledStyle(ghostBtn, page <= 1)}>
            Previous
          </button>
          <span style={{ fontSize: 12, color: THEME.textMuted }}>
            {data.total} messages · page {data.page} of {Math.ceil(data.total / data.pageSize)}
          </span>
          <button type="button" disabled={page * data.pageSize >= data.total} onClick={() => setPage((p) => p + 1)} style={disabledStyle(ghostBtn, page * data.pageSize >= data.total)}>
            Next
          </button>
        </Row>
      ) : null}
    </Panel>
  );
}

function SuppressionsTab() {
  const { data, error, reload } = useApi<{ items: Suppression[] }>("/api/admin/email/suppressions");
  const [email, setEmail] = useState("");
  const [scope, setScope] = useState("all");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<Suppression | null>(null);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const res = await api("/api/admin/email/suppressions", { method: "POST", json: { email, scope, note: note || undefined } });
    setBusy(false);
    if (!res.ok) return void toast.error(res.message);
    toast.success("Suppressed.");
    setEmail("");
    setNote("");
    reload();
  };

  const remove = async () => {
    if (!removing) return;
    const res = await api(`/api/admin/email/suppressions?id=${encodeURIComponent(removing.id)}`, { method: "DELETE" });
    if (!res.ok) return void toast.error(res.message);
    toast.success("Suppression lifted.");
    setRemoving(null);
    reload();
  };

  return (
    <>
      <Panel title="Add a suppression" description="The address is hashed on the server and never stored." style={{ marginBottom: 16 }}>
        <form onSubmit={(e) => void add(e)}>
          <Row gap={8}>
            <input type="email" required aria-label="Email address" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} style={{ ...control, minWidth: 240 }} />
            <select aria-label="Scope" value={scope} onChange={(e) => setScope(e.target.value)} style={control}>
              <option value="all">Everything</option>
              <option value="nonessential">All but transactional</option>
              <option value="marketing">Marketing only</option>
            </select>
            <input aria-label="Note" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} style={{ ...control, minWidth: 200 }} />
            <button type="submit" disabled={busy || !email} style={disabledStyle(primaryBtn, busy || !email)}>
              Suppress
            </button>
          </Row>
        </form>
      </Panel>
      <Panel flush>
        {error ? (
          <Empty title="Couldn't load suppressions" description={error} />
        ) : !data ? (
          <Empty title="Loading…" />
        ) : data.items.length === 0 ? (
          <Empty title="No suppressions" description="Hard bounces, complaints and manual blocks land here." />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyles.table}>
              <thead>
                <tr>
                  {["Address", "Scope", "Reason", "Source", "Added", ""].map((h) => (
                    <th key={h || "actions"} scope="col" style={tableStyles.th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.items.map((s) => (
                  <tr key={s.id} style={tableStyles.tr}>
                    <td style={tableStyles.td}>
                      {s.contact ? (
                        <Link href={`/admin/contacts/${s.contact.id}`} style={{ color: THEME.text, textDecoration: "none", fontWeight: 600 }}>
                          {s.contact.email}
                        </Link>
                      ) : (
                        <span style={{ fontFamily: THEME.fontMono, fontSize: 12, color: THEME.textMuted }} title="No contact has this address any more">
                          #{s.hashPrefix}…
                        </span>
                      )}
                      {s.note ? <div style={{ fontSize: 11, color: THEME.textMuted }}>{s.note}</div> : null}
                    </td>
                    <td style={tableStyles.td}>
                      <Pill color={s.scope === "all" ? THEME.ai : s.scope === "nonessential" ? THEME.warn : THEME.textMuted}>{s.scope}</Pill>
                    </td>
                    <td style={tableStyles.td}>{s.reason}</td>
                    <td style={{ ...tableStyles.td, fontSize: 12 }}>{s.source ?? "—"}</td>
                    <td style={{ ...tableStyles.td, fontSize: 12 }} title={fmtDateTime(s.createdAt)}>
                      {fmtRelative(s.createdAt)}
                    </td>
                    <td style={{ ...tableStyles.td, textAlign: "right" }}>
                      <button type="button" onClick={() => setRemoving(s)} style={dangerBtn} aria-label="Lift suppression">
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <ConfirmDialog
        open={!!removing}
        title="Lift this suppression?"
        body={
          removing?.reason === "bounce" || removing?.reason === "complaint"
            ? `This address ${removing.reason === "bounce" ? "hard-bounced" : "reported a spam complaint"}. Emailing it again can hurt deliverability for everyone.`
            : "Email to this address will be allowed again (consent rules still apply)."
        }
        confirmLabel="Lift suppression"
        danger
        onConfirm={remove}
        onClose={() => setRemoving(null)}
      />
    </>
  );
}

function DeliverabilityTab() {
  const { data, error } = useApi<{ streams: StreamHealth[]; breaker: { tripped: boolean; sent: number; bounceRate: number; complaintRate: number } }>(
    "/api/admin/email/deliverability"
  );
  const rate = (r: number, level: "ok" | "warn" | "bad", digits: number) => (
    <span className="tnum" style={{ color: LEVEL_COLORS[level], fontWeight: level === "ok" ? 400 : 700 }}>
      {(r * 100).toFixed(digits)}%
    </span>
  );
  return (
    <Panel
      title="Last 30 days"
      description="Amber at 2% bounces or 0.1% complaints, red at 4% or 0.3%. Over the red line on 20+ marketing sends in 7 days, the circuit breaker pauses marketing sequences."
      flush
    >
      {error ? (
        <Empty title="Couldn't load deliverability" description={error} />
      ) : !data ? (
        <Empty title="Loading…" />
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={tableStyles.table}>
            <thead>
              <tr>
                {["Stream", "Sent", "Delivered", "Bounces", "Complaints"].map((h) => (
                  <th key={h} scope="col" style={tableStyles.th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.streams.map((s) => (
                <tr key={s.stream} style={tableStyles.tr}>
                  <td style={{ ...tableStyles.td, fontWeight: 600, color: THEME.text }}>{s.stream}</td>
                  <td className="tnum" style={tableStyles.td}>{s.sent}</td>
                  <td className="tnum" style={tableStyles.td}>{s.sent ? `${(s.deliveredRate * 100).toFixed(1)}%` : "—"}</td>
                  <td style={tableStyles.td}>{s.sent ? <>{rate(s.bounceRate, s.bounceLevel, 1)} ({s.bounced})</> : "—"}</td>
                  <td style={tableStyles.td}>{s.sent ? <>{rate(s.complaintRate, s.complaintLevel, 2)} ({s.complained})</> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ fontSize: 12, color: THEME.textMuted, margin: 0, padding: "10px 14px" }}>
            Delivered counts arrive through the Resend webhook; without it configured they stay at 0%. Opens and clicks are not tracked.
            Circuit breaker: {data.breaker.tripped ? "tripped" : "closed"} ({data.breaker.sent} marketing sends in 7 days).
          </p>
        </div>
      )}
    </Panel>
  );
}

function PendingConfirmations() {
  const { data, reload } = useApi<{ count: number }>("/api/admin/email/pending-confirmations");
  const [open, setOpen] = useState(false);
  const count = data?.count ?? 0;
  const send = async () => {
    const res = await api<{ sent: number; contacts: number; skipped: number; deferred: number; duplicate: number }>("/api/admin/email/pending-confirmations", { method: "POST" });
    if (!res.ok) return void toast.error(res.message);
    const d = res.data;
    toast.success(`Sent ${d.sent} of ${d.contacts}. ${d.duplicate} already got one today; ${d.skipped + d.deferred} held back.`);
    setOpen(false);
    reload();
  };
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} disabled={count === 0} style={disabledStyle(ghostBtn, count === 0)}>
        <MailQuestion size={14} aria-hidden="true" /> Send confirmation to {count} pending
      </button>
      <ConfirmDialog
        open={open}
        title={`Resend the confirmation to ${count} contacts?`}
        body="They asked for emails but never clicked the confirmation link. Each gets one neutral reminder (at most once a day); nothing else is sent until they confirm."
        confirmLabel="Send reminders"
        onConfirm={send}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

export default function EmailLogPage() {
  const [tab, setTab] = useState("messages");
  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 28px", fontFamily: THEME.fontSans }}>
      <PageHeader title="Email log" description="What was sent, skipped or held back, and why." actions={<PendingConfirmations />} />
      <EmailStatusBanner />
      <div style={{ marginBottom: 16 }}>
        <Tabs
          tabs={[
            { id: "messages", label: "Messages" },
            { id: "suppressions", label: "Suppressions" },
            { id: "deliverability", label: "Deliverability" },
          ]}
          value={tab}
          onChange={setTab}
          idPrefix={TAB_PREFIX}
          label="Email log sections"
        />
      </div>
      <div role="tabpanel" id={tabPanelId(TAB_PREFIX, tab)} aria-labelledby={tabId(TAB_PREFIX, tab)}>
        {tab === "messages" ? <MessagesTab /> : tab === "suppressions" ? <SuppressionsTab /> : <DeliverabilityTab />}
      </div>
    </div>
  );
}
