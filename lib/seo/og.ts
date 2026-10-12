// ===========================================================
// lib/seo/og.ts — Share images for page metadata.
//
// Next merges metadata one top-level key at a time, so a page or layout that
// sets its own `openGraph` replaces the root one whole, images included. Every
// page-level openGraph must therefore either list `images: OG_IMAGES` or have
// an opengraph-image.tsx beside its page.tsx (that file is applied after the
// page's own metadata). lib/seo/__tests__/og.test.ts checks app/ for both.
// ===========================================================

/** The root share card (app/opengraph-image.tsx), for pages without their own. */
export const OG_IMAGES = [
  {
    url: "/opengraph-image",
    width: 1200,
    height: 630,
    alt: "HumanizeIt — AI Humanizer & AI Detector for Natural Writing",
  },
];
