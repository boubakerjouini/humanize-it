"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft, ShieldCheck, Trash2, RotateCcw, Gift, FileText, Building2, Ticket,
  StickyNote, Tag as TagIcon, Clock, Plus, X, Crown, Sparkles, Zap, Mail,
} from "lucide-react";
import { THEME, glow, humanScore, humanScoreColor } from "@/lib/theme";

interface Detail {
  user: {
    id: string; clerkId: string; email: string; name: string | null; imageUrl: string | null;
    plan: "FREE" | "PRO" | "TEAM"; role: "USER" | "ADMIN"; planExpiresAt: string | null;
    wordsUsed: number; rewriteCount: number; quotaResetAt: string; createdAt: string; documentCount: number; paid: boolean;
  };
  subscription: { status: string; lsCurrentPeriodEnd: string | null } | null;
  documents: { id: string; title: string | null; overallScore: number; humanizedScore: number | null; wordCount: number; status: string; createdAt: string }[];
  redemptions: { id: string; code: string; plan: string; redeemedAt: string }[];
  memberships: { id: string; org: { id: string; name: string; slug: string }; role: string; seatActive: boolean }[];
  notes: { id: string; authorEmail: string; body: string; createdAt: string }[];
  tags: { id: string; name: string; color: string }[];
  audit: { id: string; actorEmail: string; action: string; summary: string | null; createdAt: string }[];
}

const PLAN_ICON = { TEAM: Crown, PRO: Sparkles, FREE: Zap } as const;
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—");
const fmtAgo = (iso: string) => { const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000), h = Math.floor(m / 60), d = Math.floor(h / 24); return d > 0 ? `${d}d ago` : h > 0 ? `${h}h ago` : m > 0 ? `${m}m ago` : "just now"; };

export default function CustomerPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [d, setD] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [tag, setTag] = useState("");
  const [grantDays, setGrantDays] = useState("30");
  const [confirmDel, setConfirmDel] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${id}`);
      if (!res.ok) { toast.error("Failed to load customer."); return; }
      setD(await res.json());
    } catch { toast.error("Network error."); } finally { setLoading(false); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  async function action(payload: Record<string, unknown>, ok = "Done") {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error?.message ?? "Action failed."); return; }
      toast.success(ok); await load();
    } catch { toast.error("Network error."); } finally { setBusy(false); }
  }
  async function addNote() {
    if (!note.trim()) return;
    setBusy(true);
    try { const res = await fetch(`/api/admin/users/${id}/notes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: note }) }); if (res.ok) { setNote(""); toast.success("Note added"); await load(); } else toast.error("Failed"); } finally { setBusy(false); }
  }
  async function delNote(noteId: string) { await fetch(`/api/admin/users/${id}/notes`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ noteId }) }); await load(); }
  async function addTag() { if (!tag.trim()) return; await fetch(`/api/admin/users/${id}/tags`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: tag.trim() }) }); setTag(""); await load(); }
  async function removeTag(tagId: string) { await fetch(`/api/admin/users/${id}/tags`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tagId }) }); await load(); }
  async function del() {
    setBusy(true);
    try { const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" }); const data = await res.json(); if (!res.ok) { toast.error(data.error?.message ?? "Failed."); return; } toast.success("Customer deleted"); router.push("/admin/users"); } finally { setBusy(false); }
  }

  if (loading) return <div style={{ padding: 60, textAlign: "center", color: THEME.textMuted, fontFamily: THEME.fontSans }}>Loading…</div>;
  if (!d) return <div style={{ padding: 60, textAlign: "center", color: THEME.textMuted, fontFamily: THEME.fontSans }}>Customer not found.</div>;
  const u = d.user;
  const PlanIcon = PLAN_ICON[u.plan];
  const status = u.paid ? { c: THEME.human, l: "Paid" } : u.plan !== "FREE" ? { c: THEME.accentHi, l: "Comped" } : { c: THEME.textMuted, l: "Free" };

  return (
    <div style={{ maxWidth: 1040, margin: "0 auto", padding: "28px 28px 64px", fontFamily: THEME.fontSans }}>
      <Link href="/admin/users" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: THEME.textDim, textDecoration: "none", marginBottom: 18, fontWeight: 600 }}><ArrowLeft size={14} aria-hidden="true" /> All customers</Link>

      {/* Identity header */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 22, flexWrap: "wrap" }}>
        {u.imageUrl ? <img src={u.imageUrl} alt="" width={56} height={56} style={{ borderRadius: 999, objectFit: "cover" }} />
          : <div style={{ width: 56, height: 56, borderRadius: 999, background: THEME.brandDim, color: THEME.brandHi, display: "grid", placeItems: "center", fontSize: 22, fontWeight: 700 }}>{(u.name?.[0] ?? u.email[0] ?? "?").toUpperCase()}</div>}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: THEME.text, fontFamily: THEME.fontHeading, letterSpacing: "-0.02em", margin: 0 }}>{u.name || u.email.split("@")[0]}</h1>
            {u.role === "ADMIN" && <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: THEME.brandHi, background: THEME.brandDim, borderRadius: 999, padding: "3px 9px" }}><ShieldCheck size={11} aria-hidden="true" /> Admin</span>}
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, color: status.c, background: THEME.surface3, borderRadius: 999, padding: "3px 9px" }}><span style={{ width: 6, height: 6, borderRadius: 999, background: status.c }} />{status.l}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, color: THEME.textDim, marginTop: 3 }}><Mail size={13} aria-hidden="true" /> {u.email}</div>
        </div>
      </div>

      {/* Action bar */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 22, padding: 14, background: THEME.surface2, border: `1px solid ${THEME.border}`, borderRadius: THEME.radiusLg, alignItems: "center" }}>
        <Field label="Plan">
          <select value={u.plan} disabled={busy} onChange={(e) => action({ action: "setPlan", plan: e.target.value }, "Plan updated")} style={sel}>
            <option>FREE</option><option>PRO</option><option>TEAM</option>
          </select>
        </Field>
        <Field label="Grant">
          <select id="grantPlan" disabled={busy} defaultValue="PRO" style={sel}><option>PRO</option><option>TEAM</option></select>
          <input value={grantDays} onChange={(e) => setGrantDays(e.target.value)} style={{ ...sel, width: 56 }} aria-label="Grant days" />
          <button disabled={busy} onClick={() => action({ action: "grant", plan: (document.getElementById("grantPlan") as HTMLSelectElement)?.value ?? "PRO", days: parseInt(grantDays, 10) || null }, "Granted")} style={btn}><Gift size={13} aria-hidden="true" /> Grant</button>
        </Field>
        <button disabled={busy} onClick={() => action({ action: "resetQuota" }, "Quota reset")} style={ghost}><RotateCcw size={13} aria-hidden="true" /> Reset quota</button>
        <button disabled={busy} onClick={() => action({ action: "setRole", role: u.role === "ADMIN" ? "USER" : "ADMIN" }, "Role updated")} style={ghost}><ShieldCheck size={13} aria-hidden="true" /> {u.role === "ADMIN" ? "Revoke admin" : "Make admin"}</button>
        <div style={{ flex: 1 }} />
        {confirmDel ? (
          <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: THEME.ai }}>Delete permanently?</span>
            <button disabled={busy} onClick={del} style={{ ...ghost, color: "#fff", background: THEME.ai, border: "none" }}>Yes, delete</button>
            <button onClick={() => setConfirmDel(false)} style={ghost}>Cancel</button>
          </span>
        ) : (
          <button onClick={() => setConfirmDel(true)} style={{ ...ghost, color: THEME.ai, borderColor: `${THEME.ai}44` }}><Trash2 size={13} aria-hidden="true" /> Delete</button>
        )}
      </div>

      {/* Tags */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 22 }}>
        <TagIcon size={14} color={THEME.textMuted} aria-hidden="true" />
        {d.tags.map((t) => (
          <span key={t.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "#fff", background: t.color, borderRadius: 999, padding: "4px 10px" }}>
            {t.name}<button onClick={() => removeTag(t.id)} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", display: "inline-flex", opacity: 0.85 }} aria-label={`Remove ${t.name}`}><X size={11} /></button>
          </span>
        ))}
        <span style={{ display: "inline-flex", gap: 4 }}>
          <input value={tag} onChange={(e) => setTag(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTag()} placeholder="add tag…" aria-label="Add tag" style={{ ...sel, width: 110 }} />
          <button onClick={addTag} style={{ ...ghost, padding: "6px 9px" }}><Plus size={13} aria-hidden="true" /></button>
        </span>
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 22 }}>
        <Card icon={PlanIcon} label="Plan">
          <Big>{u.plan}</Big>
          <Sub>{u.planExpiresAt ? `expires ${fmt(u.planExpiresAt)}` : u.plan === "FREE" ? "—" : "no expiry"}</Sub>
        </Card>
        <Card icon={Sparkles} label="Usage">
          <Big>{u.wordsUsed.toLocaleString()}</Big>
          <Sub>words · {u.rewriteCount} rewrites · resets {fmt(u.quotaResetAt)}</Sub>
        </Card>
        <Card icon={FileText} label="Documents"><Big>{u.documentCount.toLocaleString()}</Big><Sub>joined {fmt(u.createdAt)}</Sub></Card>
        <Card icon={Ticket} label="Billing">
          <Big>{d.subscription ? d.subscription.status : u.plan !== "FREE" ? "comped" : "free"}</Big>
          <Sub>{d.subscription?.lsCurrentPeriodEnd ? `renews ${fmt(d.subscription.lsCurrentPeriodEnd)}` : `${d.redemptions.length} redemptions`}</Sub>
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16 }} className="grid-cols-1 md:grid-cols-[1.3fr_1fr]">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Documents */}
          <Panel title="Recent documents" icon={FileText}>
            {d.documents.length === 0 ? <Empty>No documents.</Empty> : d.documents.map((doc) => (
              <Row key={doc.id}>
                <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: THEME.text }}>{doc.title || "Untitled"}</span>
                <ScoreDot score={doc.overallScore} /> {doc.humanizedScore !== null && <>→ <ScoreDot score={doc.humanizedScore} /></>}
                <span style={{ fontSize: 11, color: THEME.textMuted, whiteSpace: "nowrap" }}>{fmtAgo(doc.createdAt)}</span>
              </Row>
            ))}
          </Panel>

          {/* Notes */}
          <Panel title="Notes" icon={StickyNote}>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <input value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addNote()} placeholder="Add a note…" aria-label="Add note" style={{ flex: 1, ...sel }} />
              <button onClick={addNote} disabled={busy} style={btn}><Plus size={13} aria-hidden="true" /> Add</button>
            </div>
            {d.notes.length === 0 ? <Empty>No notes yet.</Empty> : d.notes.map((n) => (
              <div key={n.id} style={{ padding: "10px 0", borderTop: `1px solid ${THEME.border}` }}>
                <div style={{ fontSize: 13, color: THEME.text, lineHeight: 1.5 }}>{n.body}</div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                  <span style={{ fontSize: 11, color: THEME.textMuted }}>{n.authorEmail} · {fmtAgo(n.createdAt)}</span>
                  <button onClick={() => delNote(n.id)} style={{ background: "none", border: "none", color: THEME.textMuted, cursor: "pointer", fontSize: 11 }}>delete</button>
                </div>
              </div>
            ))}
          </Panel>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Memberships + redemptions */}
          <Panel title="Organizations" icon={Building2}>
            {d.memberships.length === 0 ? <Empty>None.</Empty> : d.memberships.map((m) => (
              <Row key={m.id}><Link href={`/admin/organizations`} style={{ color: THEME.brandHi, textDecoration: "none", flex: 1 }}>{m.org.name}</Link><span style={{ fontSize: 11, color: THEME.textMuted }}>{m.role}{m.seatActive ? "" : " · inactive"}</span></Row>
            ))}
          </Panel>
          <Panel title="Redemptions" icon={Ticket}>
            {d.redemptions.length === 0 ? <Empty>None.</Empty> : d.redemptions.map((r) => (
              <Row key={r.id}><span style={{ fontFamily: THEME.fontMono, flex: 1 }}>{r.code}</span><span style={{ fontSize: 11, color: THEME.textMuted }}>{r.plan} · {fmtAgo(r.redeemedAt)}</span></Row>
            ))}
          </Panel>

          {/* Audit timeline */}
          <Panel title="Activity" icon={Clock}>
            {d.audit.length === 0 ? <Empty>No recorded actions.</Empty> : d.audit.map((a) => (
              <div key={a.id} style={{ padding: "8px 0", borderTop: `1px solid ${THEME.border}` }}>
                <div style={{ fontSize: 13, color: THEME.text }}>{a.summary || a.action}</div>
                <div style={{ fontSize: 11, color: THEME.textMuted }}>{a.actorEmail} · {fmtAgo(a.createdAt)}</div>
              </div>
            ))}
          </Panel>
        </div>
      </div>
    </div>
  );
}

const sel: React.CSSProperties = { padding: "7px 9px", borderRadius: 8, border: `1px solid ${THEME.border}`, background: THEME.surface1, color: THEME.text, fontSize: 13, outline: "none", fontFamily: THEME.fontSans };
const btn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 5, background: THEME.brand, color: "#fff", border: "none", borderRadius: 8, padding: "7px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: THEME.fontSans };
const ghost: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 5, background: THEME.surface2, color: THEME.text, border: `1px solid ${THEME.border}`, borderRadius: 8, padding: "7px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: THEME.fontSans };

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
function ScoreDot({ score }: { score: number }) { const h = humanScore(score); const c = humanScoreColor(h); return <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 700, color: c }}><span style={{ width: 6, height: 6, borderRadius: 999, background: c }} />{h}</span>; }
