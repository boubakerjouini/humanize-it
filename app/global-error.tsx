// ===========================================================
// app/global-error.tsx — last-resort boundary when the root layout itself
// fails. It replaces <html>, so it can't rely on the layout's fonts or
// providers: plain inline styles with the brand colors only.
// ===========================================================

"use client";

import { useEffect } from "react";
import { THEME } from "@/lib/theme";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <html lang="en">
      <body style={{ margin: 0, background: THEME.bg, fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif" }}>
        <main style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 20px", textAlign: "center" }}>
          <div style={{ maxWidth: 440 }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: THEME.brand, marginBottom: 28 }}>H<span style={{ color: THEME.accent }}>.</span> <span style={{ color: THEME.text, fontSize: 18 }}>HumanizeIt</span></div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: THEME.text, margin: "0 0 8px" }}>Something went wrong on our side</h1>
            <p style={{ fontSize: 15, color: THEME.textDim, lineHeight: 1.6, margin: "0 0 24px" }}>
              {`HumanizeIt hit an unexpected error. Try again; if it keeps happening, email support@humanizeit.app${error.digest ? ` and mention code ${error.digest}` : ""}.`}
            </p>
            <button onClick={reset} style={{ background: THEME.gradient, color: "#fff", border: "none", borderRadius: 10, padding: "12px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
