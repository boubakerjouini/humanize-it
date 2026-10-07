"use client";

// ===========================================================
// components/growth/confirm-download.tsx — The thanks / confirmed pages'
// client part: the PDF download (always shown, the file is public) and the
// explicit double opt-in button. Consent is confirmed ONLY when the person
// presses the button: link scanners open these pages and run their scripts,
// so nothing may POST on load.
// ===========================================================

import { useState, type CSSProperties } from "react";
import { THEME, glow } from "@/lib/theme";

type Props = {
  /** Signed confirm token from the email link; null when missing or invalid. */
  token: string | null;
  /** Whether there is anything pending to confirm for this token. */
  canConfirm: boolean;
  /** Direct PDF path for magnets. */
  downloadUrl?: string;
  confirmLabel: string;
  /** Shown after a successful confirm. */
  confirmedMessage: string;
  /** Explains what the button does, shown above it. */
  confirmPrompt?: string;
};

type State = { kind: "idle" } | { kind: "busy" } | { kind: "done" } | { kind: "error"; message: string };

const primary: CSSProperties = {
  display: "inline-block",
  background: THEME.gradient,
  color: "#fff",
  fontWeight: 700,
  fontSize: "15px",
  padding: "12px 26px",
  borderRadius: THEME.radius,
  textDecoration: "none",
  border: "none",
  cursor: "pointer",
  boxShadow: glow(THEME.brand, 0.3),
  fontFamily: THEME.fontSans,
};

const secondary: CSSProperties = {
  ...primary,
  background: THEME.surface2,
  color: THEME.brandHi,
  border: `1px solid ${THEME.borderStrong}`,
  boxShadow: "none",
};

export function ConfirmDownload({ token, canConfirm, downloadUrl, confirmLabel, confirmedMessage, confirmPrompt }: Props) {
  const [state, setState] = useState<State>({ kind: "idle" });

  async function confirm() {
    if (!token || state.kind === "busy") return;
    setState({ kind: "busy" });
    try {
      const res = await fetch("/api/public/leads/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ t: token }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: { message?: string } } | null;
      if (!res.ok || !data?.ok) {
        setState({ kind: "error", message: data?.error?.message ?? "We couldn't confirm that. Please try again." });
        return;
      }
      setState({ kind: "done" });
    } catch {
      setState({ kind: "error", message: "We couldn't reach the server. Check your connection and try again." });
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
      {downloadUrl ? (
        <div>
          <a href={downloadUrl} target="_blank" rel="noopener" style={primary}>
            Download the PDF &rarr;
          </a>
        </div>
      ) : null}

      {token && canConfirm ? (
        <div
          style={{ background: THEME.surface1, border: `1px solid ${THEME.border}`, borderRadius: THEME.radiusLg, padding: "18px 20px" }}
          aria-live="polite"
        >
          {state.kind === "done" ? (
            <p style={{ margin: 0, fontSize: "15px", color: THEME.text, fontWeight: 600 }}>{confirmedMessage}</p>
          ) : (
            <>
              {confirmPrompt ? (
                <p style={{ margin: "0 0 12px", fontSize: "14px", color: THEME.textDim, lineHeight: 1.6 }}>{confirmPrompt}</p>
              ) : null}
              <button type="button" onClick={confirm} disabled={state.kind === "busy"} style={downloadUrl ? secondary : primary}>
                {state.kind === "busy" ? "Confirming…" : confirmLabel}
              </button>
              {state.kind === "error" ? (
                <p role="alert" style={{ margin: "10px 0 0", fontSize: "13px", color: THEME.ai }}>
                  {state.message}
                </p>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
