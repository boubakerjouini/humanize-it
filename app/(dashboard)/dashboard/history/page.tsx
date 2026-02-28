"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { FileText, Plus, ChevronLeft, ChevronRight } from "lucide-react";

interface Document {
  id: string;
  originalText: string;
  overallScore: number;
  wordCount: number;
  rewrittenText: string | null;
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
  error?: { message: string };
}

interface UsageResponse {
  plan: string;
  error?: { message: string };
}

function scoreColor(s: number): string {
  if (s >= 80) return "#ef4444";
  if (s >= 61) return "#8b5cf6";
  if (s >= 31) return "#a78bfa";
  return "#22c55e";
}

function scoreBg(s: number): string {
  if (s >= 80) return "rgba(239,68,68,0.12)";
  if (s >= 61) return "rgba(139,92,246,0.12)";
  if (s >= 31) return "rgba(167,139,250,0.12)";
  return "rgba(34,197,94,0.12)";
}

function scoreLabel(s: number): string {
  if (s >= 80) return "Very AI";
  if (s >= 61) return "Likely AI";
  if (s >= 31) return "Possibly AI";
  return "Human";
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (days > 30) return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  if (days > 0) return `${days} day${days > 1 ? "s" : ""} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  if (mins > 0) return `${mins} min${mins > 1 ? "s" : ""} ago`;
  return "just now";
}

export default function HistoryPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<string>("FREE");
  const fetchDocuments = useCallback(async (page: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/documents?page=${page}&limit=10`);
      const data = await res.json() as DocumentsResponse;
      if (res.ok) {
        setDocuments(data.documents);
        setPagination({ page: data.pagination.page, totalPages: data.pagination.totalPages, total: data.pagination.total });
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetch("/api/usage")
      .then(r => r.json())
      .then((d: UsageResponse) => {
        const p = d.plan ?? "FREE";
        setPlan(p);

        if (p !== "FREE") void fetchDocuments(1);
        else setLoading(false);
      })
      .catch(() => { setLoading(false); });
  }, [fetchDocuments]);

  const isFree = plan === "FREE";

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", fontFamily: "var(--font-geist-sans), Inter, sans-serif" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: 700, color: "#fafafa", letterSpacing: "-0.5px" }}>History</h1>
          <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.35)", marginTop: "4px" }}>
            {isFree ? "Upgrade to Pro to unlock history" : `${pagination.total} document${pagination.total !== 1 ? "s" : ""} analyzed`}
          </p>
        </div>
        <Link href="/dashboard/editor" style={{
          display: "flex", alignItems: "center", gap: "6px",
          background: "#8b5cf6", color: "#09090b", fontWeight: 600,
          padding: "8px 14px", borderRadius: "6px", textDecoration: "none", fontSize: "12px",
        }}>
          <Plus size={13} />
          New Doc
        </Link>
      </div>

      {/* Free plan gate */}
      {isFree && (
        <div style={{
          background: "rgba(139,92,246,0.06)",
          border: "1px solid rgba(139,92,246,0.2)",
          borderRadius: "8px", padding: "20px 24px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: "16px", marginBottom: "20px",
        }}>
          <div>
            <p style={{ fontSize: "14px", fontWeight: 600, color: "#fafafa", marginBottom: "4px" }}>
              History available on Pro — $9/month
            </p>
            <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)" }}>
              Access 30 days of history, unlimited rewrites, all tone modes.
            </p>
          </div>
          <Link href="/dashboard/settings" style={{
            background: "#8b5cf6", color: "#09090b", fontWeight: 700,
            padding: "8px 16px", borderRadius: "6px", textDecoration: "none", fontSize: "12px",
            flexShrink: 0,
          }}>
            Upgrade →
          </Link>
        </div>
      )}

      {/* Document list */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {[...Array(5)].map((_, i) => (
            <div key={i} style={{
              height: "72px", borderRadius: "8px",
              background: "rgba(255,255,255,0.04)",
              animation: "pulse 2s infinite",
            }} />
          ))}
        </div>
      ) : documents.length === 0 ? (
        <div style={{
          background: "#0f0f12", border: "1px dashed rgba(255,255,255,0.08)",
          borderRadius: "8px", padding: "64px 24px",
          display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center",
        }}>
          <FileText size={32} style={{ color: "rgba(255,255,255,0.1)", marginBottom: "16px" }} />
          <p style={{ fontSize: "14px", fontWeight: 600, color: "rgba(255,255,255,0.35)", marginBottom: "6px" }}>No documents yet</p>
          <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.2)", marginBottom: "20px" }}>
            Head to the editor and analyze your first text.
          </p>
          <Link href="/dashboard/editor" style={{
            background: "#8b5cf6", color: "#09090b", fontWeight: 700,
            padding: "8px 20px", borderRadius: "6px", textDecoration: "none", fontSize: "13px",
          }}>
            Open Editor →
          </Link>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {documents.map((doc, idx) => (
            <Link
              key={doc.id}
              href={`/dashboard/editor?doc=${doc.id}`}
              style={{ textDecoration: "none", display: "block" }}
            >
              <div style={{
                background: idx % 2 === 0 ? "#0f0f12" : "rgba(255,255,255,0.015)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: "8px", padding: "14px 16px",
                display: "flex", alignItems: "center", gap: "14px",
                cursor: "pointer",
                transition: "border-color 0.15s, border-left-color 0.15s",
              }}
                className="history-row"
              >
                {/* Index */}
                <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.2)", width: "20px", textAlign: "right", flexShrink: 0, fontFamily: "var(--font-geist-mono), monospace" }}>
                  {(pagination.page - 1) * 10 + idx + 1}
                </span>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    fontSize: "13px", color: "rgba(255,255,255,0.65)", lineHeight: 1.5,
                    overflow: "hidden", display: "-webkit-box",
                    WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                  }}>
                    {doc.originalText}
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "6px" }}>
                    <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.25)", fontFamily: "var(--font-geist-mono), monospace" }}>
                      {doc.wordCount} words
                    </span>
                    {doc.rewrittenText && (
                      <span style={{ fontSize: "11px", color: "#22c55e", fontWeight: 600 }}>✓ Humanized</span>
                    )}
                    <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.2)" }}>
                      {timeAgo(doc.createdAt)}
                    </span>
                  </div>
                </div>

                {/* Score badge */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px", flexShrink: 0 }}>
                  <span style={{
                    fontSize: "13px", fontWeight: 800, color: scoreColor(doc.overallScore),
                    background: scoreBg(doc.overallScore),
                    padding: "3px 8px", borderRadius: "5px",
                    fontFamily: "var(--font-geist-mono), monospace",
                  }}>
                    {Math.round(doc.overallScore)}
                  </span>
                  <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.25)" }}>
                    {scoreLabel(doc.overallScore)}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", marginTop: "24px" }}>
          <button
            onClick={() => void fetchDocuments(pagination.page - 1)}
            disabled={pagination.page <= 1 || loading}
            style={{
              display: "flex", alignItems: "center", gap: "6px",
              background: "transparent", border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.5)", fontSize: "12px", fontWeight: 500,
              padding: "7px 14px", borderRadius: "5px", cursor: pagination.page <= 1 ? "not-allowed" : "pointer",
              opacity: pagination.page <= 1 ? 0.4 : 1,
            }}
          >
            <ChevronLeft size={13} /> Prev
          </button>
          <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.3)", fontFamily: "var(--font-geist-mono), monospace" }}>
            {pagination.page} / {pagination.totalPages}
          </span>
          <button
            onClick={() => void fetchDocuments(pagination.page + 1)}
            disabled={pagination.page >= pagination.totalPages || loading}
            style={{
              display: "flex", alignItems: "center", gap: "6px",
              background: "transparent", border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.5)", fontSize: "12px", fontWeight: 500,
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
          border-left: 3px solid #8b5cf6 !important;
          border-color: rgba(139,92,246,0.25) !important;
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
