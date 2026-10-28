// ===========================================================
// Shared frame for /sign-in and /sign-up: the site's "H." wordmark in a top
// bar (same as the marketing nav), one short line, then the Clerk card. The
// Clerk look itself comes from ClerkProvider (lib/clerk-appearance.ts).
// ===========================================================

import Link from "next/link";
import { THEME } from "@/lib/theme";

export function AuthShell({ tagline, children, footnote }: {
  tagline: string;
  children: React.ReactNode;
  footnote?: React.ReactNode;
}) {
  return (
    <div style={{ minHeight: "100dvh", background: THEME.surface1, display: "flex", flexDirection: "column" }}>
      <header style={{ height: "56px", display: "flex", alignItems: "center", padding: "0 20px" }}>
        <Link href="/" aria-label="HumanizeIt home" style={{ display: "flex", alignItems: "center", gap: "7px", textDecoration: "none" }}>
          <span style={{ fontSize: "19px", fontWeight: 800, color: THEME.brand, letterSpacing: "-0.5px", fontFamily: THEME.fontHeading }}>
            H<span style={{ color: THEME.accent }}>.</span>
          </span>
          <span style={{ fontSize: "14px", fontWeight: 600, color: THEME.text, fontFamily: THEME.fontHeading }}>HumanizeIt</span>
        </Link>
      </header>
      <main style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "12px 16px 40px" }}>
        <p style={{ margin: "0 0 18px", fontSize: "14px", color: THEME.textDim, textAlign: "center" }}>{tagline}</p>
        {children}
        {footnote ? (
          <p style={{ maxWidth: "400px", margin: "16px 0 0", textAlign: "center", fontSize: "12.5px", color: THEME.textMuted, lineHeight: 1.5 }}>
            {footnote}
          </p>
        ) : null}
      </main>
    </div>
  );
}
