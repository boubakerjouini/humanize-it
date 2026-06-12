"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Search, Loader2, FileText, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { THEME, humanScore, humanScoreColor } from "@/lib/theme";

interface AdminDocument {
  id: string;
  title: string | null;
  wordCount: number;
  overallScore: number;
  humanizedScore: number | null;
  status: string;
  createdAt: string;
  user: { id: string; email: string; name: string | null };
}

function StatusBadge({ status }: { status: string }) {
  const { bg, fg, label } =
    status === "complete"
      ? { bg: THEME.humanDim, fg: THEME.human, label: "Complete" }
      : status === "error"
        ? { bg: THEME.aiDim, fg: THEME.ai, label: "Error" }
        : { bg: THEME.warnDim, fg: THEME.warn, label: "Processing" };
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, color: fg, background: bg, borderRadius: 999, padding: "3px 9px" }}><span style={{ width: 6, height: 6, borderRadius: 999, background: fg }} />{label}</span>;
}

function ScoreDot({ score }: { score: number }) {
  const h = humanScore(score);
  const c = humanScoreColor(h);
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 700, color: c }}><span style={{ width: 6, height: 6, borderRadius: 999, background: c }} />{h}</span>;
}

export default function AdminDocumentsPage() {
  const [q, setQ] = useState("");
  const [documents, setDocuments] = useState<AdminDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const load = useCallback(async (query: string, p: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/documents?q=${encodeURIComponent(query)}&page=${p}`);
      const data = await res.json() as { documents?: AdminDocument[]; totalPages?: number; error?: { message: string } };
      if (!res.ok) { toast.error(data.error?.message ?? "Failed to load documents."); return; }
      setDocuments(data.documents ?? []);
      setTotalPages(data.totalPages ?? 1);
    } catch { toast.error("Network error."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load("", 1); }, [load]);

  const onSearch = (e: React.FormEvent) => { e.preventDefault(); setPage(1); void load(q, 1); };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 28px", fontFamily: THEME.fontSans }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: THEME.text, fontFamily: THEME.fontHeading, letterSpacing: "-0.02em" }}>Documents</h1>
          <p style={{ fontSize: 14, color: THEME.textDim, marginTop: 4 }}>Browse every document, its author, and humanization results.</p>
        </div>
        <form onSubmit={onSearch} style={{ display: "flex", gap: 8 }}>
          <div style={{ position: "relative" }}>
            <Search size={14} color={THEME.textMuted} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} aria-hidden="true" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by title…" style={{
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
            <Loader2 size={20} aria-hidden="true" style={{ animation: "spin 0.8s linear infinite" }} /> Loading…
          </div>
        ) : documents.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center", color: THEME.textDim, fontSize: 14 }}>No documents found.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${THEME.border}`, background: THEME.surface1 }}>
                  {["Document", "User", "Words", "Score", "Status", "Created"].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "10px 14px", fontSize: 11, fontWeight: 600, color: THEME.textMuted, textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {documents.map(doc => (
                  <tr key={doc.id} style={{ borderBottom: `1px solid ${THEME.border}` }}>
                    <td style={{ padding: "12px 14px", maxWidth: 290 }}>
                      <Link href={`/admin/documents/${doc.id}`} style={{ display: "flex", alignItems: "center", gap: 10, color: THEME.text, textDecoration: "none" }}>
                        <FileText size={15} color={THEME.brand} aria-hidden="true" style={{ flexShrink: 0 }} />
                        <span style={{ fontWeight: 600, color: THEME.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 250 }}>{doc.title || "Untitled"}</span>
                      </Link>
                    </td>
                    <td style={{ padding: "12px 14px", maxWidth: 230 }}>
                      <Link href={`/admin/users/${doc.user.id}`} style={{ display: "flex", alignItems: "center", gap: 6, color: THEME.text, textDecoration: "none", minWidth: 0 }}>
                        <UserIcon size={12} color={THEME.textMuted} aria-hidden="true" style={{ flexShrink: 0 }} />
                        <span style={{ minWidth: 0 }}>
                          <span style={{ display: "block", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }}>{doc.user.name || doc.user.email.split("@")[0]}</span>
                          <span style={{ display: "block", fontSize: 11, color: THEME.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }}>{doc.user.email}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="tnum" style={{ padding: "12px 14px", color: THEME.textDim, whiteSpace: "nowrap" }}>{doc.wordCount.toLocaleString()}</td>
                    <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <ScoreDot score={doc.overallScore} />
                        {doc.humanizedScore !== null && <><span style={{ color: THEME.textMuted }}>→</span> <ScoreDot score={doc.humanizedScore} /></>}
                      </span>
                    </td>
                    <td style={{ padding: "12px 14px" }}><StatusBadge status={doc.status} /></td>
                    <td style={{ padding: "12px 14px", color: THEME.textDim, whiteSpace: "nowrap" }}>{new Date(doc.createdAt).toLocaleDateString()}</td>
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
