"use client";

import { ActivityFeed } from "@/components/activity-feed";

export default function DashboardPage() {
  return (
    <div style={{ minHeight: "100%", background: "#09090b", padding: "24px" }}>
      <div style={{ maxWidth: "640px", margin: "0 auto" }}>

        {/* Recent Activity Card */}
        <div style={{
          background: "#0f0f12",
          borderRadius: "12px",
          border: "1px solid rgba(255,255,255,0.07)",
          overflow: "hidden",
        }}>
          <div style={{
            padding: "14px 18px",
            borderBottom: "1px solid rgba(255,255,255,0.05)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <span style={{ fontSize: "13px", fontWeight: 600, color: "rgba(255,255,255,0.8)" }}>
              Recent Activity
            </span>
            <a href="/dashboard/events" style={{
              fontSize: "11px", color: "#8b5cf6", textDecoration: "none", fontWeight: 500,
            }}>
              View all &rarr;
            </a>
          </div>
          <ActivityFeed limit={10} />
        </div>
      </div>
    </div>
  );
}
