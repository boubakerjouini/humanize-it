"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Plus, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Trash2, RotateCcw, ArrowRight } from "lucide-react";
import { toast } from "sonner";

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

function scoreColor(s: number): string {
  if (s >= 75) return "#dc2626";
  if (s >= 50) return "#f97316";
  if (s >= 30) return "#eab308";
  return "#16a34a";
}

function scoreBg(s: number): string {
  if (s >= 75) return "rgba(220,38,38,0.1)";
  if (s >= 50) return "rgba(249,115,22,0.1)";
  if (s >= 30) return "rgba(234,179,8,0.08)";
  return "rgba(22,163,74,0.1)";
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
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "32px 24px", fontFamily: "var(--font-geist-sans), Inter, sans-serif" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "24px", gap: "12px", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: 700, color: "#111827", letterSpacing: "-0.5px" }}>History</h1>
          <p style={{ fontSize: "13px", color: "#9ca3af", marginTop: "4px" }}>
            {isFree
              ? `Showing last 5 of ${totalAll} documents. Upgrade for full history.`
              : `${pagination.total} document${pagination.total !== 1 ? "s" : ""} analyzed`}
          </p>
        </div>
        <Link href="/dashboard/editor" style={{
          display: "flex", alignItems: "center", gap: "6px",
          background: "#7e22ce", color: "#ffffff", fontWeight: 600,
          padding: "8px 14px", borderRadius: "6px", textDecoration: "none", fontSize: "12px",
        }}>
          <Plus size={13} />
          New Doc
        </Link>
      </div>

      {/* Free plan upsell */}
      {isFree && totalAll > 5 && (
        <div style={{
          background: "#faf5ff",
          border: "1px solid rgba(126,34,206,0.2)",
          borderRadius: "8px", padding: "16px 20px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: "16px", marginBottom: "20px",
        }}>
          <div>
            <p style={{ fontSize: "13px", fontWeight: 600, color: "#111827", marginBottom: "3px" }}>
              {totalAll - 5} more document{totalAll - 5 > 1 ? "s" : ""} hidden
            </p>
            <p style={{ fontSize: "12px", color: "#9ca3af" }}>
              Upgrade to Pro for full history, unlimited rewrites, all tones.
            </p>
          </div>
          <Link href="/dashboard/settings" style={{
            background: "#7e22ce", color: "#ffffff", fontWeight: 700,
            padding: "8px 16px", borderRadius: "6px", textDecoration: "none", fontSize: "12px",
            flexShrink: 0,
          }}>
            Upgrade
          </Link>
        </div>
      )}

      {/* Document list */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {[...Array(5)].map((_, i) => (
            <div key={i} style={{
              height: "72px", borderRadius: "8px",
              background: "#f3f4f6",
              animation: "pulse 2s infinite",
            }} />
          ))}
        </div>
      ) : documents.length === 0 ? (
        <div style={{
          background: "#ffffff", border: "1px dashed #e5e7eb",
          borderRadius: "8px", padding: "64px 24px",
          display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center",
        }}>
          <FileText size={32} style={{ color: "#d1d5db", marginBottom: "16px" }} />
          <p style={{ fontSize: "14px", fontWeight: 600, color: "#9ca3af", marginBottom: "6px" }}>No documents yet</p>
          <p style={{ fontSize: "13px", color: "#d1d5db", marginBottom: "20px" }}>
            Head to the editor and analyze your first text.
          </p>
          <Link href="/dashboard/editor" style={{
            background: "#7e22ce", color: "#ffffff", fontWeight: 700,
            padding: "8px 20px", borderRadius: "6px", textDecoration: "none", fontSize: "13px",
          }}>
            Open Editor
          </Link>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {documents.map((doc, idx) => {
            const isExpanded = expandedId === doc.id;
            return (
              <div key={doc.id}>
                <div
                  onClick={() => void handleExpand(doc.id)}
                  style={{
                    background: idx % 2 === 0 ? "#ffffff" : "#f9fafb",
                    border: `1px solid ${isExpanded ? "rgba(126,34,206,0.25)" : "#e5e7eb"}`,
                    borderRadius: isExpanded ? "8px 8px 0 0" : "8px",
                    padding: "14px 16px",
                    display: "flex", alignItems: "center", gap: "14px",
                    cursor: "pointer",
                    transition: "border-color 0.15s",
                  }}
                  className="history-row"
                >
                  {/* Index */}
                  <span style={{ fontSize: "11px", color: "#d1d5db", width: "20px", textAlign: "right", flexShrink: 0, fontFamily: "var(--font-geist-mono), monospace" }}>
                    {(pagination.page - 1) * 10 + idx + 1}
                  </span>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontSize: "13px", color: "#4b5563", lineHeight: 1.5,
                      overflow: "hidden", display: "-webkit-box",
                      WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                      minWidth: 0, maxWidth: "100%",
                    }}>
                      {doc.title || doc.originalText}
                    </p>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "6px" }}>
                      <span style={{ fontSize: "11px", color: "#9ca3af", fontFamily: "var(--font-geist-mono), monospace" }}>
                        {doc.wordCount} words
                      </span>
                      {doc.rewrittenText && (
                        <span style={{ fontSize: "11px", color: "#16a34a", fontWeight: 600 }}>Humanized</span>
                      )}
                      {doc.tone && doc.tone !== "standard" && (
                        <span style={{ fontSize: "10px", color: "rgba(126,34,206,0.6)", padding: "1px 5px", borderRadius: "3px", background: "#f3e8ff" }}>
                          {doc.tone}
                        </span>
                      )}
                      <span style={{ fontSize: "11px", color: "#d1d5db" }}>
                        {timeAgo(doc.createdAt)}
                      </span>
                    </div>
                  </div>

                  {/* Score badges */}
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                    <span style={{
                      fontSize: "13px", fontWeight: 800, color: scoreColor(doc.overallScore),
                      background: scoreBg(doc.overallScore),
                      padding: "3px 8px", borderRadius: "5px",
                      fontFamily: "var(--font-geist-mono), monospace",
                    }}>
                      {Math.round(doc.overallScore)}
                    </span>
                    {doc.humanizedScore !== null && (
                      <>
                        <ArrowRight size={10} color="#d1d5db" />
                        <span style={{
                          fontSize: "13px", fontWeight: 800, color: scoreColor(doc.humanizedScore),
                          background: scoreBg(doc.humanizedScore),
                          padding: "3px 8px", borderRadius: "5px",
                          fontFamily: "var(--font-geist-mono), monospace",
                        }}>
                          {Math.round(doc.humanizedScore)}
                        </span>
                      </>
                    )}
                    {isExpanded ? <ChevronUp size={14} color="#d1d5db" /> : <ChevronDown size={14} color="#d1d5db" />}
                  </div>
                </div>

                {/* Expanded view */}
                {isExpanded && (
                  <div style={{
                    background: "#f9fafb",
                    border: "1px solid rgba(126,34,206,0.25)",
                    borderTop: "none",
                    borderRadius: "0 0 8px 8px",
                    padding: "16px",
                    animation: "fadeInDown 0.2s ease",
                  }}>
                    {expandLoading ? (
                      <div style={{ padding: "20px", textAlign: "center" }}>
                        <div className="spin-sm" style={{ margin: "0 auto 8px" }} />
                        <span style={{ fontSize: "12px", color: "#9ca3af" }}>Loading...</span>
                      </div>
                    ) : expandedDoc && (
                      <>
                        <div style={{ marginBottom: "12px" }}>
                          <label style={{ fontSize: "10px", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: "6px" }}>
                            Original Text
                          </label>
                          <div style={{
                            padding: "12px", borderRadius: "6px",
                            background: "#f3f4f6", border: "1px solid #e5e7eb",
                            fontSize: "13px", color: "#4b5563", lineHeight: 1.7,
                            maxHeight: "200px", overflow: "auto", whiteSpace: "pre-wrap",
                          }}>
                            {expandedDoc.originalText}
                          </div>
                        </div>
                        {expandedDoc.rewrittenText && (
                          <div style={{ marginBottom: "12px" }}>
                            <label style={{ fontSize: "10px", color: "rgba(22,163,74,0.6)", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: "6px" }}>
                              Humanized Text
                            </label>
                            <div style={{
                              padding: "12px", borderRadius: "6px",
                              background: "rgba(22,163,74,0.04)", border: "1px solid rgba(22,163,74,0.12)",
                              fontSize: "13px", color: "#374151", lineHeight: 1.7,
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
                              display: "flex", alignItems: "center", gap: "5px",
                              padding: "7px 14px", borderRadius: "6px", fontSize: "12px", fontWeight: 600,
                              background: "#f3e8ff", border: "1px solid rgba(126,34,206,0.2)",
                              color: "#a855f7", cursor: "pointer",
                            }}
                          >
                            <RotateCcw size={11} /> Re-humanize
                          </button>
                          <button
                            onClick={() => void handleDelete(doc.id)}
                            disabled={deleting === doc.id}
                            style={{
                              display: "flex", alignItems: "center", gap: "5px",
                              padding: "7px 14px", borderRadius: "6px", fontSize: "12px",
                              background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.15)",
                              color: "#dc2626", cursor: deleting === doc.id ? "not-allowed" : "pointer",
                              opacity: deleting === doc.id ? 0.5 : 1,
                            }}
                          >
                            <Trash2 size={11} /> {deleting === doc.id ? "Deleting..." : "Delete"}
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
              background: "transparent", border: "1px solid #e5e7eb",
              color: "#6b7280", fontSize: "12px", fontWeight: 500,
              padding: "7px 14px", borderRadius: "5px", cursor: pagination.page <= 1 ? "not-allowed" : "pointer",
              opacity: pagination.page <= 1 ? 0.4 : 1,
            }}
          >
            <ChevronLeft size={13} /> Prev
          </button>
          <span style={{ fontSize: "12px", color: "#9ca3af", fontFamily: "var(--font-geist-mono), monospace" }}>
            {pagination.page} / {pagination.totalPages}
          </span>
          <button
            onClick={() => void fetchDocuments(pagination.page + 1)}
            disabled={pagination.page >= pagination.totalPages || loading}
            style={{
              display: "flex", alignItems: "center", gap: "6px",
              background: "transparent", border: "1px solid #e5e7eb",
              color: "#6b7280", fontSize: "12px", fontWeight: 500,
              padding: "7px 14px", borderRadius: "5px", cursor: pagination.page >= pagination.totalPages ? "not-allowed" : "pointer",
              opacity: pagination.page >= pagination.totalPages ? 0.4 : 1,
            }}
          >
            Next <ChevronRight size={13} />
          </button>
        </div>
      )}

      <style>{`
        .history-row:hover {
          border-left: 3px solid #7e22ce !important;
          border-color: rgba(126,34,206,0.25) !important;
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
          border: 2px solid #e5e7eb;
          border-top-color: #7e22ce;
          animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
