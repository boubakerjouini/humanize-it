"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, ScrollText, User as UserIcon, Building2, Ticket, Tag as TagIcon, Filter } from "lucide-react";
import { toast } from "sonner";
import { THEME } from "@/lib/theme";

interface AuditLog {
  id: string;
  actorEmail: string;
  action: string;
  targetType: string;
  targetId: string | null;
  summary: string | null;
  createdAt: string;
}

const TARGET_META: Record<string, { icon: typeof UserIcon; bg: string; fg: string }> = {
  user: { icon: UserIcon, bg: THEME.brandDim, fg: THEME.brandHi },
  org: { icon: Building2, bg: THEME.accentDim, fg: THEME.accentHi },
  code: { icon: Ticket, bg: THEME.humanDim, fg: THEME.human },
  tag: { icon: TagIcon, bg: THEME.warnDim, fg: THEME.warn },
};

const fmtAgo = (iso: string) => {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000), h = Math.floor(m / 60), d = Math.floor(h / 24);
  return d > 0 ? `${d}d ago` : h > 0 ? `${h}h ago` : m > 0 ? `${m}m ago` : "just now";
};

function TargetBadge({ type }: { type: string }) {
  const meta = TARGET_META[type] ?? { icon: ScrollText, bg: THEME.surface3, fg: THEME.textMuted };
  const Icon = meta.icon;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, color: meta.fg, background: meta.bg, borderRadius: 999, padding: "3px 9px", textTransform: "capitalize" }}>
      <Icon size={11} aria-hidden="true" /> {type}
    </span>
  );
}

export default function AdminAuditPage() {
  const [action, setAction] = useState("");
  const [targetType, setTargetType] = useState("");
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const load = useCallback(async (act: string, tt: string, p: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p) });
      if (act) params.set("action", act);
      if (tt) params.set("targetType", tt);
      const res = await fetch(`/api/admin/audit?${params.toString()}`);
      const data = await res.json() as { logs?: AuditLog[]; total?: number; totalPages?: number; error?: { message: string } };
      if (!res.ok) { toast.error(data.error?.message ?? "Failed to load audit log."); return; }
      setLogs(data.logs ?? []);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 1);
    } catch { toast.error("Network error."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load("", "", 1); }, [load]);

  const onSearch = (e: React.FormEvent) => { e.preventDefault(); setPage(1); void load(action, targetType, 1); };
  const onTargetChange = (value: string) => { setTargetType(value); setPage(1); void load(action, value, 1); };

  const selectStyle: React.CSSProperties = {
    padding: "9px 12px", borderRadius: 9, border: `1px solid ${THEME.border}`,
    background: THEME.surface2, color: THEME.text, fontSize: 13, cursor: "pointer", outline: "none",
  };

  return (
    <div style={{ maxWidth: 1040, margin: "0 auto", padding: "32px 28px", fontFamily: THEME.fontSans }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: THEME.text, fontFamily: THEME.fontHeading, letterSpacing: "-0.02em" }}>Audit log</h1>
          <p style={{ fontSize: 14, color: THEME.textDim, marginTop: 4 }}>A reverse-chronological record of every admin action.</p>
        </div>
        <form onSubmit={onSearch} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <div style={{ position: "relative" }}>
            <Filter size={14} color={THEME.textMuted} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} aria-hidden="true" />
            <input value={action} onChange={e => setAction(e.target.value)} placeholder="Filter action…" style={{
              padding: "9px 12px 9px 32px", borderRadius: 9, border: `1px solid ${THEME.border}`,
              background: THEME.surface2, color: THEME.text, fontSize: 13, outline: "none", width: 200,
            }} />
          </div>
          <select value={targetType} onChange={e => onTargetChange(e.target.value)} style={selectStyle} aria-label="Target type">
            <option value="">All targets</option>
            <option value="user">User</option>
            <option value="org">Org</option>
            <option value="code">Code</option>
            <option value="tag">Tag</option>
          </select>
          <button type="submit" style={{ padding: "9px 16px", borderRadius: 9, border: "none", background: THEME.brand, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Filter</button>
        </form>
      </div>

      <div style={{ background: THEME.surface2, border: `1px solid ${THEME.border}`, borderRadius: THEME.radiusLg, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: "center", color: THEME.textDim }}>
            <Loader2 size={20} aria-hidden="true" style={{ animation: "spin 0.8s linear infinite" }} /> Loading…
          </div>
        ) : logs.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center", color: THEME.textDim, fontSize: 14 }}>No audit entries found.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${THEME.border}`, background: THEME.surface1 }}>
                  {["When", "Actor", "Action", "Target", "Details"].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "10px 14px", fontSize: 11, fontWeight: 600, color: THEME.textMuted, textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id} style={{ borderBottom: `1px solid ${THEME.border}` }}>
                    <td style={{ padding: "12px 14px", color: THEME.textMuted, whiteSpace: "nowrap" }} title={new Date(log.createdAt).toLocaleString()}>{fmtAgo(log.createdAt)}</td>
                    <td style={{ padding: "12px 14px", color: THEME.textDim, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 220 }}>{log.actorEmail}</td>
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{ fontFamily: THEME.fontMono, fontSize: 12, fontWeight: 600, color: THEME.text, background: THEME.surface3, borderRadius: 6, padding: "2px 7px" }}>{log.action}</span>
                    </td>
                    <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                        <TargetBadge type={log.targetType} />
                        {log.targetType === "user" && log.targetId && (
                          <Link href={`/admin/users/${log.targetId}`} style={{ fontSize: 12, color: THEME.brandHi, textDecoration: "none", fontWeight: 600 }}>view →</Link>
                        )}
                      </span>
                    </td>
                    <td style={{ padding: "12px 14px", color: THEME.textDim, maxWidth: 320 }}>
                      <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{log.summary || "—"}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 16 }}>
          <button disabled={page <= 1} onClick={() => { const p = page - 1; setPage(p); void load(action, targetType, p); }} style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${THEME.border}`, background: THEME.surface2, color: THEME.textDim, fontSize: 13, cursor: page <= 1 ? "not-allowed" : "pointer", opacity: page <= 1 ? 0.5 : 1 }}>Previous</button>
          <span style={{ padding: "7px 14px", fontSize: 13, color: THEME.textDim }}>{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => { const p = page + 1; setPage(p); void load(action, targetType, p); }} style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${THEME.border}`, background: THEME.surface2, color: THEME.textDim, fontSize: 13, cursor: page >= totalPages ? "not-allowed" : "pointer", opacity: page >= totalPages ? 0.5 : 1 }}>Next</button>
        </div>
      )}

      {!loading && total > 0 && (
        <p style={{ textAlign: "center", fontSize: 12, color: THEME.textMuted, marginTop: 12 }}>{total.toLocaleString()} {total === 1 ? "entry" : "entries"}</p>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
