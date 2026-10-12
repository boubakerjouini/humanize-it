"use client";

// ===========================================================
// components/analytics/google-analytics.tsx — Loads Google Analytics (gtag.js)
// only when the analytics decision (lib/analytics/consent.ts) is "full": never
// for restricted visitors (consent-region time zone, Global Privacy Control, a
// refusal on /cookies), never on our own devices and never on /admin pages.
// Restricted visitors get no gtag request and no _ga cookies, and _ga cookies
// set before these rules are deleted.
// ===========================================================

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { ANALYTICS_CHOICE_EVENT, isAdminPath } from "@/lib/analytics/consent";
import { clearGoogleAnalyticsCookies, currentAnalyticsMode, setGoogleAnalyticsDisabled } from "@/lib/analytics/browser";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(ANALYTICS_CHOICE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(ANALYTICS_CHOICE_EVENT, onChange);
  };
}

const isFullMode = () => currentAnalyticsMode() === "full";

export function GoogleAnalytics({ measurementId }: { measurementId: string }) {
  // false on the server: the time zone, GPC and the /cookies choice are only
  // known in the browser, so nothing Google-related is in the HTML.
  const allowed = useSyncExternalStore(subscribe, isFullMode, () => false);
  const onAdminPage = isAdminPath(usePathname());

  useEffect(() => {
    if (!isFullMode()) clearGoogleAnalyticsCookies();
  }, []);

  // Once loaded, gtag.js stays on the page: its opt-out flag stops it on /admin
  // and after this browser is marked as ours or refuses on /cookies.
  useEffect(() => {
    setGoogleAnalyticsDisabled(measurementId, !allowed || onAdminPage);
  }, [allowed, onAdminPage, measurementId]);

  if (!allowed || onAdminPage) return null;
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`} strategy="afterInteractive" />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('set', 'allow_google_signals', false); // no advertising features
          gtag('set', 'allow_ad_personalization_signals', false);
          var hzLoc = new URL(location.href);
          hzLoc.searchParams.delete('t'); // signed email-link token
          gtag('config', '${measurementId}', { page_location: hzLoc.toString() });
        `}
      </Script>
    </>
  );
}
