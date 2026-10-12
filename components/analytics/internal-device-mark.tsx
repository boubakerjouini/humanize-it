"use client";

// ===========================================================
// components/analytics/internal-device-mark.tsx — Rendered by the admin layout
// after its admin check. Marks this browser as one of our own devices
// (localStorage hz_internal), so its visits never reach PostHog, Google
// Analytics or Vercel Web Analytics, on /admin or any public page. Clearing
// the site's data in the browser removes the mark. Renders nothing.
// ===========================================================

import { useEffect } from "react";
import posthog from "posthog-js";
import { markInternalDevice } from "@/lib/analytics/browser";

export function InternalDeviceMark() {
  useEffect(() => {
    markInternalDevice();
    // Stops PostHog for the rest of this visit; later page loads don't start
    // it at all (instrumentation-client.ts). Cookieless mode ignores opt-outs,
    // which is why its before_send also drops events from a marked device.
    if (posthog.__loaded && posthog.config.cookieless_mode !== "always") posthog.opt_out_capturing();
  }, []);

  return null;
}
