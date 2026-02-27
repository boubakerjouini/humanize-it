"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { FileText, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

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

function scoreBadgeColor(score: number): string {
  if (score >= 80) return "bg-red-100 text-red-700 border-red-200";
  if (score >= 61) return "bg-orange-100 text-orange-700 border-orange-200";
  if (score >= 31) return "bg-yellow-100 text-yellow-700 border-yellow-200";
  return "bg-green-100 text-green-700 border-green-200";
}

function scoreLabel(score: number): string {
  if (score >= 80) return "🔴 Very AI";
  if (score >= 61) return "🟠 Likely AI";
  if (score >= 31) return "🟡 Possibly AI";
  return "🟢 Human";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function HistoryPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    totalPages: 1,
    total: 0,
  });
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<string>("FREE");

  const fetchUsage = useCallback(async () => {
    try {
      const res = await fetch("/api/usage");
      const data = await res.json() as UsageResponse;
      if (res.ok) setPlan(data.plan);
    } catch {
      // ignore
    }
  }, []);

  const fetchDocuments = useCallback(async (page: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/documents?page=${page}&limit=10`);
      const data = await res.json() as DocumentsResponse;
      if (res.ok) {
        setDocuments(data.documents);
        setPagination({
          page: data.pagination.page,
          totalPages: data.pagination.totalPages,
          total: data.pagination.total,
        });
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchUsage();
    void fetchDocuments(1);
  }, [fetchUsage, fetchDocuments]);

  const isFree = plan === "FREE";

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Document History</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {isFree
              ? "History available on Pro"
              : `${pagination.total} document${pagination.total !== 1 ? "s" : ""} analyzed`}
          </p>
        </div>
        <Link href="/dashboard/editor">
          <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white">
            <Plus className="h-4 w-4 mr-1.5" />
            New Doc
          </Button>
        </Link>
      </div>

      {/* Free plan notice */}
      {isFree && (
        <Card className="border-indigo-200 bg-indigo-50 dark:bg-indigo-900/20">
          <CardContent className="py-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-indigo-800 dark:text-indigo-300">
                History available on Pro — $9/month
              </p>
              <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-0.5">
                Access 30 days of history, unlimited rewrites, and more.
              </p>
            </div>
            <Link href="/dashboard/settings">
              <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white flex-shrink-0">
                Upgrade →
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Document list */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 rounded-lg bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
          ))}
        </div>
      ) : documents.length === 0 ? (
        <Card className="flex items-center justify-center border-dashed">
          <CardContent className="text-center py-16">
            <FileText className="h-8 w-8 text-zinc-300 mx-auto mb-3" />
            <p className="text-zinc-500 text-sm font-medium">No documents yet</p>
            <p className="text-zinc-400 text-xs mt-1">
              Head to the Editor and analyze your first text.
            </p>
            <Link href="/dashboard/editor">
              <Button size="sm" className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white">
                Open Editor
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {documents.map((doc, idx) => (
            <Link
              key={doc.id}
              href={`/dashboard/editor?doc=${doc.id}`}
              className="block"
            >
              <Card className="hover:shadow-sm transition-shadow cursor-pointer">
                <CardContent className="py-4 flex items-start gap-4">
                  <span className="text-xs text-zinc-400 w-6 flex-shrink-0 mt-0.5 text-right">
                    {(pagination.page - 1) * 10 + idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-700 dark:text-zinc-300 line-clamp-2 leading-snug">
                      {doc.originalText}
                    </p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs text-zinc-400">{doc.wordCount} words</span>
                      {doc.rewrittenText && (
                        <span className="text-xs text-green-600 font-medium">✓ Humanized</span>
                      )}
                      <span className="text-xs text-zinc-400">{formatDate(doc.createdAt)}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <Badge
                      variant="outline"
                      className={`text-xs ${scoreBadgeColor(doc.overallScore)}`}
                    >
                      {Math.round(doc.overallScore)}
                    </Badge>
                    <span className="text-xs text-zinc-400">{scoreLabel(doc.overallScore)}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchDocuments(pagination.page - 1)}
            disabled={pagination.page <= 1 || loading}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Prev
          </Button>
          <span className="text-sm text-zinc-500">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchDocuments(pagination.page + 1)}
            disabled={pagination.page >= pagination.totalPages || loading}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}
