"use client";

// ===========================================================
// components/growth/attribution-capture.tsx — Records where a visit came from
// (hz_ft first touch, hz_lt last touch) once per page load. Renders nothing.
//
// They are non-essential cookies, so they are never set (and older ones are
// deleted) when the visitor:
//   - sends Global Privacy Control,
//   - refused them on /cookies (localStorage hz_attr_optout), or
//   - is in the EU, EEA, UK or Switzerland by device time zone, where they
//     would need opt-in consent and the site has no consent banner.
// ===========================================================

import { useEffect } from "react";
import {
  ATTRIBUTION_OPT_OUT_KEY,
  FIRST_TOUCH_COOKIE,
  FIRST_TOUCH_MAX_AGE_S,
  LAST_TOUCH_COOKIE,
  LAST_TOUCH_MAX_AGE_S,
  buildTouch,
  clearTouchCookie,
  decodeTouch,
  encodeTouch,
  isConsentRegionTimeZone,
  mergeLastTouch,
  readCookieValue,
  touchCookie,
} from "@/lib/growth/attribution";

function optedOut(): boolean {
  try {
    return window.localStorage.getItem(ATTRIBUTION_OPT_OUT_KEY) === "1";
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

/** Delete both attribution cookies (here, and from the /cookies opt-out). */
export function clearAttributionCookies(): void {
  const secure = window.location.protocol === "https:";
  for (const name of [FIRST_TOUCH_COOKIE, LAST_TOUCH_COOKIE]) {
    if (readCookieValue(document.cookie, name) !== undefined) document.cookie = clearTouchCookie(name, secure);
  }
}

export function AttributionCapture() {
  useEffect(() => {
    try {
      const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
      if (nav.globalPrivacyControl === true || optedOut() || isConsentRegionTimeZone(deviceTimeZone())) {
        clearAttributionCookies();
        return;
      }

      const touch = buildTouch({ href: window.location.href, referrer: document.referrer, now: Date.now() });
      const secure = window.location.protocol === "https:";

      if (!decodeTouch(readCookieValue(document.cookie, FIRST_TOUCH_COOKIE))) {
        document.cookie = touchCookie(FIRST_TOUCH_COOKIE, encodeTouch(touch), {
          maxAgeSeconds: FIRST_TOUCH_MAX_AGE_S,
          secure,
        });
      }

      const previous = decodeTouch(readCookieValue(document.cookie, LAST_TOUCH_COOKIE));
      const next = mergeLastTouch(previous, touch);
      if (next !== previous) {
        document.cookie = touchCookie(LAST_TOUCH_COOKIE, encodeTouch(next), {
          maxAgeSeconds: LAST_TOUCH_MAX_AGE_S,
          secure,
        });
      }
    } catch {
      // Attribution is best-effort; it must never break the page.
    }
  }, []);

  return null;
}
