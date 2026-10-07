"use client";

// ===========================================================
// components/growth/report-actions.tsx — Screen-only controls on the
// Before/After Report: "Save as PDF" is the browser's own print dialog
// (window.print plus the page's print CSS), so no PDF library is needed.
// ===========================================================

import Link from "next/link";
import { Printer, ArrowLeft } from "lucide-react";
import { THEME, glow } from "@/lib/theme";

export function ReportActions() {
  return (
    <div className="no-print" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
      <button onClick={() => window.print()}
        style={{ display: "inline-flex", alignItems: "center", gap: 7, background: THEME.gradient, color: "#fff", border: "none", borderRadius: 9, padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: glow(THEME.brand, 0.28), fontFamily: THEME.fontSans }}>
        <Printer size={14} aria-hidden="true" /> Save as PDF
      </button>
      <Link href="/dashboard"
        style={{ display: "inline-flex", alignItems: "center", gap: 6, background: THEME.surface2, color: THEME.text, border: `1px solid ${THEME.border}`, borderRadius: 9, padding: "9px 14px", fontSize: 13, fontWeight: 600, textDecoration: "none", fontFamily: THEME.fontSans }}>
        <ArrowLeft size={14} aria-hidden="true" /> Back to the editor
      </Link>
      <span style={{ fontSize: 12, color: THEME.textMuted }}>In the print dialog, choose &quot;Save as PDF&quot; as the destination.</span>
    </div>
  );
}
