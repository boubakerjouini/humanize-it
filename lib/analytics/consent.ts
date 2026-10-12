// ===========================================================
// lib/analytics/consent.ts — One decision for every analytics tool on the site
// (pure; lib/analytics/browser.ts reads its inputs from the device).
//
// The site has no consent banner, so, as with the attribution cookies, nothing
// that needs opt-in consent is stored on a device. A visitor is "restricted"
// when:
//   - the device time zone is in the EU, EEA, UK or Switzerland, or unknown, or
//   - the browser sends Global Privacy Control.
// Restricted visitors get no Google Analytics, and PostHog in cookieless mode
// (nothing stored on the device, never identified). A refusal on /cookies (the
// same choice refuses the attribution cookies) turns Google Analytics and
// PostHog off on that browser. Our own devices, marked from the admin area,
// report nothing, and /admin pages are never reported.
// ===========================================================

import { ATTRIBUTION_OPT_OUT_KEY, isConsentRegionTimeZone } from "@/lib/growth/attribution";

/**
 * localStorage key of the /cookies refusal ("1"). It is the attribution
 * opt-out key, which components/growth/attribution-capture.tsx already reads,
 * so one choice covers analytics and attribution, and earlier refusals carry over.
 */
export const TRACKING_OPT_OUT_KEY = ATTRIBUTION_OPT_OUT_KEY;

/** localStorage key ("1") that marks one of our own devices; set on /admin pages. */
export const INTERNAL_DEVICE_KEY = "hz_internal";

/** Window event fired after this page changes the refusal or the internal mark. */
export const ANALYTICS_CHOICE_EVENT = "hz-analytics-choice";

export type AnalyticsSignals = {
  /** IANA time zone of the device; null when it can't be read */
  timeZone: string | null;
  /** navigator.globalPrivacyControl */
  globalPrivacyControl: boolean;
  /** refused on /cookies */
  refused: boolean;
  /** one of our own devices */
  internal: boolean;
};

/**
 * off         one of our own devices, or a refusal on /cookies: no Google
 *             Analytics and no PostHog
 * restricted  no Google Analytics; PostHog cookieless and never identified
 * full        Google Analytics cookies, PostHog with local storage
 * Vercel Web Analytics is cookieless: it runs in every mode, except on our own
 * devices (isReportable).
 */
export type AnalyticsMode = "off" | "restricted" | "full";

export function analyticsMode(signals: AnalyticsSignals): AnalyticsMode {
  if (signals.internal || signals.refused) return "off";
  if (signals.globalPrivacyControl || isConsentRegionTimeZone(signals.timeZone)) return "restricted";
  return "full";
}

/** True for /admin and every page under it. */
export function isAdminPath(pathname: string | null | undefined): boolean {
  return !!pathname && /^\/admin(?:\/|$)/.test(pathname);
}

/** Path of an absolute or root-relative URL; null when it can't be parsed. */
export function urlPathname(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url, "http://relative.invalid").pathname;
  } catch {
    return null;
  }
}

/** Should an analytics event from this page and device be reported at all? */
export function isReportable(input: { pathname: string | null | undefined; internal: boolean }): boolean {
  return !input.internal && !isAdminPath(input.pathname);
}

/** Names of the Google Analytics cookies (_ga, _ga_<container>) in a document.cookie string. */
export function googleAnalyticsCookieNames(cookieHeader: string | null | undefined): string[] {
  if (!cookieHeader) return [];
  const names = new Set<string>();
  for (const part of cookieHeader.split(";")) {
    const name = part.split("=", 1)[0].trim();
    if (name === "_ga" || name.startsWith("_ga_")) names.add(name);
  }
  return [...names];
}

/**
 * document.cookie strings that delete a cookie whichever domain set it: the
 * host itself (no Domain attribute) and each parent domain, since Google
 * Analytics sets its cookies on the top domain (.humanizeit.app). Browsers
 * ignore a deletion that can't apply, such as one for a public suffix.
 */
export function expireCookieEverywhere(name: string, hostname: string): string[] {
  const out = [`${name}=; Max-Age=0; Path=/`];
  if (/^[\d.]+$/.test(hostname) || hostname.includes(":")) return out; // IP address
  const labels = hostname.split(".").filter(Boolean);
  for (let i = 0; i < labels.length - 1; i++) {
    out.push(`${name}=; Max-Age=0; Path=/; Domain=${labels.slice(i).join(".")}`);
  }
  return out;
}

/** PostHog's own browser-storage keys: ph_<project key>_* and its consent flag. */
export function isPostHogStorageKey(key: string): boolean {
  return key.startsWith("ph_") || key.startsWith("__ph_opt_in_out_");
}
