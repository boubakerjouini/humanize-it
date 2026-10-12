"use client";

// ===========================================================
// components/analytics/vercel-analytics.tsx — Vercel Web Analytics and Speed
// Insights. Both are cookieless, so they run for every visitor, but Web
// Analytics drops page views from /admin and from our own devices
// (lib/analytics/consent.ts), and the signed ?t= token of email links is
// stripped from every reported URL.
// (The beforeSend callbacks are functions, so they need a client component.)
// ===========================================================

import { Analytics, type BeforeSendEvent } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { isReportable, urlPathname } from "@/lib/analytics/consent";
import { isInternalDevice } from "@/lib/analytics/browser";
import { scrubUrl } from "@/lib/url-scrub";

function beforeSendEvent(event: BeforeSendEvent): BeforeSendEvent | null {
  if (!isReportable({ pathname: urlPathname(event.url), internal: isInternalDevice() })) return null;
  return { ...event, url: scrubUrl(event.url) };
}

export function VercelAnalytics() {
  return (
    <>
      <Analytics beforeSend={beforeSendEvent} />
      <SpeedInsights beforeSend={(data) => ({ ...data, url: scrubUrl(data.url) })} />
    </>
  );
}
