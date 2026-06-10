"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Search, Trash2, ChevronDown, Copy, FileText, Wand2, Lock, ArrowUpRight, X, FileInput } from "lucide-react";
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

/**
 * Document history as a right slide-in drawer (merged from the former
 * /dashboard/history page). Reuses /api/documents (list), /api/documents/[id]
 * (full text), and DELETE — plus an "Open in editor" action that loads a past
 * document's original text back into the editor.
 */
export function HistoryDrawer({ open, onClose, onOpen }: { open: boolean; onClose: () => void; onOpen: (text: string) => void }) {
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
  const [opening, setOpening] = useState<string | null>(null);

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

  // Load when the drawer opens (and on page change while open).
  useEffect(() => { if (open) void load(page); }, [open, page, load]);
  // Lock body scroll while the drawer is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  async function fetchFull(id: string): Promise<{ originalText: string; rewrittenText: string | null } | null> {
    if (full[id]) return full[id];
    try {
      const res = await fetch(`/api/documents/${id}`);
      if (!res.ok) return null;
      const d = await res.json();
      const rec = { originalText: d.originalText as string, rewrittenText: (d.rewrittenText ?? null) as string | null };
      setFull((f) => ({ ...f, [id]: rec }));
      return rec;
    } catch { return null; }
  }

  async function expand(id: string) {
    if (openId === id) { setOpenId(null); return; }
    setOpenId(id);
    await fetchFull(id);
  }

  async function openInEditor(d: Doc) {
    setOpening(d.id);
    // The list endpoint truncates originalText to 200 chars, so always load full.
    const rec = await fetchFull(d.id);
    setOpening(null);
    onOpen(rec?.originalText ?? d.originalText);
    onClose();
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

  if (!open) return null;

  const filtered = query.trim()
    ? docs.filter((d) => (d.title ?? d.originalText).toLowerCase().includes(query.trim().toLowerCase()))
    : docs;
  const hiddenFree = plan === "FREE" ? Math.max(0, totalAll - docs.length) : 0;

  return (
    <div role="dialog" aria-modal="true" aria-label="Document history" style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", justifyContent: "flex-end" }}>
      <div onClick={onClose} aria-hidden="true" style={{ position: "absolute", inset: 0, background: "rgba(29,23,38,0.34)", backdropFilter: "blur(2px)" }} />
      <aside className="history-drawer" style={{ position: "relative", height: "100%", background: THEME.bg, borderLeft: `1px solid ${THEME.border}`, boxShadow: "-22px 0 56px rgba(0,0,0,0.14)", display: "flex", flexDirection: "column", fontFamily: THEME.fontSans }}>
        {/* Header */}
        <div style={{ padding: "16px 18px", borderBottom: `1px solid ${THEME.border}`, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: THEME.text, fontFamily: THEME.fontHeading, letterSpacing: "-0.01em" }}>History</div>
            <div style={{ fontSize: 12, color: THEME.textMuted }}>{pagination.total.toLocaleString()} document{pagination.total === 1 ? "" : "s"}</div>
          </div>
          <button onClick={onClose} aria-label="Close history" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, background: THEME.surface2, border: `1px solid ${THEME.border}`, borderRadius: 9, color: THEME.textDim, cursor: "pointer" }}>
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: "12px 18px 0" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, width: "100%", background: THEME.surface2, border: `1px solid ${THEME.border}`, borderRadius: 9, padding: "8px 12px" }}>
            <Search size={15} color={THEME.textMuted} aria-hidden="true" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search this page…" aria-label="Search documents"
              style={{ border: "none", outline: "none", background: "transparent", fontSize: 14, color: THEME.text, width: "100%", fontFamily: THEME.fontSans }} />
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 18px 18px" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: 48, color: THEME.textMuted }}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "44px 18px", background: THEME.surface2, border: `1px solid ${THEME.border}`, borderRadius: THEME.radiusLg, color: THEME.textMuted }}>
              <FileText size={24} aria-hidden="true" style={{ marginBottom: 10 }} />
              <div style={{ fontSize: 14 }}>{query ? "No matches on this page." : "No documents yet. Humanize something to see it here."}</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {filtered.map((d) => {
                const isOpen = openId === d.id;
                return (
                  <div key={d.id} style={{ background: THEME.surface2, border: `1px solid ${isOpen ? THEME.brand + "55" : THEME.border}`, borderRadius: THEME.radiusLg, overflow: "hidden" }}>
                    <div style={{ padding: "13px 14px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }} onClick={() => void expand(d.id)}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, color: THEME.text, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {d.title || d.originalText.slice(0, 80) || "Untitled"}
                        </div>
                        <div style={{ display: "flex", gap: 12, marginTop: 6, alignItems: "center", flexWrap: "wrap" }}>
                          <span style={{ fontSize: 12, color: THEME.textMuted }}>{timeAgo(d.createdAt)} · {d.wordCount.toLocaleString()} words</span>
                          <ScoreBadge score={d.overallScore} label="Before" />
                          <ScoreBadge score={d.humanizedScore} label="After" />
                        </div>
                      </div>
                      <ChevronDown size={18} color={THEME.textMuted} style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "transform .2s", flexShrink: 0 }} aria-hidden="true" />
                    </div>
                    {isOpen && (
                      <div style={{ borderTop: `1px solid ${THEME.border}`, padding: 14, display: "grid", gap: 12 }}>
                        <TextBlock label="Original" text={full[d.id]?.originalText ?? d.originalText} />
                        {(full[d.id]?.rewrittenText ?? d.rewrittenText) && <TextBlock label="Humanized" text={(full[d.id]?.rewrittenText ?? d.rewrittenText)!} highlight />}
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button onClick={() => void openInEditor(d)} disabled={opening === d.id}
                            style={{ ...ghost, color: THEME.brandHi, borderColor: `${THEME.brand}44` }}><FileInput size={13} aria-hidden="true" /> {opening === d.id ? "Opening…" : "Open in editor"}</button>
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
            <Link href="/dashboard/settings" onClick={onClose} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 14, background: THEME.brandDim, border: `1px solid ${THEME.brand}33`, borderRadius: THEME.radius, padding: "11px 14px", fontSize: 13, color: THEME.brandHi, fontWeight: 600, textDecoration: "none", boxShadow: glow(THEME.brand, 0.08) }}>
              <Lock size={14} aria-hidden="true" /> {hiddenFree.toLocaleString()} older document{hiddenFree === 1 ? "" : "s"} hidden on Free — upgrade <ArrowUpRight size={14} aria-hidden="true" />
            </Link>
          )}

          {pagination.totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, marginTop: 18 }}>
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} style={pageBtn(page <= 1)}>Prev</button>
              <span style={{ fontSize: 13, color: THEME.textDim }}>Page {pagination.page} of {pagination.totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))} disabled={page >= pagination.totalPages} style={pageBtn(page >= pagination.totalPages)}>Next</button>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function TextBlock({ label, text, highlight }: { label: string; text: string; highlight?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: highlight ? THEME.brandHi : THEME.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 14, lineHeight: 1.65, color: THEME.textDim, background: highlight ? THEME.brandDim : THEME.surface1, border: `1px solid ${THEME.border}`, borderRadius: THEME.radius, padding: 12, maxHeight: 200, overflowY: "auto", whiteSpace: "pre-wrap" }}>{text}</div>
    </div>
  );
}

const ghost: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, background: THEME.surface3, color: THEME.text, border: `1px solid ${THEME.border}`, borderRadius: 8, padding: "7px 13px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: THEME.fontSans };
function pageBtn(disabled: boolean): React.CSSProperties {
  return { background: THEME.surface2, border: `1px solid ${THEME.border}`, color: disabled ? THEME.textMuted : THEME.text, borderRadius: 8, padding: "7px 16px", fontSize: 13, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer", fontFamily: THEME.fontSans };
}
