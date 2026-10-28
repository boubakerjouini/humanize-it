// ===========================================================
// components/workspace/inline-error.tsx — the workspace's error card: a
// friendly title + one sentence (from feedback.ts, never a raw server
// string) and the one next step that helps: Retry, or Sign in when the
// session is gone. Stays on screen until acted on, unlike a toast.
// ===========================================================

"use client";

import Link from "next/link";
import { AlertCircle, RotateCw, X } from "lucide-react";
import { THEME } from "@/lib/theme";
import type { FriendlyError } from "@/components/workspace/feedback";

export function InlineError({ error, onRetry, onDismiss, retrying, compact }: {
  error: FriendlyError;
  onRetry?: () => void;
  onDismiss?: () => void;
  retrying?: boolean;
  compact?: boolean;
}) {
  return (
    <div role="alert" style={{
      display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap",
      background: THEME.aiDim, border: `1px solid ${THEME.ai}33`, borderRadius: THEME.radius,
      padding: compact ? "12px 14px" : "14px 16px", fontFamily: THEME.fontSans,
    }}>
      <AlertCircle size={18} color={THEME.ai} aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }} />
      <div style={{ flex: "1 1 200px", minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: THEME.text }}>{error.title}</div>
        <div style={{ fontSize: 13, color: THEME.textDim, lineHeight: 1.5, marginTop: 2 }}>{error.message}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
        {error.signIn ? (
          <Link href="/sign-in" style={actionBtn}>Sign in</Link>
        ) : error.retryable && onRetry ? (
          <button onClick={onRetry} disabled={retrying} style={{ ...actionBtn, opacity: retrying ? 0.6 : 1, cursor: retrying ? "wait" : "pointer" }}>
            <RotateCw size={13} aria-hidden="true" /> {retrying ? "Retrying…" : "Retry"}
          </button>
        ) : null}
        {onDismiss && (
          <button onClick={onDismiss} aria-label="Dismiss" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, background: "transparent", border: "none", borderRadius: 8, color: THEME.textMuted, cursor: "pointer" }}>
            <X size={15} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}

const actionBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6, background: THEME.surface2, color: THEME.text,
  border: `1px solid ${THEME.borderStrong}`, borderRadius: 8, padding: "7px 13px", fontSize: 13, fontWeight: 600,
  cursor: "pointer", fontFamily: THEME.fontSans, textDecoration: "none", whiteSpace: "nowrap",
};
