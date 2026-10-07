// ===========================================================
// app/email/layout.tsx — Minimal chrome for the pages people reach from an
// email footer (preference center). No navigation, no sign-in prompts: the
// signed link is the credential, and nothing here should distract from it.
// ===========================================================

import type { Metadata } from "next";
import Link from "next/link";
import { THEME } from "@/lib/theme";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function EmailPagesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: THEME.surface1, fontFamily: THEME.fontSans, color: THEME.text }}>
      <header style={{ maxWidth: 560, margin: "0 auto", padding: "28px 16px 0" }}>
        <Link
          href="/"
          style={{ fontFamily: THEME.fontHeading, fontWeight: 800, fontSize: 18, color: THEME.text, textDecoration: "none", letterSpacing: "-0.02em" }}
        >
          HumanizeIt
        </Link>
      </header>
      <main style={{ maxWidth: 560, margin: "0 auto", padding: "20px 16px 56px" }}>{children}</main>
    </div>
  );
}
