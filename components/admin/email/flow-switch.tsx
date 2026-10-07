"use client";

// ===========================================================
// components/admin/email/flow-switch.tsx — The ON/OFF switch for a flow. It
// only asks: the parent opens a confirmation and flips the flow on confirm,
// so the switch shows the saved state, never an optimistic one.
// ===========================================================

import { THEME } from "@/lib/theme";

export function FlowSwitch({ on, label, onClick, disabled = false }: { on: boolean; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      style={{
        position: "relative",
        width: 40,
        height: 22,
        borderRadius: 999,
        border: `1px solid ${on ? THEME.brand : THEME.borderStrong}`,
        background: on ? THEME.brand : THEME.surface3,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        padding: 0,
        verticalAlign: "middle",
        transition: "background 120ms ease",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          top: 2,
          left: on ? 20 : 2,
          width: 16,
          height: 16,
          borderRadius: 999,
          background: "#fff",
          boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
          transition: "left 120ms ease",
        }}
      />
    </button>
  );
}
