"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Search, Trash2, ChevronDown, Copy, FileText, Wand2, Lock, ArrowUpRight } from "lucide-react";
import { THEME, glow, humanScore, humanScoreColor } from "@/lib/theme";

interface Doc {
  id: string;
  title: string | null;
  originalText: string;
  overallScore: number;
  humanizedScore: number | null;
  wordCount: number;
  rewrittenText: string | null;
  tone: string | null;
  createdAt: string;
}
interface DocsResponse {
  documents: Doc[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  plan: string;
  totalAll: number;
  error?: { message: string };
}

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  const h = Math.floor(mins / 60);
  const d = Math.floor(h / 24);
  if (d > 30) return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  if (d > 0) return `${d}d ago`;
  if (h > 0) return `${h}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return "just now";
}

function ScoreBadge({ score, label }: { score: number | null; label: string }) {
  if (score === null) return <span style={{ fontSize: 12, color: THEME.textMuted }}>{label} —</span>;
  const h = humanScore(score);
  const color = humanScoreColor(h);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: THEME.textDim }}>
      {label}
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 700, color }}>
        <span style={{ width: 6, height: 6, borderRadius: 999, background: color }} />{h}
      </span>
    </span>
  );
}

export default function HistoryPage() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [plan, setPlan] = useState("FREE");
  const [totalAll, setTotalAll] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [full, setFull] = useState<Record<string, { originalText: string; rewrittenText: string | null }>>({});
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/documents?page=${p}&limit=10`);
      const data = (await res.json()) as DocsResponse;
      if (!res.ok) { toast.error(data.error?.message ?? "Failed to load history."); return; }
      setDocs(data.documents);
      setPagination({ page: data.pagination.page, totalPages: data.pagination.totalPages, total: data.pagination.total });
      setPlan(data.plan);
      setTotalAll(data.totalAll);
    } catch { toast.error("Failed to load history."); } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(page); }, [page, load]);

  async function expand(id: string) {
    if (openId === id) { setOpenId(null); return; }
    setOpenId(id);
    if (!full[id]) {
      try {
        const res = await fetch(`/api/documents/${id}`);
        if (res.ok) { const d = await res.json(); setFull((f) => ({ ...f, [id]: { originalText: d.originalText, rewrittenText: d.rewrittenText } })); }
      } catch { /* ignore */ }
    }
  }

  async function remove(id: string) {
    setDeleting(id);
    try {
      const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
      if (!res.ok) { toast.error("Failed to delete."); return; }
      setDocs((d) => d.filter((x) => x.id !== id));
      toast.success("Deleted");
    } catch { toast.error("Failed to delete."); } finally { setDeleting(null); }
  }

  const filtered = query.trim()
    ? docs.filter((d) => (d.title ?? d.originalText).toLowerCase().includes(query.trim().toLowerCase()))
    : docs;
  const hiddenFree = plan === "FREE" ? Math.max(0, totalAll - docs.length) : 0;

  return (
    <div style={{ maxWidth: 880, margin: "0 auto", padding: "28px 24px 64px", fontFamily: THEME.fontSans }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: THEME.text, fontFamily: THEME.fontHeading, letterSpacing: "-0.02em", margin: 0 }}>History</h1>
          <p style={{ fontSize: 14, color: THEME.textDim, margin: "4px 0 0" }}>{pagination.total.toLocaleString()} document{pagination.total === 1 ? "" : "s"}.</p>
        </div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: THEME.surface2, border: `1px solid ${THEME.border}`, borderRadius: 9, padding: "8px 12px", minWidth: 220 }}>
          <Search size={15} color={THEME.textMuted} aria-hidden="true" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search this page…" aria-label="Search documents"
            style={{ border: "none", outline: "none", background: "transparent", fontSize: 14, color: THEME.text, width: "100%", fontFamily: THEME.fontSans }} />
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: THEME.textMuted }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "56px 24px", background: THEME.surface2, border: `1px solid ${THEME.border}`, borderRadius: THEME.radiusLg, color: THEME.textMuted }}>
          <FileText size={26} aria-hidden="true" style={{ marginBottom: 10 }} />
          <div style={{ fontSize: 15, marginBottom: 16 }}>{query ? "No matches on this page." : "No documents yet."}</div>
          {!query && <Link href="/dashboard" style={{ display: "inline-flex", alignItems: "center", gap: 7, background: THEME.gradient, color: "#fff", borderRadius: 9, padding: "10px 18px", fontSize: 14, fontWeight: 700, textDecoration: "none" }}><Wand2 size={15} aria-hidden="true" /> Humanize your first text</Link>}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map((d) => {
            const open = openId === d.id;
            return (
              <div key={d.id} style={{ background: THEME.surface2, border: `1px solid ${open ? THEME.brand + "55" : THEME.border}`, borderRadius: THEME.radiusLg, overflow: "hidden" }}>
                <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }} onClick={() => void expand(d.id)}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, color: THEME.text, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {d.title || d.originalText.slice(0, 80) || "Untitled"}
                    </div>
                    <div style={{ display: "flex", gap: 14, marginTop: 6, alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ fontSize: 12, color: THEME.textMuted }}>{timeAgo(d.createdAt)} · {d.wordCount.toLocaleString()} words</span>
                      <ScoreBadge score={d.overallScore} label="Before" />
                      <ScoreBadge score={d.humanizedScore} label="After" />
                    </div>
                  </div>
                  <ChevronDown size={18} color={THEME.textMuted} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .2s", flexShrink: 0 }} aria-hidden="true" />
                </div>
                {open && (
                  <div style={{ borderTop: `1px solid ${THEME.border}`, padding: 16, display: "grid", gap: 14 }}>
                    <TextBlock label="Original" text={full[d.id]?.originalText ?? d.originalText} />
                    {(full[d.id]?.rewrittenText ?? d.rewrittenText) && <TextBlock label="Humanized" text={(full[d.id]?.rewrittenText ?? d.rewrittenText)!} highlight />}
                    <div style={{ display: "flex", gap: 10 }}>
                      <button onClick={() => { navigator.clipboard?.writeText((full[d.id]?.rewrittenText ?? d.rewrittenText) ?? d.originalText); toast.success("Copied"); }}
                        style={ghost}><Copy size={13} aria-hidden="true" /> Copy</button>
                      <button onClick={() => void remove(d.id)} disabled={deleting === d.id}
                        style={{ ...ghost, color: THEME.ai, borderColor: `${THEME.ai}44` }}><Trash2 size={13} aria-hidden="true" /> {deleting === d.id ? "Deleting…" : "Delete"}</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {hiddenFree > 0 && (
        <Link href="/dashboard/settings" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 14, background: THEME.brandDim, border: `1px solid ${THEME.brand}33`, borderRadius: THEME.radius, padding: "12px 16px", fontSize: 13, color: THEME.brandHi, fontWeight: 600, textDecoration: "none", boxShadow: glow(THEME.brand, 0.08) }}>
          <Lock size={14} aria-hidden="true" /> {hiddenFree.toLocaleString()} older document{hiddenFree === 1 ? "" : "s"} hidden on Free — upgrade to keep full history <ArrowUpRight size={14} aria-hidden="true" />
        </Link>
      )}

      {pagination.totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, marginTop: 22 }}>
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} style={pageBtn(page <= 1)}>Prev</button>
          <span style={{ fontSize: 13, color: THEME.textDim }}>Page {pagination.page} of {pagination.totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))} disabled={page >= pagination.totalPages} style={pageBtn(page >= pagination.totalPages)}>Next</button>
        </div>
      )}
    </div>
  );
}

function TextBlock({ label, text, highlight }: { label: string; text: string; highlight?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: highlight ? THEME.brandHi : THEME.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 14, lineHeight: 1.65, color: THEME.textDim, background: highlight ? THEME.brandDim : THEME.surface1, border: `1px solid ${THEME.border}`, borderRadius: THEME.radius, padding: 12, maxHeight: 220, overflowY: "auto", whiteSpace: "pre-wrap" }}>{text}</div>
    </div>
  );
}

const ghost: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, background: THEME.surface3, color: THEME.text, border: `1px solid ${THEME.border}`, borderRadius: 8, padding: "7px 13px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: THEME.fontSans };
function pageBtn(disabled: boolean): React.CSSProperties {
  return { background: THEME.surface2, border: `1px solid ${THEME.border}`, color: disabled ? THEME.textMuted : THEME.text, borderRadius: 8, padding: "7px 16px", fontSize: 13, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer", fontFamily: THEME.fontSans };
}
