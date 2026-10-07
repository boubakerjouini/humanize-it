"use client";

// ===========================================================
// components/vercel-analytics.tsx — Vercel Web Analytics and Speed Insights
// with the signed ?t= token of email links stripped from every reported URL.
// (The beforeSend callbacks are functions, so they need a client component.)
// ===========================================================

import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { scrubUrl } from "@/lib/url-scrub";

export function VercelAnalytics() {
  return (
    <>
      <Analytics beforeSend={(event) => ({ ...event, url: scrubUrl(event.url) })} />
      <SpeedInsights beforeSend={(data) => ({ ...data, url: scrubUrl(data.url) })} />
    </>
  );
}
