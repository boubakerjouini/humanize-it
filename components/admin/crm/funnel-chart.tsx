// ===========================================================
// components/admin/crm/funnel-chart.tsx — Horizontal funnel bars (plain
// markup, no hooks, server-safe): one bar per step scaled to the largest step, with the
// step-to-step conversion between rows. The numbers are also in the bar
// labels, so the chart reads without color.
// ===========================================================

import { THEME } from "@/lib/theme";

export type FunnelStep = { label: string; value: number; hint?: string };

function pct(n: number, d: number): string {
  if (d <= 0) return "—";
  const p = (n / d) * 100;
  return `${p >= 10 || p === 0 ? Math.round(p) : p.toFixed(1)}%`;
}

export function FunnelChart({ steps, color = THEME.brand }: { steps: FunnelStep[]; color?: string }) {
  const max = Math.max(1, ...steps.map((s) => s.value));
  return (
    <ol aria-label="Funnel" style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 4 }}>
      {steps.map((s, i) => {
        const width = Math.max(2, (s.value / max) * 100);
        const prev = i > 0 ? steps[i - 1].value : null;
        return (
          <li key={s.label}>
            {prev !== null ? (
              <div style={{ fontSize: 11, color: THEME.textMuted, padding: "2px 0 4px 130px" }}>↓ {pct(s.value, prev)} of the step above</div>
            ) : null}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 120, flexShrink: 0, fontSize: 13, fontWeight: 600, color: THEME.text }} title={s.hint}>
                {s.label}
              </span>
              <div style={{ flex: 1, background: THEME.surface1, borderRadius: 6, height: 28, position: "relative" }}>
                <div style={{ width: `${width}%`, height: "100%", borderRadius: 6, background: color, opacity: 1 - i * 0.14 }} />
                <span className="tnum" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 13, fontWeight: 700, color: width > 12 ? "#fff" : THEME.text }}>
                  {s.value.toLocaleString()}
                </span>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
