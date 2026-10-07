"use client";

// ===========================================================
// components/growth/founding-badge.tsx — "Founding member" pill shown to the
// Founding 100 in the workspace sidebar and on the settings page.
// ===========================================================

import { Award } from "lucide-react";
import { THEME } from "@/lib/theme";

export function FoundingBadge({ size = "sm" }: { size?: "sm" | "md" }) {
  const md = size === "md";
  return (
    <span
      title="One of the first 100 people to back HumanizeIt"
      style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        background: THEME.accentDim, border: `1px solid ${THEME.accent}44`, color: THEME.accentHi,
        borderRadius: 100, padding: md ? "5px 12px" : "4px 10px",
        fontSize: md ? 12 : 11, fontWeight: 700, fontFamily: THEME.fontSans, whiteSpace: "nowrap",
      }}
    >
      <Award size={md ? 13 : 12} aria-hidden="true" />
      Founding member
    </span>
  );
}
