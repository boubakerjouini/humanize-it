// ===========================================================
// lib/clerk-appearance.ts — The one Clerk look, passed to ClerkProvider so
// every Clerk surface matches the site: the /sign-in and /sign-up pages, the
// sign-in/sign-up modals opened from the homepage and /invite, the account
// menu (UserButton) and the profile window. Sign-up hides the optional name
// row and the GitHub button so a new account is Google or email + password;
// sign-in keeps GitHub for accounts created with it.
// ===========================================================

import { THEME, glow } from "@/lib/theme";

// Card sizing for the sign-in/sign-up forms only: the profile window is wider.
const formCard = {
  rootBox: { width: "100%", display: "flex", justifyContent: "center" },
  cardBox: {
    width: "100%",
    maxWidth: "400px",
    border: `1px solid ${THEME.border}`,
    borderRadius: THEME.radiusLg,
    boxShadow: glow(THEME.brand, 0.14),
  },
  card: { background: THEME.surface2, boxShadow: "none", border: "none", padding: "28px 24px" },
};

const baseElements = {
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

export const clerkAppearance = {
  variables,
  elements: {
    ...baseElements,
    // Modals: a dimmed, blurred page behind a card that keeps a margin on phones.
    modalBackdrop: { background: "rgba(29, 23, 38, 0.55)", backdropFilter: "blur(4px)", padding: "16px" },
    modalContent: { margin: "auto", width: "100%", maxWidth: "400px" },
    modalCloseButton: {
      color: THEME.textDim,
      border: "none",
      boxShadow: "none",
      "&:hover": { background: THEME.surface1, color: THEME.text },
      "&:focus": { boxShadow: `0 0 0 2px ${THEME.brandDim}` },
    },
  },
  signIn: { elements: formCard },
  signUp: {
    elements: {
      ...formCard,
      // First/last name are optional in Clerk; asking for them only slows sign-up.
      formFieldRow__name: { display: "none" },
      socialButtonsBlockButton__github: { display: "none" },
    },
  },
};
