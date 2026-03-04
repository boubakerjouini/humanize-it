"use client";

import { useEffect, useState, useCallback } from "react";
import { BarChart3, FileText, Sparkles, TrendingUp, ChevronLeft, ChevronRight } from "lucide-react";

interface UserEvent {
  id: string;
  type: string;
  meta: Record<string, unknown> | null;
  createdAt: string;
}

interface Stats {
  totalAnalyzed: number;
  totalHumanized: number;
  avgScore: number;
}

const EVENT_CONFIG: Record<string, { emoji: string; label: string }> = {
  "document.analyzed": { emoji: "\uD83D\uDD0D", label: "Text Analyzed" },
  "document.humanized": { emoji: "\u2728", label: "Text Humanized" },
  "quota.hit": { emoji: "\u26A0\uFE0F", label: "Quota Limit Reached" },
  "plan.upgraded": { emoji: "\uD83D\uDE80", label: "Plan Upgraded" },
  "user.firstAnalysis": { emoji: "\uD83C\uDF89", label: "First Analysis!" },
  "user.firstHumanization": { emoji: "\uD83C\uDF89", label: "First Humanization!" },
  "export.copied": { emoji: "\uD83D\uDCCB", label: "Result Copied" },
  "score.improved": { emoji: "\uD83D\uDCC8", label: "Score Improved" },
};

const EVENT_TYPES = [
  { value: "", label: "All Events" },
  { value: "document.analyzed", label: "Analyzed" },
  { value: "document.humanized", label: "Humanized" },
  { value: "quota.hit", label: "Quota Hit" },
  { value: "plan.upgraded", label: "Upgraded" },
  { value: "export.copied", label: "Copied" },
  { value: "score.improved", label: "Score Improved" },
];

const PAGE_SIZE = 20;

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.max(0, now - then);
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function EventsPage() {
  const [events, setEvents] = useState<UserEvent[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(page * PAGE_SIZE),
      });
      if (filter) params.set("type", filter);

      const res = await fetch(`/api/events?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      setEvents(data.events ?? []);
      setTotal(data.total ?? 0);
      if (data.stats) setStats(data.stats);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [page, filter]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div style={{ minHeight: "100%", background: "#09090b", padding: "24px" }}>
      <div style={{ maxWidth: "720px", margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: "24px" }}>
          <h1 style={{ fontSize: "20px", fontWeight: 700, color: "#fafafa", margin: 0 }}>
            Activity
          </h1>
          <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.35)", marginTop: "4px" }}>
            Your product usage and events
          </p>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
            gap: "12px", marginBottom: "24px",
          }}>
            {[
              { icon: FileText, label: "Total Analyzed", value: stats.totalAnalyzed, color: "#8b5cf6" },
              { icon: Sparkles, label: "Total Humanized", value: stats.totalHumanized, color: "#22c55e" },
              { icon: TrendingUp, label: "Avg AI Score", value: `${Math.round(stats.avgScore)}%`, color: "#f97316" },
            ].map(({ icon: Icon, label, value, color }) => (
              <div key={label} style={{
                background: "#0f0f12", borderRadius: "10px",
                border: "1px solid rgba(255,255,255,0.07)",
                padding: "16px",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                  <Icon size={14} style={{ color }} />
                  <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", fontWeight: 500 }}>
                    {label}
                  </span>
                </div>
                <div style={{ fontSize: "24px", fontWeight: 800, color: "#fafafa" }}>
                  {value}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Filter Tabs */}
        <div style={{
          display: "flex", gap: "6px", marginBottom: "16px", flexWrap: "wrap",
        }}>
          {EVENT_TYPES.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => { setFilter(value); setPage(0); }}
              style={{
                padding: "6px 12px", borderRadius: "6px", fontSize: "12px",
                fontWeight: 500, cursor: "pointer",
                border: "1px solid",
                borderColor: filter === value ? "#8b5cf6" : "rgba(255,255,255,0.08)",
                background: filter === value ? "rgba(139,92,246,0.12)" : "transparent",
                color: filter === value ? "#8b5cf6" : "rgba(255,255,255,0.35)",
                transition: "all 0.15s",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Events List */}
        <div style={{
          background: "#0f0f12", borderRadius: "12px",
          border: "1px solid rgba(255,255,255,0.07)",
          overflow: "hidden",
        }}>
          <div style={{
            padding: "12px 16px",
            borderBottom: "1px solid rgba(255,255,255,0.05)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <BarChart3 size={14} style={{ color: "rgba(255,255,255,0.4)" }} />
              <span style={{ fontSize: "12px", fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>
                Events
              </span>
            </div>
            <span style={{
              fontSize: "11px", padding: "2px 8px", borderRadius: "4px",
              background: "rgba(139,92,246,0.12)", color: "#8b5cf6", fontWeight: 700,
            }}>
              {total} total
            </span>
          </div>

          {loading ? (
            <div style={{ padding: "32px", textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: "13px" }}>
              Loading events...
            </div>
          ) : events.length === 0 ? (
            <div style={{ padding: "32px", textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: "13px" }}>
              No events found. Start by analyzing some text!
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {events.map((event, i) => {
                const config = EVENT_CONFIG[event.type] ?? { emoji: "\uD83D\uDCCC", label: event.type };
                return (
                  <div key={event.id} style={{
                    display: "flex", alignItems: "center", gap: "12px",
                    padding: "12px 16px",
                    borderBottom: i < events.length - 1 ? "1px solid rgba(255,255,255,0.03)" : "none",
                    transition: "background 0.15s",
                  }}>
                    <span style={{ fontSize: "16px", flexShrink: 0 }}>{config.emoji}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "13px", fontWeight: 500, color: "rgba(255,255,255,0.8)" }}>
                        {config.label}
                      </div>
                      {event.meta && Object.keys(event.meta).length > 0 && (
                        <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.2)", marginTop: "2px" }}>
                          {Object.entries(event.meta).slice(0, 3).map(([k, v]) => `${k}: ${v}`).join(" · ")}
                        </div>
                      )}
                    </div>
                    <span style={{
                      fontSize: "11px", color: "rgba(255,255,255,0.2)",
                      flexShrink: 0, whiteSpace: "nowrap",
                    }}>
                      {relativeTime(event.createdAt)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{
              padding: "12px 16px",
              borderTop: "1px solid rgba(255,255,255,0.05)",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                style={{
                  display: "flex", alignItems: "center", gap: "4px",
                  padding: "5px 10px", borderRadius: "5px", fontSize: "11px",
                  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                  color: page === 0 ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.5)",
                  cursor: page === 0 ? "not-allowed" : "pointer",
                }}
              >
                <ChevronLeft size={12} /> Previous
              </button>
              <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)" }}>
                Page {page + 1} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                style={{
                  display: "flex", alignItems: "center", gap: "4px",
                  padding: "5px 10px", borderRadius: "5px", fontSize: "11px",
                  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                  color: page >= totalPages - 1 ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.5)",
                  cursor: page >= totalPages - 1 ? "not-allowed" : "pointer",
                }}
              >
                Next <ChevronRight size={12} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
