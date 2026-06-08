"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Building2, Users, Mail, Plus, Loader2, Copy, CheckCircle2, Trash2, Crown, ShieldCheck, X,
} from "lucide-react";
import { toast } from "sonner";
import { THEME, glow } from "@/lib/theme";

interface Member { membershipId: string; userId: string; email: string; name: string | null; role: string; isSelf: boolean; }
interface Invite { id: string; email: string; role: string; token: string; expiresAt: string; }
interface OrgData {
  organization: { id: string; name: string; slug: string; seatsTotal: number; status: string; pooledWordsLimit: number; wordsUsed: number } | null;
  role?: string;
  canManage?: boolean;
  usage?: { seatsTotal: number; used: number; available: number; pendingInvites: number };
  members?: Member[];
  invitations?: Invite[];
}

export default function OrganizationPage() {
  const [data, setData] = useState<OrgData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Create form
  const [name, setName] = useState("");
  const [seats, setSeats] = useState(3);

  // Invite form
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("MEMBER");
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/organizations");
      const d = await res.json() as OrgData;
      setData(d);
    } catch { toast.error("Failed to load organization."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const createOrg = async () => {
    if (name.trim().length < 2) { toast.error("Enter an organization name."); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/organizations", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, seats }),
      });
      const d = await res.json() as { error?: { message: string } };
      if (!res.ok) { toast.error(d.error?.message ?? "Could not create organization."); return; }
      toast.success("Organization created!");
      await load();
    } catch { toast.error("Network error."); }
    finally { setBusy(false); }
  };

  const invite = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/organizations/invitations", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      const d = await res.json() as { error?: { message: string } };
      if (!res.ok) { toast.error(d.error?.message ?? "Could not send invite."); return; }
      toast.success("Invitation created — share the link.");
      setInviteEmail("");
      await load();
    } catch { toast.error("Network error."); }
    finally { setBusy(false); }
  };

  const revoke = async (id: string) => {
    try {
      const res = await fetch(`/api/organizations/invitations?id=${id}`, { method: "DELETE" });
      if (!res.ok) { toast.error("Could not revoke invite."); return; }
      await load();
    } catch { toast.error("Network error."); }
  };

  const removeMember = async (membershipId: string) => {
    try {
      const res = await fetch(`/api/organizations/members?id=${membershipId}`, { method: "DELETE" });
      if (!res.ok) { const d = await res.json() as { error?: { message: string } }; toast.error(d.error?.message ?? "Could not remove member."); return; }
      toast.success("Member removed.");
      await load();
    } catch { toast.error("Network error."); }
  };

  const updateSeats = async (next: number) => {
    setBusy(true);
    try {
      const res = await fetch("/api/organizations", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seatsTotal: next }),
      });
      const d = await res.json() as { error?: { message: string } };
      if (!res.ok) { toast.error(d.error?.message ?? "Could not update seats."); return; }
      await load();
    } catch { toast.error("Network error."); }
    finally { setBusy(false); }
  };

  const copyLink = async (token: string) => {
    const link = `${window.location.origin}/invite/${token}`;
    await navigator.clipboard.writeText(link);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 1600);
  };

  if (loading) {
    return <div style={{ padding: 64, textAlign: "center", color: THEME.textDim }}><Loader2 size={22} style={{ animation: "spin 0.8s linear infinite" }} aria-hidden="true" /></div>;
  }

  // ── Create state ──
  if (!data?.organization) {
    return (
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "48px 24px", fontFamily: THEME.fontSans }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ width: 52, height: 52, borderRadius: 15, background: THEME.gradient, display: "grid", placeItems: "center", margin: "0 auto 16px", boxShadow: glow(THEME.brand, 0.28) }}>
            <Building2 size={24} color="#fff" aria-hidden="true" />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: THEME.text, fontFamily: THEME.fontHeading, letterSpacing: "-0.02em", marginBottom: 6 }}>Start an organization</h1>
          <p style={{ fontSize: 14, color: THEME.textDim, lineHeight: 1.6 }}>
            Buy seats and invite your team. Every seated member gets full Pro/Team features under one workspace.
          </p>
        </div>

        <div style={{ background: THEME.surface2, border: `1px solid ${THEME.border}`, borderRadius: THEME.radiusXl, padding: 28, boxShadow: glow(THEME.brand, 0.12) }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: THEME.textDim, marginBottom: 6 }}>Organization name</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Acme Inc." style={{
            width: "100%", padding: "11px 14px", borderRadius: 10, border: `1px solid ${THEME.border}`,
            background: THEME.surface1, color: THEME.text, fontSize: 14, outline: "none", marginBottom: 18,
          }} />

          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: THEME.textDim, marginBottom: 6 }}>Seats</label>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
            <input type="range" min={2} max={50} value={seats} onChange={e => setSeats(Number(e.target.value))} style={{ flex: 1, accentColor: THEME.brand }} />
            <span className="tnum" style={{ fontSize: 20, fontWeight: 700, color: THEME.text, minWidth: 36, textAlign: "right" }}>{seats}</span>
          </div>
          <div style={{ fontSize: 12, color: THEME.textMuted, marginBottom: 20 }}>
            ${seats * 12}/mo · {(seats * 100000).toLocaleString()} pooled words/month
          </div>

          <button onClick={createOrg} disabled={busy} style={{
            width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7,
            padding: "12px", borderRadius: 12, border: "none", background: THEME.brand, color: "#fff",
            fontSize: 14, fontWeight: 700, cursor: busy ? "not-allowed" : "pointer", boxShadow: glow(THEME.brand, 0.3),
          }}>
            {busy ? <Loader2 size={16} style={{ animation: "spin 0.8s linear infinite" }} aria-hidden="true" /> : <Building2 size={16} aria-hidden="true" />}
            Create organization
          </button>
          <p style={{ fontSize: 11, color: THEME.textMuted, textAlign: "center", marginTop: 10 }}>
            You become the owner and take the first seat.
          </p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── Manage state ──
  const org = data.organization;
  const usage = data.usage!;
  const canManage = data.canManage;
  const seatPct = Math.round((usage.used / Math.max(1, usage.seatsTotal)) * 100);

  return (
    <div style={{ maxWidth: 820, margin: "0 auto", padding: "28px 24px 64px", fontFamily: THEME.fontSans }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: THEME.gradient, display: "grid", placeItems: "center", boxShadow: glow(THEME.brand, 0.24) }}>
          <Building2 size={20} color="#fff" aria-hidden="true" />
        </div>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: THEME.text, fontFamily: THEME.fontHeading, letterSpacing: "-0.02em" }}>{org.name}</h1>
          <p style={{ fontSize: 13, color: THEME.textDim }}>{usage.used} of {usage.seatsTotal} seats used · {data.role}</p>
        </div>
      </div>

      {/* Seat usage */}
      <div style={{ background: THEME.surface2, border: `1px solid ${THEME.border}`, borderRadius: THEME.radiusLg, padding: 20, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: THEME.text, display: "inline-flex", alignItems: "center", gap: 7 }}><Users size={15} color={THEME.brand} aria-hidden="true" /> Seats</span>
          <span className="tnum" style={{ fontSize: 13, color: THEME.textDim }}>{usage.used} / {usage.seatsTotal} · {usage.available} open</span>
        </div>
        <div style={{ height: 8, background: THEME.surface3, borderRadius: 999, overflow: "hidden" }}>
          <div style={{ height: 8, width: `${seatPct}%`, background: seatPct >= 100 ? THEME.warn : THEME.brand, borderRadius: 999, transition: "width 0.4s ease" }} />
        </div>
        {canManage && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 16 }}>
            <span style={{ fontSize: 12, color: THEME.textDim }}>Adjust seats:</span>
            <button onClick={() => updateSeats(org.seatsTotal - 1)} disabled={busy || org.seatsTotal <= usage.used} style={seatBtn}>−</button>
            <span className="tnum" style={{ fontSize: 15, fontWeight: 700, color: THEME.text, minWidth: 24, textAlign: "center" }}>{org.seatsTotal}</span>
            <button onClick={() => updateSeats(org.seatsTotal + 1)} disabled={busy} style={seatBtn}>+</button>
            <span style={{ fontSize: 11, color: THEME.textMuted, marginLeft: 6 }}>${org.seatsTotal * 12}/mo</span>
          </div>
        )}
      </div>

      {/* Invite */}
      {canManage && (
        <div style={{ background: THEME.surface2, border: `1px solid ${THEME.border}`, borderRadius: THEME.radiusLg, padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: THEME.text, marginBottom: 12, display: "inline-flex", alignItems: "center", gap: 7 }}><Mail size={15} color={THEME.brand} aria-hidden="true" /> Invite a member</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="teammate@company.com" type="email" style={{
              flex: "1 1 220px", padding: "10px 14px", borderRadius: 10, border: `1px solid ${THEME.border}`,
              background: THEME.surface1, color: THEME.text, fontSize: 13, outline: "none", minWidth: 0,
            }} />
            <select value={inviteRole} onChange={e => setInviteRole(e.target.value)} style={{
              padding: "10px 12px", borderRadius: 10, border: `1px solid ${THEME.border}`, background: THEME.surface1, color: THEME.text, fontSize: 13, cursor: "pointer",
            }}>
              <option value="MEMBER">Member</option>
              <option value="ADMIN">Admin</option>
            </select>
            <button onClick={invite} disabled={busy || usage.available <= 0} style={{
              display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 18px", borderRadius: 10, border: "none",
              background: usage.available <= 0 ? THEME.surface3 : THEME.brand, color: usage.available <= 0 ? THEME.textMuted : "#fff",
              fontSize: 13, fontWeight: 700, cursor: busy || usage.available <= 0 ? "not-allowed" : "pointer",
            }}>
              <Plus size={14} aria-hidden="true" /> Invite
            </button>
          </div>
          {usage.available <= 0 && <p style={{ fontSize: 11, color: THEME.warn, marginTop: 8 }}>No seats available — add seats above to invite more people.</p>}
        </div>
      )}

      {/* Pending invites */}
      {data.invitations && data.invitations.length > 0 && (
        <div style={{ background: THEME.surface2, border: `1px solid ${THEME.border}`, borderRadius: THEME.radiusLg, padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: THEME.text, marginBottom: 12 }}>Pending invitations</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {data.invitations.map(inv => (
              <div key={inv.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, background: THEME.surface1, border: `1px solid ${THEME.border}` }}>
                <Mail size={14} color={THEME.textMuted} aria-hidden="true" />
                <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: THEME.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{inv.email}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: THEME.textMuted, textTransform: "uppercase" }}>{inv.role}</span>
                <button onClick={() => copyLink(inv.token)} style={miniBtn}>
                  {copiedToken === inv.token ? <CheckCircle2 size={12} color={THEME.human} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />} {copiedToken === inv.token ? "Copied" : "Link"}
                </button>
                {canManage && <button onClick={() => revoke(inv.id)} aria-label="Revoke invite" style={{ ...miniBtn, color: THEME.ai }}><X size={12} aria-hidden="true" /></button>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Members */}
      <div style={{ background: THEME.surface2, border: `1px solid ${THEME.border}`, borderRadius: THEME.radiusLg, padding: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: THEME.text, marginBottom: 12 }}>Members</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {data.members?.map(m => (
            <div key={m.membershipId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, background: THEME.surface1, border: `1px solid ${THEME.border}` }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: THEME.brandDim, display: "grid", placeItems: "center", flexShrink: 0 }}>
                {m.role === "OWNER" ? <Crown size={14} color={THEME.accent} aria-hidden="true" /> : m.role === "ADMIN" ? <ShieldCheck size={14} color={THEME.brand} aria-hidden="true" /> : <Users size={14} color={THEME.textMuted} aria-hidden="true" />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: THEME.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.email} {m.isSelf && <span style={{ fontSize: 11, color: THEME.textMuted }}>(you)</span>}</div>
                {m.name && <div style={{ fontSize: 11, color: THEME.textMuted }}>{m.name}</div>}
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color: THEME.textDim, textTransform: "uppercase", padding: "2px 8px", borderRadius: 999, background: THEME.surface3 }}>{m.role}</span>
              {canManage && m.role !== "OWNER" && !m.isSelf && (
                <button onClick={() => removeMember(m.membershipId)} aria-label="Remove member" style={{ ...miniBtn, color: THEME.ai }}><Trash2 size={12} aria-hidden="true" /></button>
              )}
            </div>
          ))}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const seatBtn: React.CSSProperties = {
  width: 28, height: 28, borderRadius: 8, border: `1px solid ${THEME.border}`, background: THEME.surface1,
  color: THEME.text, fontSize: 16, fontWeight: 700, cursor: "pointer", display: "grid", placeItems: "center",
};
const miniBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 9px", borderRadius: 7,
  border: `1px solid ${THEME.border}`, background: THEME.surface2, color: THEME.textDim, fontSize: 11, fontWeight: 600, cursor: "pointer",
};
