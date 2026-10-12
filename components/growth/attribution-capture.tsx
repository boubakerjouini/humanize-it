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
// Under GPC or in those time zones the visit's touch is kept in memory only
// (nothing is stored on the device), so a lead form sent during the visit can
// still say how it arrived (readPageTouch). After a refusal nothing is kept.
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
  type Touch,
} from "@/lib/growth/attribution";

/** The landing touch of a visit that gets no cookie: module memory, gone on the next full page load. */
let pageTouch: Touch | null = null;

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

/**
 * The visit's in-memory touch, encoded like the cookie, for a lead form to send
 * (the server uses it only when no attribution cookie exists). Undefined when
 * the cookies carry the touch, or when the visitor refused attribution.
 */
export function readPageTouch(): string | undefined {
  if (!pageTouch || optedOut()) return undefined;
  try {
    return encodeTouch(pageTouch);
  } catch {
    return undefined;
  }
}

export function AttributionCapture() {
  useEffect(() => {
    try {
      if (optedOut()) {
        clearAttributionCookies();
        return;
      }

      const touch = buildTouch({ href: window.location.href, referrer: document.referrer, now: Date.now() });
      const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
      if (nav.globalPrivacyControl === true || isConsentRegionTimeZone(deviceTimeZone())) {
        clearAttributionCookies();
        // A remount mid-visit keeps the landing touch.
        if (!pageTouch) pageTouch = touch;
        return;
      }

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
