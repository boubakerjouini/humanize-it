// ============================================================
// lib/theme.ts — Midnight Terminal design tokens (single source)
// Import this in inline-styled (style={{}}) components so colors,
// fonts and motion stay coherent instead of hardcoding hex.
// These mirror the CSS variables in app/globals.css.
// ============================================================

export const THEME = {
  // Canvas + surfaces
  bg: "#0a0b0e",
  surface1: "#101218", // nav, popovers, panels
  surface2: "#15181f", // cards
  surface3: "#1c2027", // raised / hover
  border: "#242a33",
  borderStrong: "#313845",

  // Text
  text: "#e8eaef",
  textDim: "#9aa1ad",
  textMuted: "#767e8b",

  // Brand (primary action / interactive)
  brand: "#7c5cff",
  brandHi: "#9a80ff",
  brandDim: "#1d1840",

  // Semantic score colors
  human: "#3ee08f", // green — human / good
  humanDim: "#102a1d",
  ai: "#ff5d5d", // red — AI / bad
  aiDim: "#321a1d",
  warn: "#f5b13d", // amber — mid
  warnDim: "#322512",

  // Fonts (resolved via next/font CSS vars set in layout.tsx)
  fontHeading: "var(--font-heading)",
  fontSans: "var(--font-sans)",
  fontMono: "var(--font-mono)",

  radius: "10px",
  radiusLg: "14px",
  radiusXl: "20px",
} as const;

/**
 * The detection engine returns an AI-LIKELIHOOD score (0 = human, 100 = AI).
 * Everywhere in the UI we present a HUMAN SCORE so green=high is intuitive.
 */
export function humanScore(aiLikelihood: number): number {
  return Math.round(Math.max(0, Math.min(100, 100 - aiLikelihood)));
}

/** Color for a HUMAN score (0–100, higher = more human = greener). */
export function humanScoreColor(human: number): string {
  if (human >= 70) return THEME.human;
  if (human >= 45) return THEME.warn;
  return THEME.ai;
}

/** Short label for a HUMAN score. */
export function humanScoreLabel(human: number): string {
  if (human >= 85) return "Reads human";
  if (human >= 70) return "Mostly human";
  if (human >= 45) return "Mixed signals";
  if (human >= 25) return "Likely AI";
  return "Very likely AI";
}

/** Glow shadow for a given accent hex. */
export function glow(hex: string, strength = 0.45): string {
  return `0 0 22px ${hex}${Math.round(strength * 255).toString(16).padStart(2, "0")}`;
}
