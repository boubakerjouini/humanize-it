import posthog from "posthog-js";
import { scrubEvent } from "@/lib/url-scrub";
import { isReportable } from "@/lib/analytics/consent";
import { clearPostHogStorage, currentAnalyticsMode, isInternalDevice, isTrackingRefused } from "@/lib/analytics/browser";

// Next.js runs this file before the app hydrates, so PostHog is ready for the
// first pageview of every load. It used to be initialised in a component
// effect, which ran after PostHogPageview's effect and silently dropped that
// pageview (only in-app navigations were ever recorded).
const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
// Only the real site reports: local dev, `next start` and Vercel previews all
// carry the production key, and their traffic was most of the project's data.
const isProductionHost = /(^|\.)humanizeit\.app$/.test(window.location.hostname);
// One decision for every analytics tool (lib/analytics/consent.ts): visitors in
// a consent region (EU, EEA, UK, CH or an unknown time zone) or with Global
// Privacy Control get cookieless mode: nothing stored on the device, no person
// profile, never identified (app/providers.tsx), so no consent banner is
// needed. A refusal on /cookies, like our own devices, gets no PostHog at all.
const mode = currentAnalyticsMode();

// Only full mode keeps anything on the device: otherwise drop what an earlier
// visit stored, so it can't carry an id into this one.
if (key && isProductionHost && mode !== "full") clearPostHogStorage();

if (key && isProductionHost && mode !== "off") {
  const cookieless = mode === "restricted";
  posthog.init(key, {
    // Proxy through our domain — avoids adblockers
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "/ingest",
    ui_host: "https://eu.posthog.com",
    capture_pageview: false, // PostHogPageview captures every App Router navigation
    capture_pageleave: true,
    persistence: "localStorage",
    ...(cookieless ? { cookieless_mode: "always" as const, person_profiles: "never" as const } : {}),
    autocapture: false, // Opt-in only — GDPR friendly
    before_send: (event) => {
      if (!event) return event;
      // /admin pages are never reported, and nothing is once this browser
      // refuses on /cookies or is marked as ours during the visit, in this tab
      // or another one (opt-outs don't apply in cookieless mode, so check here).
      const path = event.properties?.$pathname;
      const pathname = typeof path === "string" ? path : window.location.pathname;
      if (isTrackingRefused() || !isReportable({ pathname, internal: isInternalDevice() })) return null;
      // Email links carry a signed token in ?t= ($current_url, $referrer,
      // page-leave events): strip it from every event before it leaves.
      return scrubEvent(event);
    },
  });
}
