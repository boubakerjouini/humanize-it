// ===========================================================
// components/admin/crm-ui.tsx — Presentational building blocks for the CRM
// and email admin pages, in the existing admin look (inline styles, THEME
// tokens, surface2 cards, 11px uppercase table headers). No hooks and no
// "use client", so server pages and client pages can both use them.
// ===========================================================

import type { CSSProperties, ReactNode } from "react";
import { Pin } from "lucide-react";
import { THEME } from "@/lib/theme";
import { STAGE_COLORS, STAGE_LABELS, isStage } from "@/lib/crm/lifecycle";
import { GRADE_COLORS, gradeFor, type ScoreGrade } from "@/lib/crm/scoring";
import { TOPIC_LABELS, isTopic } from "@/lib/growth/constants";

// ── Layout ──────────────────────────────────────────────────────────────────

export function PageHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
      <div style={{ minWidth: 0 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: THEME.text, fontFamily: THEME.fontHeading, letterSpacing: "-0.02em", margin: 0 }}>
          {title}
        </h1>
        {description ? <p style={{ fontSize: 14, color: THEME.textDim, margin: "4px 0 0" }}>{description}</p> : null}
      </div>
      {actions ? <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>{actions}</div> : null}
    </div>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ background: THEME.surface2, border: `1px solid ${THEME.border}`, borderRadius: THEME.radiusLg, ...style }}>
      {children}
    </div>
  );
}

/** A titled card section. `flush` drops the body padding (for tables). */
export function Panel({
  title,
  description,
  actions,
  children,
  flush = false,
  style,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  flush?: boolean;
  style?: CSSProperties;
}) {
  const hasHeader = title || description || actions;
  return (
    <Card style={{ overflow: "hidden", ...style }}>
      {hasHeader ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "14px 18px",
            borderBottom: `1px solid ${THEME.border}`,
          }}
        >
          <div style={{ minWidth: 0 }}>
            {title ? <h2 style={{ fontSize: 14, fontWeight: 700, color: THEME.text, fontFamily: THEME.fontHeading, margin: 0 }}>{title}</h2> : null}
            {description ? <p style={{ fontSize: 12, color: THEME.textMuted, margin: "2px 0 0" }}>{description}</p> : null}
          </div>
          {actions ? <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>{actions}</div> : null}
        </div>
      ) : null}
      <div style={flush ? undefined : { padding: 18 }}>{children}</div>
    </Card>
  );
}

/** Label above a value, for profile and detail grids. */
export function Field({ label, children, hint }: { label: ReactNode; children: ReactNode; hint?: ReactNode }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: THEME.textMuted, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, color: THEME.text, overflowWrap: "anywhere" }}>{children}</div>
      {hint ? <div style={{ fontSize: 11, color: THEME.textMuted, marginTop: 3 }}>{hint}</div> : null}
    </div>
  );
}

export function Row({
  children,
  gap = 8,
  wrap = true,
  align = "center",
  justify = "flex-start",
  style,
}: {
  children: ReactNode;
  gap?: number;
  wrap?: boolean;
  align?: CSSProperties["alignItems"];
  justify?: CSSProperties["justifyContent"];
  style?: CSSProperties;
}) {
  return <div style={{ display: "flex", alignItems: align, justifyContent: justify, gap, flexWrap: wrap ? "wrap" : "nowrap", ...style }}>{children}</div>;
}

export function Empty({ title, description, action }: { title: ReactNode; description?: ReactNode; action?: ReactNode }) {
  return (
    <div style={{ padding: "40px 20px", textAlign: "center" }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: THEME.textDim }}>{title}</div>
      {description ? <div style={{ fontSize: 13, color: THEME.textMuted, marginTop: 4 }}>{description}</div> : null}
      {action ? <div style={{ marginTop: 14 }}>{action}</div> : null}
    </div>
  );
}

// ── Chips and badges ────────────────────────────────────────────────────────

/** Small rounded label. `soft` (default) is a tinted background with colored text. */
export function Pill({
  children,
  color = THEME.textMuted,
  variant = "soft",
  title,
  dashed = false,
}: {
  children: ReactNode;
  color?: string;
  variant?: "soft" | "solid";
  title?: string;
  dashed?: boolean;
}) {
  const solid = variant === "solid";
  return (
    <span
      title={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 11,
        fontWeight: 600,
        lineHeight: "16px",
        padding: "2px 8px",
        borderRadius: 999,
        whiteSpace: "nowrap",
        color: solid ? "#fff" : color,
        background: solid ? color : `${color}14`,
        border: `1px ${dashed ? "dashed" : "solid"} ${solid ? color : `${color}40`}`,
      }}
    >
      {children}
    </span>
  );
}

export function StagePill({ stage, overridden = false }: { stage: string; overridden?: boolean }) {
  const known = isStage(stage);
  const color = known ? STAGE_COLORS[stage] : THEME.textMuted;
  return (
    <Pill color={color} title={overridden ? "Set by an admin (override)" : undefined}>
      {overridden ? <Pin size={10} aria-label="Overridden" /> : null}
      {known ? STAGE_LABELS[stage] : stage}
    </Pill>
  );
}

/** Score with its grade color (hot ≥ 60, warm ≥ 30, cold). */
export function ScoreBadge({ score, grade }: { score: number; grade?: ScoreGrade }) {
  const g = grade ?? gradeFor(score);
  const color = GRADE_COLORS[g];
  return (
    <span
      className="tnum"
      title={`${g} lead`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: 12,
        fontWeight: 700,
        color,
        padding: "2px 8px",
        borderRadius: 999,
        background: `${color}14`,
        border: `1px solid ${color}40`,
      }}
    >
      {score}
      <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{g}</span>
    </span>
  );
}

/** Subscribed topics as chips; pending (unconfirmed) ones are dashed. */
export function TopicChips({ topics, pending = [] }: { topics: readonly string[]; pending?: readonly string[] }) {
  const items = [...topics.map((t) => ({ t, pending: false })), ...pending.filter((t) => !topics.includes(t)).map((t) => ({ t, pending: true }))];
  if (items.length === 0) return <span style={{ fontSize: 12, color: THEME.textMuted }}>None</span>;
  return (
    <span style={{ display: "inline-flex", gap: 4, flexWrap: "wrap" }}>
      {items.map(({ t, pending: isPending }) => (
        <Pill key={t} color={THEME.brand} dashed={isPending} title={isPending ? "Waiting for double opt-in" : undefined}>
          {isTopic(t) ? TOPIC_LABELS[t] : t}
          {isPending ? " (pending)" : ""}
        </Pill>
      ))}
    </span>
  );
}

const STATUS_COLORS: Record<string, string> = {
  // Contact email status
  ok: THEME.human,
  invalid: THEME.warn,
  bounced: THEME.ai,
  complained: "#be123c",
  // Email message status
  queued: "#2563eb",
  sending: "#2563eb",
  sent: THEME.human,
  delivered: THEME.human,
  failed: THEME.ai,
  suppressed: THEME.ai,
  skipped: THEME.textMuted,
  cancelled: THEME.textMuted,
};

/** Email status (a contact's deliverability, or a message's delivery state). */
export function StatusChip({ status }: { status: string }) {
  return <Pill color={STATUS_COLORS[status] ?? THEME.textMuted}>{status.replace(/_/g, " ")}</Pill>;
}

// ── Tables and buttons ──────────────────────────────────────────────────────

export const tableStyles = {
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: {
    textAlign: "left",
    padding: "10px 14px",
    fontSize: 11,
    fontWeight: 600,
    color: THEME.textMuted,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    background: THEME.surface1,
    borderBottom: `1px solid ${THEME.border}`,
    whiteSpace: "nowrap",
  },
  td: { padding: "12px 14px", color: THEME.textDim, verticalAlign: "middle" },
  tr: { borderBottom: `1px solid ${THEME.border}` },
} satisfies Record<string, CSSProperties>;

const buttonBase: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  padding: "8px 14px",
  borderRadius: 9,
  fontSize: 13,
  fontWeight: 600,
  lineHeight: "18px",
  cursor: "pointer",
  textDecoration: "none",
  whiteSpace: "nowrap",
};

export const primaryBtn: CSSProperties = { ...buttonBase, border: "none", background: THEME.brand, color: "#fff" };
export const ghostBtn: CSSProperties = { ...buttonBase, border: `1px solid ${THEME.border}`, background: THEME.surface2, color: THEME.textDim };
export const dangerBtn: CSSProperties = { ...buttonBase, border: `1px solid ${THEME.ai}44`, background: THEME.surface2, color: THEME.ai };

/** A button style dimmed and inert-looking while disabled or busy. */
export function disabledStyle(style: CSSProperties, disabled: boolean): CSSProperties {
  return disabled ? { ...style, opacity: 0.55, cursor: "not-allowed" } : style;
}

// ── Formatting ──────────────────────────────────────────────────────────────

type DateInput = Date | string | number | null | undefined;

function toDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "Oct 6, 2026" (UTC, so server and client render the same text). */
export function fmtDate(value: DateInput): string {
  const d = toDate(value);
  return d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "—";
}

/** "Oct 6, 2026, 08:00 UTC". */
export function fmtDateTime(value: DateInput): string {
  const d = toDate(value);
  if (!d) return "—";
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
  return `${date}, ${time} UTC`;
}

/** "3d ago", "just now", or "in 2h" for future dates. */
export function fmtRelative(value: DateInput, now: Date = new Date()): string {
  const d = toDate(value);
  if (!d) return "—";
  const diff = now.getTime() - d.getTime();
  const future = diff < 0;
  const m = Math.floor(Math.abs(diff) / 60000);
  const h = Math.floor(m / 60);
  const days = Math.floor(h / 24);
  const span = days > 0 ? `${days}d` : h > 0 ? `${h}h` : m > 0 ? `${m}m` : null;
  if (!span) return "just now";
  return future ? `in ${span}` : `${span} ago`;
}
