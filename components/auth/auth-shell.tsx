// ===========================================================
// Shared frame and Clerk appearance for /sign-in and /sign-up: the site's
// "H." wordmark in a top bar (same as the marketing nav), one short line,
// and a Clerk card that fills the width on phones and stays 400px on desktop.
// Sign-up hides the optional name row and the GitHub button so a new account
// is one click (Google) or email + password.
// ===========================================================

import Link from "next/link";
import { THEME, glow } from "@/lib/theme";

const baseElements = {
  rootBox: { width: "100%", display: "flex", justifyContent: "center" },
  cardBox: {
    width: "100%",
    maxWidth: "400px",
    border: `1px solid ${THEME.border}`,
    borderRadius: THEME.radiusLg,
    boxShadow: glow(THEME.brand, 0.14),
  },
  card: { background: THEME.surface2, boxShadow: "none", border: "none", padding: "28px 24px" },
  headerTitle: {
    color: THEME.text,
    fontSize: "22px",
    fontWeight: "700",
    fontFamily: THEME.fontHeading,
    letterSpacing: "-0.02em",
  },
  headerSubtitle: { display: "none" },
  socialButtonsBlockButton: {
    background: THEME.surface2,
    border: `1px solid ${THEME.borderStrong}`,
    color: THEME.text,
    minHeight: "44px",
    "&:hover": { background: THEME.surface1 },
  },
  socialButtonsBlockButtonText: { fontWeight: "600" },
  formFieldLabel: { color: THEME.textDim, fontWeight: "500" },
  formFieldInput: {
    background: THEME.surface2,
    border: `1px solid ${THEME.borderStrong}`,
    color: THEME.text,
    minHeight: "44px",
    fontSize: "16px", // under 16px iOS zooms the page on focus
    "&:focus": { borderColor: THEME.brand },
  },
  formButtonPrimary: {
    background: THEME.gradient,
    minHeight: "44px",
    fontSize: "15px",
    fontWeight: "600",
    textTransform: "none",
    boxShadow: glow(THEME.brand, 0.3),
    "&:hover": { background: THEME.gradient, opacity: 0.92 },
  },
  // The site's CTAs carry no arrow icons.
  buttonArrowIcon: { display: "none" },
  footer: { background: THEME.surface1 },
  footerActionLink: { color: THEME.brandHi, fontWeight: "600" },
  footerActionText: { color: THEME.textDim },
  dividerLine: { background: THEME.border },
  dividerText: { color: THEME.textMuted },
  identityPreviewText: { color: THEME.text },
  identityPreviewEditButton: { color: THEME.brandHi },
};

const variables = {
  colorPrimary: THEME.brand,
  colorBackground: THEME.surface2,
  colorInputBackground: THEME.surface2,
  colorInputText: THEME.text,
  colorText: THEME.text,
  colorTextSecondary: THEME.textDim,
  colorDanger: THEME.ai,
  colorSuccess: THEME.human,
  borderRadius: THEME.radius,
  fontFamily: THEME.fontSans,
};

export const signInAppearance = { variables, elements: baseElements };

export const signUpAppearance = {
  variables,
  elements: {
    ...baseElements,
    // First/last name are optional in Clerk; asking for them only slows sign-up.
    formFieldRow__name: { display: "none" },
    socialButtonsBlockButton__github: { display: "none" },
  },
};

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
