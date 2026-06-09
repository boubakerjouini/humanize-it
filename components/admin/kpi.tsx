// Presentational building blocks for the admin dashboard (server components —
// pure SVG/markup, no client JS, no chart dependency). Used across the admin
// overview, revenue, growth and redemptions pages.
import type { ComponentType } from "react";
import { THEME } from "@/lib/theme";
import type { DayPoint } from "@/lib/admin-metrics";

export function SectionTitle({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div style={{ marginBottom: 14, marginTop: 28 }}>
      <h2 style={{ fontSize: 14, fontWeight: 700, color: THEME.text, fontFamily: THEME.fontHeading, letterSpacing: "-0.01em", margin: 0 }}>{children}</h2>
      {sub && <p style={{ fontSize: 12, color: THEME.textMuted, margin: "3px 0 0" }}>{sub}</p>}
    </div>
  );
}

export function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon?: ComponentType<{ size?: number; color?: string; "aria-hidden"?: boolean }>;
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  const color = accent ?? THEME.brand;
  return (
    <div style={{ background: THEME.surface2, border: `1px solid ${THEME.border}`, borderRadius: THEME.radiusLg, padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        {Icon && <Icon size={15} color={color} aria-hidden={true} />}
        <span style={{ fontSize: 12, color: THEME.textDim, fontWeight: 600 }}>{label}</span>
      </div>
      <div className="tnum" style={{ fontSize: 27, fontWeight: 700, color: THEME.text, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: THEME.textMuted, marginTop: 6, lineHeight: 1.4 }}>{sub}</div>}
    </div>
  );
}

/** Tiny inline-SVG sparkline from a numeric series. */
export function Sparkline({ data, color, width = 240, height = 44 }: { data: number[]; color?: string; width?: number; height?: number }) {
  const c = color ?? THEME.brand;
  if (data.length === 0) return null;
  const max = Math.max(1, ...data);
  const step = data.length > 1 ? width / (data.length - 1) : width;
  const pts = data.map((v, i) => `${(i * step).toFixed(1)},${(height - (v / max) * (height - 4) - 2).toFixed(1)}`).join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block" }} aria-hidden="true">
      <polyline points={pts} fill="none" stroke={c} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/** Daily bar chart from a DayPoint[] series with native title tooltips. */
export function BarSeries({ data, color, height = 120 }: { data: DayPoint[]; color?: string; height?: number }) {
  const c = color ?? THEME.brand;
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height, width: "100%" }}>
      {data.map((d) => (
        <div
          key={d.day}
          title={`${d.day}: ${d.count}`}
          style={{
            flex: 1,
            height: `${Math.max(2, (d.count / max) * 100)}%`,
            background: d.count > 0 ? c : THEME.surface3,
            borderRadius: 2,
            minWidth: 2,
          }}
        />
      ))}
    </div>
  );
}
