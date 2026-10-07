"use client";

// ===========================================================
// components/growth/attribution-opt-out.tsx — The /cookies control that
// refuses (or allows again) the hz_ft and hz_lt attribution cookies on this
// browser. The choice lives in localStorage, which AttributionCapture reads.
// ===========================================================

import { useSyncExternalStore } from "react";
import { clearAttributionCookies } from "@/components/growth/attribution-capture";
import { ATTRIBUTION_OPT_OUT_KEY } from "@/lib/growth/attribution";
import { THEME } from "@/lib/theme";

const CHANGE_EVENT = "hz-attr-optout-change";

function readRefused(): boolean {
  try {
    return window.localStorage.getItem(ATTRIBUTION_OPT_OUT_KEY) === "1";
  } catch {
    return false;
  }
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

export function AttributionOptOut() {
  // null on the server: the choice is per browser, so the control renders after hydration.
  const refused = useSyncExternalStore<boolean | null>(subscribe, readRefused, () => null);

  function toggle() {
    const next = !refused;
    try {
      if (next) window.localStorage.setItem(ATTRIBUTION_OPT_OUT_KEY, "1");
      else window.localStorage.removeItem(ATTRIBUTION_OPT_OUT_KEY);
    } catch {
      return;
    }
    if (next) clearAttributionCookies();
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }

  if (refused === null) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", marginTop: "12px" }}>
      <button
        type="button"
        onClick={toggle}
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
        {refused ? "Allow attribution cookies again" : "Refuse attribution cookies"}
      </button>
      <span role="status" style={{ fontSize: "13px", color: THEME.textMuted }}>
        {refused ? "Refused on this browser: hz_ft and hz_lt are deleted and won't be set again." : ""}
      </span>
    </div>
  );
}
