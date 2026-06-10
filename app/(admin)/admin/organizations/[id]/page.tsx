"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft, Building2, Users, DollarSign, Crown, Activity, Mail, Ticket, ShieldCheck,
} from "lucide-react";
import { THEME } from "@/lib/theme";

interface OrgDetail {
  org: {
    id: string;
    name: string;
    slug: string;
    plan: "FREE" | "PRO" | "TEAM";
    seatsTotal: number;
    wordsUsed: number;
    status: string;
    billingEmail: string | null;
    lsSubscriptionId: string | null;
    currentPeriodEnd: string | null;
    createdAt: string;
    invitationCount: number;
  };
  owner: { id: string; email: string; name: string | null };
  members: { membershipId: string; user: { id: string; email: string; name: string | null }; role: string; seatActive: boolean }[];
  invitations: { id: string; email: string; role: string; status: string; expiresAt: string; createdAt: string }[];
  seatsUsed: number;
  mrr: number;
  paid: boolean;
}

const STATUSES = ["active", "past_due", "cancelled", "paused"] as const;
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—");

export default function OrganizationPage() {
  const { id } = useParams<{ id: string }>();
  const [d, setD] = useState<OrgDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [seats, setSeats] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/organizations/${id}`);
      if (!res.ok) { toast.error("Failed to load organization."); return; }
      const data = (await res.json()) as OrgDetail;
      setD(data);
      setSeats(String(data.org.seatsTotal));
    } catch { toast.error("Network error."); } finally { setLoading(false); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  const action = useCallback(async (payload: Record<string, unknown>, ok = "Done") => {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/organizations/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error?.message ?? "Action failed."); return; }
      toast.success(ok); await load();
    } catch { toast.error("Network error."); } finally { setBusy(false); }
  }, [id, load]);

  if (loading) return <div style={{ padding: 60, textAlign: "center", color: THEME.textMuted, fontFamily: THEME.fontSans }}>Loading…</div>;
  if (!d) return <div style={{ padding: 60, textAlign: "center", color: THEME.textMuted, fontFamily: THEME.fontSans }}>Organization not found.</div>;
  const o = d.org;
  const status = o.status === "active" ? { c: THEME.human, bg: THEME.humanDim } : { c: THEME.warn, bg: THEME.warnDim };

  return (
    <div style={{ maxWidth: 1040, margin: "0 auto", padding: "28px 28px 64px", fontFamily: THEME.fontSans }}>
      <Link href="/admin/organizations" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: THEME.textDim, textDecoration: "none", marginBottom: 18, fontWeight: 600 }}><ArrowLeft size={14} aria-hidden="true" /> All organizations</Link>

      {/* Identity header */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 22, flexWrap: "wrap" }}>
        <div style={{ width: 56, height: 56, borderRadius: THEME.radiusLg, background: THEME.brandDim, color: THEME.brandHi, display: "grid", placeItems: "center", flexShrink: 0 }}>
          <Building2 size={26} aria-hidden="true" />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: THEME.text, fontFamily: THEME.fontHeading, letterSpacing: "-0.02em", margin: 0 }}>{o.name}</h1>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, color: d.paid ? THEME.human : THEME.textMuted, background: d.paid ? THEME.humanDim : THEME.surface3, borderRadius: 999, padding: "3px 9px" }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: d.paid ? THEME.human : THEME.textMuted }} />{d.paid ? "Paid" : "Unpaid"}
            </span>
          </div>
          <div style={{ fontSize: 14, color: THEME.textDim, marginTop: 3 }}>/{o.slug}</div>
        </div>
      </div>

      {/* KPI cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 22 }}>
        <Card icon={Crown} label="Plan">
          <Big>{o.plan}</Big>
          <Sub>{d.paid ? "billed per seat" : "no subscription"}</Sub>
        </Card>
        <Card icon={Users} label="Seats used">
          <Big>{d.seatsUsed} / {o.seatsTotal}</Big>
          <Sub>{d.org.invitationCount} pending invitations</Sub>
        </Card>
        <Card icon={DollarSign} label="Est. MRR">
          <Big>${d.mrr.toLocaleString()}</Big>
          <Sub>{d.paid ? `renews ${fmt(o.currentPeriodEnd)}` : "—"}</Sub>
        </Card>
        <Card icon={Activity} label="Status">
          <span style={{ display: "inline-flex", alignItems: "center", fontSize: 18, fontWeight: 700, color: status.c, background: status.bg, borderRadius: 999, padding: "2px 12px", textTransform: "capitalize" }}>{o.status}</span>
          <Sub>joined {fmt(o.createdAt)}</Sub>
        </Card>
      </div>

      {/* Edit controls */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 22, padding: 14, background: THEME.surface2, border: `1px solid ${THEME.border}`, borderRadius: THEME.radiusLg, alignItems: "center" }}>
        <Field label="Seats">
          <input value={seats} onChange={(e) => setSeats(e.target.value)} style={{ ...sel, width: 70 }} aria-label="Seat count" />
          <button disabled={busy} onClick={() => action({ action: "setSeats", seats: parseInt(seats, 10) }, "Seats updated")} style={btn}>Update</button>
        </Field>
        <Field label="Status">
          <select value={o.status} disabled={busy} onChange={(e) => action({ action: "setStatus", status: e.target.value }, "Status updated")} style={sel}>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16 }} className="grid-cols-1 md:grid-cols-[1.3fr_1fr]">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Owner */}
          <Panel title="Owner" icon={Crown}>
            <Row>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Link href={`/admin/users/${d.owner.id}`} style={{ color: THEME.brandHi, textDecoration: "none", fontWeight: 600 }}>{d.owner.name || d.owner.email.split("@")[0]}</Link>
                <div style={{ fontSize: 11, color: THEME.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.owner.email}</div>
              </div>
              {o.billingEmail && <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: THEME.textMuted }}><Mail size={11} aria-hidden="true" /> {o.billingEmail}</span>}
            </Row>
          </Panel>

          {/* Members */}
          <Panel title={`Members (${d.members.length})`} icon={Users}>
            {d.members.length === 0 ? <Empty>No members.</Empty> : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${THEME.border}` }}>
                    {["Member", "Role", "Seat"].map((h) => (
                      <th key={h} style={{ textAlign: "left", padding: "8px 6px", fontSize: 11, fontWeight: 600, color: THEME.textMuted, textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {d.members.map((m) => (
                    <tr key={m.membershipId} style={{ borderBottom: `1px solid ${THEME.border}` }}>
                      <td style={{ padding: "9px 6px", maxWidth: 260 }}>
                        <Link href={`/admin/users/${m.user.id}`} style={{ color: THEME.text, textDecoration: "none", fontWeight: 600, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.user.name || m.user.email.split("@")[0]}</Link>
                        <div style={{ fontSize: 11, color: THEME.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.user.email}</div>
                      </td>
                      <td style={{ padding: "9px 6px", color: THEME.textDim }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>{m.role === "OWNER" && <ShieldCheck size={12} color={THEME.brand} aria-hidden="true" />}{m.role}</span>
                      </td>
                      <td style={{ padding: "9px 6px" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: m.seatActive ? THEME.humanDim : THEME.surface3, color: m.seatActive ? THEME.human : THEME.textMuted }}>{m.seatActive ? "Active" : "Inactive"}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Pending invitations */}
          <Panel title="Pending invitations" icon={Ticket}>
            {d.invitations.filter((i) => i.status === "PENDING").length === 0 ? <Empty>No pending invitations.</Empty> : d.invitations.filter((i) => i.status === "PENDING").map((inv) => (
              <Row key={inv.id}>
                <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: THEME.text }}>{inv.email}</span>
                <span style={{ fontSize: 11, color: THEME.textMuted, whiteSpace: "nowrap" }}>{inv.role} · expires {fmt(inv.expiresAt)}</span>
              </Row>
            ))}
          </Panel>
        </div>
      </div>
    </div>
  );
}

const sel: React.CSSProperties = { padding: "7px 9px", borderRadius: 8, border: `1px solid ${THEME.border}`, background: THEME.surface1, color: THEME.text, fontSize: 13, outline: "none", fontFamily: THEME.fontSans };
const btn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 5, background: THEME.brand, color: "#fff", border: "none", borderRadius: 8, padding: "7px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: THEME.fontSans };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ fontSize: 11, color: THEME.textMuted, fontWeight: 600 }}>{label}</span>{children}</span>;
}
function Card({ icon: Icon, label, children }: { icon: React.ComponentType<{ size?: number; color?: string }>; label: string; children: React.ReactNode }) {
  return <div style={{ background: THEME.surface2, border: `1px solid ${THEME.border}`, borderRadius: THEME.radiusLg, padding: 16 }}><div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}><Icon size={14} color={THEME.brand} /><span style={{ fontSize: 12, color: THEME.textDim, fontWeight: 600 }}>{label}</span></div>{children}</div>;
}
const Big = ({ children }: { children: React.ReactNode }) => <div style={{ fontSize: 22, fontWeight: 700, color: THEME.text, lineHeight: 1, textTransform: "capitalize" }}>{children}</div>;
const Sub = ({ children }: { children: React.ReactNode }) => <div style={{ fontSize: 11, color: THEME.textMuted, marginTop: 6 }}>{children}</div>;
function Panel({ title, icon: Icon, children }: { title: string; icon: React.ComponentType<{ size?: number; color?: string }>; children: React.ReactNode }) {
  return <div style={{ background: THEME.surface2, border: `1px solid ${THEME.border}`, borderRadius: THEME.radiusLg, padding: 18 }}><div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}><Icon size={15} color={THEME.brand} /><h2 style={{ fontSize: 14, fontWeight: 700, color: THEME.text, fontFamily: THEME.fontHeading, margin: 0 }}>{title}</h2></div>{children}</div>;
}
const Row = ({ children }: { children: React.ReactNode }) => <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", fontSize: 13, color: THEME.textDim }}>{children}</div>;
const Empty = ({ children }: { children: React.ReactNode }) => <div style={{ fontSize: 13, color: THEME.textMuted, padding: "6px 0" }}>{children}</div>;
