"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Search, Loader2, ShieldCheck, FileText, Building2 } from "lucide-react";
import { toast } from "sonner";
import { THEME } from "@/lib/theme";

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  plan: "FREE" | "PRO" | "TEAM";
  role: "USER" | "ADMIN";
  wordsUsed: number;
  rewriteCount: number;
  createdAt: string;
  planExpiresAt: string | null;
  imageUrl?: string | null;
  subscription: { status: string } | null;
  _count: { documents: number; memberships: number };
}

function Avatar({ name, email, imageUrl }: { name: string | null; email: string; imageUrl?: string | null }) {
  if (imageUrl) return <img src={imageUrl} alt="" width={30} height={30} style={{ borderRadius: 999, flexShrink: 0, objectFit: "cover" }} />;
  const ch = (name?.trim()?.[0] ?? email[0] ?? "?").toUpperCase();
  return <div style={{ width: 30, height: 30, borderRadius: 999, flexShrink: 0, background: THEME.brandDim, color: THEME.brandHi, display: "grid", placeItems: "center", fontSize: 13, fontWeight: 700 }}>{ch}</div>;
}

function StatusBadge({ u }: { u: AdminUser }) {
  const paid = u.subscription?.status === "active";
  const comped = !paid && u.plan !== "FREE";
  const { bg, fg, label } = paid
    ? { bg: THEME.humanDim, fg: THEME.human, label: "Paid" }
    : comped
      ? { bg: THEME.accentDim, fg: THEME.accentHi, label: "Comped" }
      : { bg: THEME.surface3, fg: THEME.textMuted, label: "Free" };
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, color: fg, background: bg, borderRadius: 999, padding: "3px 9px" }}><span style={{ width: 6, height: 6, borderRadius: 999, background: fg }} />{label}</span>;
}

export default function AdminUsersPage() {
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async (query: string, p: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users?q=${encodeURIComponent(query)}&page=${p}`);
      const data = await res.json() as { users?: AdminUser[]; totalPages?: number; error?: { message: string } };
      if (!res.ok) { toast.error(data.error?.message ?? "Failed to load users."); return; }
      setUsers(data.users ?? []);
      setTotalPages(data.totalPages ?? 1);
    } catch { toast.error("Network error."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load("", 1); }, [load]);

  const onSearch = (e: React.FormEvent) => { e.preventDefault(); setPage(1); void load(q, 1); };

  const patch = useCallback(async (userId: string, payload: { plan?: string; role?: string }) => {
    setSavingId(userId);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, ...payload }),
      });
      const data = await res.json() as { user?: AdminUser; error?: { message: string } };
      if (!res.ok) { toast.error(data.error?.message ?? "Update failed."); void load(q, page); return; }
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...payload } as AdminUser : u));
      toast.success("Updated");
    } catch { toast.error("Network error."); }
    finally { setSavingId(null); }
  }, [q, page, load]);

  const selectStyle: React.CSSProperties = {
    padding: "5px 8px", borderRadius: 7, border: `1px solid ${THEME.border}`,
    background: THEME.surface1, color: THEME.text, fontSize: 12, cursor: "pointer", outline: "none",
  };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 28px", fontFamily: THEME.fontSans }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: THEME.text, fontFamily: THEME.fontHeading, letterSpacing: "-0.02em" }}>Users</h1>
          <p style={{ fontSize: 14, color: THEME.textDim, marginTop: 4 }}>Search, grant plans, and assign admin access.</p>
        </div>
        <form onSubmit={onSearch} style={{ display: "flex", gap: 8 }}>
          <div style={{ position: "relative" }}>
            <Search size={14} color={THEME.textMuted} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} aria-hidden="true" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search email or name…" style={{
              padding: "9px 12px 9px 32px", borderRadius: 9, border: `1px solid ${THEME.border}`,
              background: THEME.surface2, color: THEME.text, fontSize: 13, outline: "none", width: 240,
            }} />
          </div>
          <button type="submit" style={{ padding: "9px 16px", borderRadius: 9, border: "none", background: THEME.brand, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Search</button>
        </form>
      </div>

      <div style={{ background: THEME.surface2, border: `1px solid ${THEME.border}`, borderRadius: THEME.radiusLg, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: "center", color: THEME.textDim }}>
            <Loader2 size={20} className="spin" aria-hidden="true" style={{ animation: "spin 0.8s linear infinite" }} /> Loading…
          </div>
        ) : users.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center", color: THEME.textDim, fontSize: 14 }}>No users found.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${THEME.border}`, background: THEME.surface1 }}>
                  {["User", "Status", "Plan", "Role", "Usage", "Joined", ""].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "10px 14px", fontSize: 11, fontWeight: 600, color: THEME.textMuted, textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} style={{ borderBottom: `1px solid ${THEME.border}` }}>
                    <td style={{ padding: "12px 14px", maxWidth: 290 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <Avatar name={u.name} email={u.email} imageUrl={u.imageUrl} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 5, fontWeight: 600, color: THEME.text }}>
                            {u.role === "ADMIN" && <ShieldCheck size={12} color={THEME.brand} aria-hidden="true" />}
                            <Link href={`/admin/users/${u.id}`} style={{ color: THEME.text, textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }}>{u.name || u.email.split("@")[0]}</Link>
                          </div>
                          <div style={{ fontSize: 11, color: THEME.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 230 }}>{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "12px 14px" }}><StatusBadge u={u} /></td>
                    <td style={{ padding: "12px 14px" }}>
                      <select value={u.plan} disabled={savingId === u.id} onChange={e => patch(u.id, { plan: e.target.value })} style={selectStyle}>
                        <option value="FREE">FREE</option>
                        <option value="PRO">PRO</option>
                        <option value="TEAM">TEAM</option>
                      </select>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <select value={u.role} disabled={savingId === u.id} onChange={e => patch(u.id, { role: e.target.value })} style={selectStyle}>
                        <option value="USER">User</option>
                        <option value="ADMIN">Admin</option>
                      </select>
                    </td>
                    <td style={{ padding: "12px 14px", color: THEME.textDim }}>
                      <span className="tnum" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                        <FileText size={12} aria-hidden="true" /> {u._count.documents}
                        {u._count.memberships > 0 && <><Building2 size={12} aria-hidden="true" style={{ marginLeft: 6 }} /> {u._count.memberships}</>}
                      </span>
                      <div className="tnum" style={{ fontSize: 11, color: THEME.textMuted }}>{u.wordsUsed.toLocaleString()} words</div>
                    </td>
                    <td style={{ padding: "12px 14px", color: THEME.textDim, whiteSpace: "nowrap" }}>{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td style={{ padding: "12px 14px" }}>{savingId === u.id && <Loader2 size={14} aria-hidden="true" style={{ animation: "spin 0.8s linear infinite" }} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16 }}>
          <button disabled={page <= 1} onClick={() => { const p = page - 1; setPage(p); void load(q, p); }} style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${THEME.border}`, background: THEME.surface2, color: THEME.textDim, fontSize: 13, cursor: page <= 1 ? "not-allowed" : "pointer", opacity: page <= 1 ? 0.5 : 1 }}>Previous</button>
          <span style={{ padding: "7px 14px", fontSize: 13, color: THEME.textDim }}>{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => { const p = page + 1; setPage(p); void load(q, p); }} style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${THEME.border}`, background: THEME.surface2, color: THEME.textDim, fontSize: 13, cursor: page >= totalPages ? "not-allowed" : "pointer", opacity: page >= totalPages ? 0.5 : 1 }}>Next</button>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
