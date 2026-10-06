"use client";

// ===========================================================
// components/growth/attribution-capture.tsx — Records where a visit came from
// (hz_ft first touch, hz_lt last touch) once per page load. Renders nothing.
// Visitors who send Global Privacy Control get no attribution cookies at all.
// ===========================================================

import { useEffect } from "react";
import {
  FIRST_TOUCH_COOKIE,
  FIRST_TOUCH_MAX_AGE_S,
  LAST_TOUCH_COOKIE,
  LAST_TOUCH_MAX_AGE_S,
  buildTouch,
  decodeTouch,
  encodeTouch,
  mergeLastTouch,
  readCookieValue,
  touchCookie,
} from "@/lib/growth/attribution";

export function AttributionCapture() {
  useEffect(() => {
    try {
      const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
      if (nav.globalPrivacyControl === true) return;

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
