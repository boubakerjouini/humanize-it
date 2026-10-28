// ===========================================================
// components/workspace/error-state.tsx — the full-page "something's off"
// card behind app/not-found.tsx and the error boundaries: the H. wordmark,
// one plain sentence and the next step (Try again / go somewhere useful).
// No hooks, so the server 404 and the client error boundaries share it.
// ===========================================================

import Link from "next/link";
import { THEME, glow } from "@/lib/theme";

export interface ErrorStateAction {
  label: string;
  href?: string;
  onClick?: () => void;
  primary?: boolean;
}

export function ErrorState({ code, title, message, actions, inShell }: {
  /** Big faint label above the title ("404"), optional. */
  code?: string;
  title: string;
  message: string;
  actions: ErrorStateAction[];
  /** Inside the workspace shell: no full-viewport height, no wordmark (the shell shows it). */
  inShell?: boolean;
}) {
  return (
    <main style={{
      minHeight: inShell ? "70vh" : "100dvh", display: "flex", alignItems: "center", justifyContent: "center",
      padding: "48px 20px", background: inShell ? "transparent" : `radial-gradient(60% 50% at 50% 0%, ${THEME.brandDim} 0%, ${THEME.bg} 70%)`,
      fontFamily: THEME.fontSans,
    }}>
      <div style={{ width: "100%", maxWidth: 460, textAlign: "center" }}>
        {!inShell && (
          <Link href="/" aria-label="HumanizeIt home" style={{ display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none", marginBottom: 36 }}>
            <span style={{ fontSize: 24, fontWeight: 800, color: THEME.brand, fontFamily: THEME.fontHeading, letterSpacing: "-0.5px" }}>H<span style={{ color: THEME.accent }}>.</span></span>
            <span style={{ fontSize: 17, fontWeight: 700, color: THEME.text, fontFamily: THEME.fontHeading, letterSpacing: "-0.01em" }}>HumanizeIt</span>
          </Link>
        )}
        {code && (
          <div aria-hidden="true" style={{ fontSize: 72, lineHeight: 1, fontWeight: 800, fontFamily: THEME.fontHeading, letterSpacing: "-0.04em", background: THEME.gradient, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", marginBottom: 14 }}>
            {code}
          </div>
        )}
        <h1 style={{ fontSize: 24, fontWeight: 800, color: THEME.text, fontFamily: THEME.fontHeading, letterSpacing: "-0.02em", margin: "0 0 8px" }}>{title}</h1>
        <p style={{ fontSize: 15, color: THEME.textDim, lineHeight: 1.6, margin: "0 auto 26px", maxWidth: 380 }}>{message}</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          {actions.map((a) => {
            const style: React.CSSProperties = a.primary
              ? { ...btn, background: THEME.gradient, color: "#fff", border: "none", boxShadow: glow(THEME.brand, 0.3) }
              : btn;
            return a.href
              ? <Link key={a.label} href={a.href} style={style}>{a.label}</Link>
              : <button key={a.label} onClick={a.onClick} style={style}>{a.label}</button>;
          })}
        </div>
      </div>
    </main>
  );
}

const btn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: 42, padding: "0 18px",
  borderRadius: 10, fontSize: 14, fontWeight: 700, textDecoration: "none", cursor: "pointer",
  background: THEME.surface2, color: THEME.text, border: `1px solid ${THEME.border}`, fontFamily: THEME.fontSans,
};
