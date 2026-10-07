// ===========================================================
// lib/email/whats-new.ts — The "one big thing that changed" used by win-back
// emails. The founder edits this by hand when something worth a return visit
// ships; keep it true and specific (the default reflects the 2026-10-07
// release: free in-app checks, Voice Match, the 14-day guarantee).
// ===========================================================

export type WhatsNew = {
  headline: string;
  body: string;
  ctaLabel: string;
  /** Path on our site or an absolute URL. */
  ctaUrl: string;
};

export const WHATS_NEW: WhatsNew = {
  headline: "Checking your writing is now free",
  body: "Checks in your account no longer use your words; only rewrites count. Pro and Team also get Voice Match, which learns how you write from 2 or 3 samples, and every paid plan now has a 14-day refund guarantee, monthly or annual.",
  ctaLabel: "Check a page you wrote",
  ctaUrl: "/dashboard",
};
