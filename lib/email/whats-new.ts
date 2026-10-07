// ===========================================================
// lib/email/whats-new.ts — The "one big thing that changed" used by win-back
// emails. The founder edits this by hand when something worth a return visit
// ships; keep it true and specific (the default reflects commit 96d9c3d).
// ===========================================================

export type WhatsNew = {
  headline: string;
  body: string;
  ctaLabel: string;
  /** Path on our site or an absolute URL. */
  ctaUrl: string;
};

export const WHATS_NEW: WhatsNew = {
  headline: "Fewer false flags on formal writing",
  body: "We retuned the detector so careful, formal human writing is flagged less often, and the instant result is clearly labelled as an estimate.",
  ctaLabel: "Re-check a past text",
  ctaUrl: "/dashboard",
};
