import posthog from "posthog-js";
import { scrubEvent } from "@/lib/url-scrub";

// Next.js runs this file before the app hydrates, so PostHog is ready for the
// first pageview of every load. It used to be initialised in a component
// effect, which ran after PostHogPageview's effect and silently dropped that
// pageview (only in-app navigations were ever recorded).
const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;

if (key) {
  posthog.init(key, {
    // Proxy through our domain — avoids adblockers
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "/ingest",
    ui_host: "https://eu.posthog.com",
    capture_pageview: false, // PostHogPageview captures every App Router navigation
    capture_pageleave: true,
    persistence: "localStorage",
    autocapture: false, // Opt-in only — GDPR friendly
    // Email links carry a signed token in ?t= ($current_url, $referrer,
    // page-leave events): strip it from every event before it leaves.
    before_send: (event) => (event ? scrubEvent(event) : event),
  });
}
