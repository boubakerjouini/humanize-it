"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Plus, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Trash2, RotateCcw, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { THEME, humanScore, humanScoreColor, glow } from "@/lib/theme";

interface Document {
  id: string;
  title: string | null;
  originalText: string;
  overallScore: number;
  humanizedScore: number | null;
  wordCount: number;
  rewrittenText: string | null;
  tone: string | null;
  createdAt: string;
  status?: string;
}

interface DocumentsResponse {
  documents: Document[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  plan: string;
  totalAll: number;
  error?: { message: string };
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (days > 30) return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return "just now";
}

export default function HistoryPage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<string>("FREE");
  const [totalAll, setTotalAll] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedDoc, setExpandedDoc] = useState<{ originalText: string; rewrittenText: string | null } | null>(null);
  const [expandLoading, setExpandLoading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchDocuments = useCallback(async (page: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/documents?page=${page}&limit=10`);
      const data = await res.json() as DocumentsResponse;
      if (res.ok) {
        setDocuments(data.documents);
        setPagination({ page: data.pagination.page, totalPages: data.pagination.totalPages, total: data.pagination.total });
        setPlan(data.plan ?? "FREE");
        setTotalAll(data.totalAll ?? data.pagination.total);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void fetchDocuments(1); }, [fetchDocuments]);

  const handleExpand = async (docId: string) => {
    if (expandedId === docId) {
      setExpandedId(null);
      setExpandedDoc(null);
      return;
    }
    setExpandedId(docId);
    setExpandedDoc(null);
    setExpandLoading(true);
    try {
      const res = await fetch(`/api/documents/${docId}`);
      if (res.ok) {
        const data = await res.json() as { originalText: string; rewrittenText: string | null };
        setExpandedDoc(data);
      }
    } catch { /* ignore */ }
    finally { setExpandLoading(false); }
  };

  const handleDelete = async (docId: string) => {
    setDeleting(docId);
    try {
      const res = await fetch(`/api/documents/${docId}`, { method: "DELETE" });
      if (res.ok) {
        setDocuments(prev => prev.filter(d => d.id !== docId));
        if (expandedId === docId) { setExpandedId(null); setExpandedDoc(null); }
        toast.success("Document deleted.");
      } else {
        toast.error("Failed to delete.");
      }
    } catch { toast.error("Network error."); }
    finally { setDeleting(null); }
  };

  const handleReHumanize = (doc: Document) => {
    // Prefill the editor with the original text
    sessionStorage.setItem("prefill-text", expandedDoc?.originalText ?? doc.originalText);
    router.push("/dashboard/editor");
  };

  const isFree = plan === "FREE";

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "32px 24px", fontFamily: THEME.fontSans }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "24px", gap: "12px", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: 700, color: THEME.text, letterSpacing: "-0.02em", fontFamily: THEME.fontHeading }}>History</h1>
          <p style={{ fontSize: "13px", color: THEME.textDim, marginTop: "4px" }}>
            {isFree
              ? `Showing last 5 of ${totalAll} documents. Upgrade for full history.`
              : `${pagination.total} document${pagination.total !== 1 ? "s" : ""} analyzed`}
          </p>
        </div>
        <Link href="/dashboard/editor" style={{
          display: "flex", alignItems: "center", gap: "6px",
          background: THEME.brand, color: "#ffffff", fontWeight: 600,
          padding: "9px 16px", borderRadius: "10px", textDecoration: "none", fontSize: "13px",
          boxShadow: glow(THEME.brand, 0.26),
        }}>
          <Plus size={14} aria-hidden="true" />
          New document
        </Link>
      </div>

      {/* Free plan upsell */}
      {isFree && totalAll > 5 && (
        <div style={{
          background: THEME.surface2,
          border: `1px solid ${THEME.border}`,
          borderRadius: THEME.radiusLg, padding: "16px 20px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: "16px", marginBottom: "20px",
          boxShadow: glow(THEME.accent, 0.12),
        }}>
          <div>
            <p style={{ fontSize: "13px", fontWeight: 700, color: THEME.text, marginBottom: "3px" }}>
              {totalAll - 5} more document{totalAll - 5 > 1 ? "s" : ""} hidden
            </p>
            <p style={{ fontSize: "12px", color: THEME.textDim }}>
              Upgrade to Pro for full history, unlimited rewrites, all tones.
            </p>
          </div>
          <Link href="/dashboard/settings" style={{
            display: "inline-flex", alignItems: "center", gap: "5px",
            background: THEME.accent, color: "#ffffff", fontWeight: 700,
            padding: "9px 18px", borderRadius: "10px", textDecoration: "none", fontSize: "13px",
            flexShrink: 0, boxShadow: glow(THEME.accent, 0.28),
          }}>
            Upgrade <ArrowRight size={13} aria-hidden="true" />
          </Link>
        </div>
      )}

      {/* Document list */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {[...Array(5)].map((_, i) => (
            <div key={i} style={{
              height: "72px", borderRadius: THEME.radius,
              background: THEME.surface2,
              animation: "pulse 2s infinite",
            }} />
          ))}
        </div>
      ) : documents.length === 0 ? (
        <div style={{
          background: THEME.surface2, border: `1px dashed ${THEME.borderStrong}`,
          borderRadius: THEME.radius, padding: "64px 24px",
          display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center",
        }}>
          <FileText size={32} style={{ color: THEME.textMuted, marginBottom: "16px" }} aria-hidden="true" />
          <p style={{ fontSize: "14px", fontWeight: 600, color: THEME.textDim, marginBottom: "6px" }}>No documents yet</p>
          <p style={{ fontSize: "13px", color: THEME.textMuted, marginBottom: "20px" }}>
            Head to the editor and analyze your first text.
          </p>
          <Link href="/dashboard/editor" style={{
            display: "inline-flex", alignItems: "center", gap: "6px",
            background: THEME.brand, color: "#ffffff", fontWeight: 700,
            padding: "10px 22px", borderRadius: "10px", textDecoration: "none", fontSize: "13px",
            boxShadow: glow(THEME.brand, 0.26),
          }}>
            Open editor <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {documents.map((doc, idx) => {
            const isExpanded = expandedId === doc.id;
            const humanOriginal = humanScore(doc.overallScore);
            const humanRewritten = doc.humanizedScore !== null ? humanScore(doc.humanizedScore) : null;
            return (
              <div key={doc.id}>
                <div
                  onClick={() => void handleExpand(doc.id)}
                  style={{
                    background: THEME.surface2,
                    border: `1px solid ${isExpanded ? `${THEME.brand}55` : THEME.border}`,
                    borderRadius: isExpanded ? "10px 10px 0 0" : THEME.radius,
                    padding: "14px 16px",
                    display: "flex", alignItems: "center", gap: "14px",
                    cursor: "pointer",
                    transition: "border-color 0.15s",
                  }}
                  className="history-row"
                >
                  {/* Index */}
                  <span className="tnum" style={{ fontSize: "11px", color: THEME.textMuted, width: "20px", textAlign: "right", flexShrink: 0 }}>
                    {(pagination.page - 1) * 10 + idx + 1}
                  </span>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontSize: "13px", color: THEME.textDim, lineHeight: 1.5,
                      overflow: "hidden", display: "-webkit-box",
                      WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                      minWidth: 0, maxWidth: "100%",
                    }}>
                      {doc.title || doc.originalText}
                    </p>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "7px" }}>
                      <span style={{ fontSize: "11px", color: THEME.textMuted }}>
                        {doc.wordCount} words
                      </span>
                      {doc.rewrittenText && (
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: "4px",
                          fontSize: "10px", fontWeight: 600, color: THEME.human,
                          background: THEME.humanDim, padding: "2px 8px", borderRadius: "100px",
                        }}>
                          <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: THEME.human }} aria-hidden="true" />
                          Humanized
                        </span>
                      )}
                      {doc.tone && doc.tone !== "standard" && (
                        <span style={{
                          fontSize: "10px", fontWeight: 600, textTransform: "capitalize",
                          color: THEME.brandHi, padding: "2px 8px", borderRadius: "100px", background: THEME.brandDim,
                        }}>
                          {doc.tone}
                        </span>
                      )}
                      <span style={{ fontSize: "11px", color: THEME.textMuted }}>
                        {timeAgo(doc.createdAt)}
                      </span>
                    </div>
                  </div>

                  {/* Score badges — HUMAN score (higher = greener = more human) */}
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                    {doc.status === "processing" ? (
                      <span style={{ fontSize: "11px", fontWeight: 600, color: THEME.brandHi, background: THEME.brandDim, padding: "3px 9px", borderRadius: "100px" }}>
                        Processing…
                      </span>
                    ) : doc.status === "error" ? (
                      <span style={{ fontSize: "11px", fontWeight: 600, color: THEME.ai, background: THEME.aiDim, padding: "3px 9px", borderRadius: "100px" }}>
                        Failed
                      </span>
                    ) : (
                      <>
                        <span className="tnum" style={{
                          fontSize: "13px", fontWeight: 700, color: humanScoreColor(humanOriginal),
                          background: THEME.surface3,
                          padding: "3px 8px", borderRadius: "5px",
                        }}
                        title="Human score before humanizing">
                          {humanOriginal}
                        </span>
                        {humanRewritten !== null && (
                          <>
                            <ArrowRight size={10} color={THEME.textMuted} aria-hidden="true" />
                            <span className="tnum" style={{
                              fontSize: "13px", fontWeight: 700, color: humanScoreColor(humanRewritten),
                              background: THEME.surface3,
                              padding: "3px 8px", borderRadius: "5px",
                            }}
                            title="Human score after humanizing">
                              {humanRewritten}
                            </span>
                          </>
                        )}
                      </>
                    )}
                    {isExpanded ? <ChevronUp size={14} color={THEME.textMuted} aria-hidden="true" /> : <ChevronDown size={14} color={THEME.textMuted} aria-hidden="true" />}
                  </div>
                </div>

                {/* Expanded view */}
                {isExpanded && (
                  <div style={{
                    background: THEME.surface1,
                    border: `1px solid ${THEME.brand}55`,
                    borderTop: "none",
                    borderRadius: "0 0 10px 10px",
                    padding: "16px",
                    animation: "fadeInDown 0.2s ease",
                  }}>
                    {expandLoading ? (
                      <div style={{ padding: "20px", textAlign: "center" }}>
                        <div className="spin-sm" style={{ margin: "0 auto 8px" }} />
                        <span style={{ fontSize: "12px", color: THEME.textDim }}>Loading...</span>
                      </div>
                    ) : expandedDoc && (
                      <>
                        <div style={{ marginBottom: "12px" }}>
                          <label style={{ fontSize: "11px", fontWeight: 600, color: THEME.textDim, display: "block", marginBottom: "6px" }}>
                            Original text
                          </label>
                          <div style={{
                            padding: "12px 14px", borderRadius: "10px",
                            background: THEME.surface2, border: `1px solid ${THEME.border}`,
                            fontSize: "13px", color: THEME.textDim, lineHeight: 1.7,
                            maxHeight: "200px", overflow: "auto", whiteSpace: "pre-wrap",
                          }}>
                            {expandedDoc.originalText}
                          </div>
                        </div>
                        {expandedDoc.rewrittenText && (
                          <div style={{ marginBottom: "12px" }}>
                            <label style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "11px", fontWeight: 600, color: THEME.human, marginBottom: "6px" }}>
                              <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: THEME.human }} aria-hidden="true" />
                              Humanized text
                            </label>
                            <div style={{
                              padding: "12px 14px", borderRadius: "10px",
                              background: THEME.humanDim, border: `1px solid ${THEME.human}33`,
                              fontSize: "13px", color: THEME.text, lineHeight: 1.7,
                              maxHeight: "200px", overflow: "auto", whiteSpace: "pre-wrap",
                            }}>
                              {expandedDoc.rewrittenText}
                            </div>
                          </div>
                        )}
                        <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                          <button
                            onClick={() => handleReHumanize(doc)}
                            style={{
                              display: "flex", alignItems: "center", gap: "6px",
                              padding: "8px 16px", borderRadius: "10px", fontSize: "12px", fontWeight: 600,
                              background: THEME.brandDim, border: `1px solid ${THEME.brand}44`,
                              color: THEME.brandHi, cursor: "pointer",
                            }}
                          >
                            <RotateCcw size={12} aria-hidden="true" /> Re-humanize
                          </button>
                          <button
                            onClick={() => void handleDelete(doc.id)}
                            disabled={deleting === doc.id}
                            style={{
                              display: "flex", alignItems: "center", gap: "6px",
                              padding: "8px 16px", borderRadius: "10px", fontSize: "12px", fontWeight: 600,
                              background: THEME.aiDim, border: `1px solid ${THEME.ai}33`,
                              color: THEME.ai, cursor: deleting === doc.id ? "not-allowed" : "pointer",
                              opacity: deleting === doc.id ? 0.5 : 1,
                            }}
                          >
                            <Trash2 size={12} aria-hidden="true" /> {deleting === doc.id ? "Deleting…" : "Delete"}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {!isFree && pagination.totalPages > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", marginTop: "24px" }}>
          <button
            onClick={() => void fetchDocuments(pagination.page - 1)}
            disabled={pagination.page <= 1 || loading}
            style={{
              display: "flex", alignItems: "center", gap: "6px",
              background: THEME.surface2, border: `1px solid ${THEME.border}`,
              color: THEME.textDim, fontSize: "12px", fontWeight: 600,
              padding: "8px 16px", borderRadius: "10px", cursor: pagination.page <= 1 ? "not-allowed" : "pointer",
              opacity: pagination.page <= 1 ? 0.4 : 1,
            }}
          >
            <ChevronLeft size={14} aria-hidden="true" /> Prev
          </button>
          <span className="tnum" style={{ fontSize: "12px", color: THEME.textDim }}>
            {pagination.page} / {pagination.totalPages}
          </span>
          <button
            onClick={() => void fetchDocuments(pagination.page + 1)}
            disabled={pagination.page >= pagination.totalPages || loading}
            style={{
              display: "flex", alignItems: "center", gap: "6px",
              background: THEME.surface2, border: `1px solid ${THEME.border}`,
              color: THEME.textDim, fontSize: "12px", fontWeight: 600,
              padding: "8px 16px", borderRadius: "10px", cursor: pagination.page >= pagination.totalPages ? "not-allowed" : "pointer",
              opacity: pagination.page >= pagination.totalPages ? 0.4 : 1,
            }}
          >
            Next <ChevronRight size={14} aria-hidden="true" />
          </button>
        </div>
      )}

      <style>{`
        .history-row:hover {
          border-color: ${THEME.brand}55 !important;
          box-shadow: ${glow(THEME.brand, 0.16)};
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
        @keyframes fadeInDown {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .spin-sm {
          width: 14px; height: 14px; border-radius: 50%;
          border: 2px solid ${THEME.border};
          border-top-color: ${THEME.brand};
          animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
