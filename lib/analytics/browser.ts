// ===========================================================
// lib/analytics/browser.ts — Reads and clears this browser's analytics state
// for the decision in lib/analytics/consent.ts. Browser only. Every access is
// guarded: storage can throw (private mode, blocked site data), and analytics
// must never break a page.
// ===========================================================

import {
  ANALYTICS_CHOICE_EVENT,
  INTERNAL_DEVICE_KEY,
  TRACKING_OPT_OUT_KEY,
  analyticsMode,
  expireCookieEverywhere,
  googleAnalyticsCookieNames,
  isPostHogStorageKey,
  type AnalyticsMode,
  type AnalyticsSignals,
} from "@/lib/analytics/consent";

function readFlag(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function deviceTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  } catch {
    return null;
  }
}

export function readAnalyticsSignals(): AnalyticsSignals {
  let globalPrivacyControl = false;
  try {
    globalPrivacyControl = (window.navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true;
  } catch {
    // no navigator: no signal
  }
  return {
    timeZone: deviceTimeZone(),
    globalPrivacyControl,
    refused: readFlag(TRACKING_OPT_OUT_KEY),
    internal: readFlag(INTERNAL_DEVICE_KEY),
  };
}

/** The analytics mode for this page load (see lib/analytics/consent.ts). */
export function currentAnalyticsMode(): AnalyticsMode {
  return analyticsMode(readAnalyticsSignals());
}

export function isInternalDevice(): boolean {
  return readFlag(INTERNAL_DEVICE_KEY);
}

/** True once this browser refused on /cookies; local storage is shared, so every open tab sees it. */
export function isTrackingRefused(): boolean {
  return readFlag(TRACKING_OPT_OUT_KEY);
}

function notifyAnalyticsChoice(): void {
  try {
    window.dispatchEvent(new Event(ANALYTICS_CHOICE_EVENT));
  } catch {
    // nothing listens without window events
  }
}

/** Mark this browser as one of our own devices (from the admin area). */
export function markInternalDevice(): void {
  try {
    window.localStorage.setItem(INTERNAL_DEVICE_KEY, "1");
  } catch {
    return;
  }
  notifyAnalyticsChoice();
}

/** Save or clear the /cookies refusal. False when this browser won't store it. */
export function setTrackingRefused(refused: boolean): boolean {
  try {
    if (refused) window.localStorage.setItem(TRACKING_OPT_OUT_KEY, "1");
    else window.localStorage.removeItem(TRACKING_OPT_OUT_KEY);
  } catch {
    return false;
  }
  notifyAnalyticsChoice();
  return true;
}

/**
 * Google's documented opt-out flag: once gtag.js is on a page it can't be
 * unloaded, but it drops every later hit while window['ga-disable-<id>'] is true.
 */
export function setGoogleAnalyticsDisabled(measurementId: string | undefined, disabled: boolean): void {
  if (!measurementId) return;
  try {
    (window as unknown as Record<string, unknown>)[`ga-disable-${measurementId}`] = disabled;
  } catch {
    // best effort
  }
}

/** Delete the _ga and _ga_* cookies, best effort. */
export function clearGoogleAnalyticsCookies(): void {
  try {
    for (const name of googleAnalyticsCookieNames(window.document.cookie)) {
      for (const cookie of expireCookieEverywhere(name, window.location.hostname)) window.document.cookie = cookie;
    }
  } catch {
    // best effort
  }
}

/** Delete everything PostHog stored in local and session storage, best effort. */
export function clearPostHogStorage(): void {
  for (const pick of [() => window.localStorage, () => window.sessionStorage]) {
    try {
      const storage = pick();
      const keys: string[] = [];
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key && isPostHogStorageKey(key)) keys.push(key);
      }
      for (const key of keys) storage.removeItem(key);
    } catch {
      // storage blocked: nothing was stored there either
    }
  }
}
