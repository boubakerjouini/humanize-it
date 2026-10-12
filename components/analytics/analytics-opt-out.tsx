"use client";

// ===========================================================
// components/analytics/analytics-opt-out.tsx — The /cookies control that
// refuses (or allows again) everything non-essential on this browser: Google
// Analytics, PostHog, and the attribution cookies hz_ft and hz_lt. The choice
// is one localStorage key that the analytics tools and the attribution
// cookies all read (lib/analytics/consent.ts).
// ===========================================================

import { useSyncExternalStore } from "react";
import posthog from "posthog-js";
import { clearAttributionCookies } from "@/components/growth/attribution-capture";
import { ANALYTICS_CHOICE_EVENT, analyticsMode } from "@/lib/analytics/consent";
import {
  clearGoogleAnalyticsCookies,
  readAnalyticsSignals,
  setGoogleAnalyticsDisabled,
  setTrackingRefused,
} from "@/lib/analytics/browser";
import { THEME } from "@/lib/theme";

type Choice = "refused" | "limited" | "internal" | "allowed";

function readChoice(): Choice {
  const signals = readAnalyticsSignals();
  if (signals.refused) return "refused";
  const mode = analyticsMode(signals);
  return mode === "off" ? "internal" : mode === "restricted" ? "limited" : "allowed";
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(ANALYTICS_CHOICE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(ANALYTICS_CHOICE_EVENT, onChange);
  };
}

const STATUS: Record<Choice, string> = {
  refused:
    "Refused on this browser: Google Analytics and PostHog report nothing from it, and hz_ft and hz_lt are deleted.",
  limited:
    "Already limited on this device because of its time zone or your browser's Global Privacy Control signal: no Google Analytics, nothing stored by PostHog, no attribution cookies. Refusing here also turns PostHog off, and keeps it all off if that changes.",
  internal: "This browser is marked as one of our own devices, so nothing is reported from it.",
  allowed: "",
};

function refuse(wasFull: boolean) {
  if (!setTrackingRefused(true)) return;
  // Stop what already runs on this page before deleting what it stored.
  setGoogleAnalyticsDisabled(process.env.NEXT_PUBLIC_GA_ID, true);
  if (posthog.__loaded && posthog.config.cookieless_mode !== "always") posthog.opt_out_capturing();
  clearGoogleAnalyticsCookies();
  clearAttributionCookies();
  // PostHog already drops every event (its before_send checks the refusal).
  // Google Analytics only goes away on a fresh load, where PostHog no longer
  // starts and what it kept on the device is deleted.
  if (wasFull) window.location.reload();
}

export function AnalyticsOptOut() {
  // null on the server: the choice is per browser, so the control renders after hydration.
  const choice = useSyncExternalStore<Choice | null>(subscribe, readChoice, () => null);

  if (choice === null) return null;
  const refused = choice === "refused";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", marginTop: "12px" }}>
      <button
        type="button"
        onClick={() => (refused ? setTrackingRefused(false) : refuse(choice === "allowed"))}
        style={{
          fontSize: "14px",
          fontWeight: 600,
          padding: "8px 16px",
          borderRadius: THEME.radius,
          cursor: "pointer",
          border: `1px solid ${THEME.border}`,
          background: THEME.surface2,
          color: THEME.text,
          fontFamily: THEME.fontSans,
        }}
      >
        {refused ? "Allow analytics and attribution again" : "Refuse analytics and attribution"}
      </button>
      <span role="status" style={{ fontSize: "13px", color: THEME.textMuted }}>
        {STATUS[choice]}
      </span>
    </div>
  );
}
