// ============================================================
// lib/theme.ts — "Aurora" design tokens (single source)
// Light/white canvas · purple primary · orange accent.
// Import this in inline-styled (style={{}}) components so colors,
// fonts and motion stay coherent instead of hardcoding hex.
// These mirror the CSS variables in app/globals.css.
// ============================================================

export const THEME = {
  // Canvas + surfaces (light)
  bg: "#ffffff",        // page canvas
  surface1: "#f7f5fb",  // alt sections / nav / subtle panels (soft lavender)
  surface2: "#ffffff",  // cards (always paired with a border + soft shadow)
  surface3: "#f1ecf9",  // raised / hover tint
  border: "#e9e3f3",    // hairline (soft purple-gray)
  borderStrong: "#d8cdec",

  // Text
  text: "#1d1726",      // near-black with a faint purple undertone
  textDim: "#5b5470",   // secondary
  textMuted: "#8b8399", // tertiary

  // Brand — purple (primary action / interactive / brand)
  brand: "#7c3aed",
  brandHi: "#6d28d9",   // hover (darker on light)
  brandDim: "#f3eefe",  // light purple tint surface

  // Accent — orange (energy / secondary CTA / highlights)
  accent: "#f97316",
  accentHi: "#ea580c",  // hover
  accentDim: "#fff2e6", // light orange tint surface

  // Semantic score colors (readable on white)
  human: "#16a34a",     // green — human / good
  humanDim: "#e7f7ee",
  ai: "#e11d48",        // red/rose — AI / bad
  aiDim: "#fdebef",
  warn: "#f59e0b",      // amber — mid score
  warnDim: "#fef3e2",

  // Fonts (resolved via next/font CSS vars set in layout.tsx)
  fontHeading: "var(--font-heading)",
  fontSans: "var(--font-sans)",
  fontMono: "var(--font-mono)",

  radius: "12px",
  radiusLg: "16px",
  radiusXl: "24px",

  // Signature purple→orange gradient
  gradient: "linear-gradient(100deg, #7c3aed 0%, #a855f7 45%, #f97316 100%)",
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

/** Soft elevation shadow tinted toward an accent hex (for cards/CTAs on white). */
export function glow(hex: string, strength = 0.28): string {
  const a = Math.round(strength * 255).toString(16).padStart(2, "0");
  return `0 10px 30px -8px ${hex}${a}`;
}
