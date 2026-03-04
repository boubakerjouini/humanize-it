"use client";

import { useEffect, useState, useCallback } from "react";

interface UserEvent {
  id: string;
  type: string;
  meta: Record<string, unknown> | null;
  createdAt: string;
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

export function ActivityFeed({ limit = 10 }: { limit?: number }) {
  const [events, setEvents] = useState<UserEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch(`/api/events?limit=${limit}`);
      if (!res.ok) return;
      const data = await res.json();
      setEvents(data.events ?? []);
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchEvents();
    const interval = setInterval(fetchEvents, 30_000);
    return () => clearInterval(interval);
  }, [fetchEvents]);

  if (loading) {
    return (
      <div style={{ padding: "20px", textAlign: "center", color: "rgba(255,255,255,0.3)" }}>
        Loading activity...
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div style={{
        padding: "24px", textAlign: "center",
        color: "rgba(255,255,255,0.3)", fontSize: "13px",
      }}>
        No activity yet. Start by analyzing some text!
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
      {events.map((event) => {
        const config = EVENT_CONFIG[event.type] ?? { emoji: "\uD83D\uDCCC", label: event.type };
        return (
          <div key={event.id} style={{
            display: "flex", alignItems: "center", gap: "12px",
            padding: "10px 14px", borderRadius: "8px",
            background: "rgba(255,255,255,0.02)",
            transition: "background 0.15s",
          }}>
            <span style={{ fontSize: "16px", flexShrink: 0 }}>{config.emoji}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: "13px", fontWeight: 500,
                color: "rgba(255,255,255,0.8)",
              }}>
                {config.label}
              </div>
            </div>
            <span style={{
              fontSize: "11px", color: "rgba(255,255,255,0.25)",
              flexShrink: 0, whiteSpace: "nowrap",
            }}>
              {relativeTime(event.createdAt)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
