// ===========================================================
// components/workspace/usage-meter.tsx — "words left today / this month" in
// the app shell, from GET /api/usage. Two shapes: the sidebar card (desktop)
// and a compact chip for the phone top bar. At the limit both turn into a
// friendly "you're out until X" state whose button opens the upgrade modal.
// ===========================================================

"use client";

import { Sparkles } from "lucide-react";
import { THEME } from "@/lib/theme";
import { Skeleton } from "@/components/workspace/skeleton";
import { formatResetIn, summarizeUsage, usagePeriod, type UsageSnapshot } from "@/components/workspace/feedback";


const fmt = (n: number) => n.toLocaleString("en-US");

/** Sidebar card. `usage` null = still loading (shows a skeleton, not nothing). */
export function UsageMeter({ usage, onUpgrade }: { usage: UsageSnapshot | null; onUpgrade: () => void }) {
  if (!usage) {
    return (
      <div role="status" aria-label="Loading usage" style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <Skeleton width={110} height={10} />
          <Skeleton width={26} height={10} />
        </div>
        <Skeleton height={5} radius={999} />
      </div>
    );
  }

  const s = summarizeUsage(usage, usagePeriod(usage));
  const bonus = usage.bonusWords ?? 0;

  if (s.limitReached) {
    return (
      <div style={{ background: THEME.warnDim, border: `1px solid ${THEME.warn}55`, borderRadius: 10, padding: "10px 11px", display: "flex", flexDirection: "column", gap: 8 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: THEME.text }}>
            {s.period === "day" ? "You've used today's words" : "You've used this month's words"}
          </div>
          <div style={{ fontSize: 12, color: THEME.textDim, lineHeight: 1.45, marginTop: 2 }}>
            {s.resetsAt ? `${fmt(usage.wordsLimit)} more ${formatResetIn(s.resetsAt)}. ` : ""}Need more now? See your options.
          </div>
        </div>
        <button onClick={onUpgrade} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, background: THEME.surface2, color: THEME.brandHi, border: `1px solid ${THEME.brand}44`, borderRadius: 8, padding: "7px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: THEME.fontSans }}>
          <Sparkles size={13} aria-hidden="true" /> Get more words
        </button>
      </div>
    );
  }

  const barColor = s.low ? THEME.warn : THEME.brand;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, fontSize: 12, marginBottom: 6 }}>
        <span style={{ color: THEME.textDim }}>
          {s.unlimited ? "Unlimited words" : (
            <><strong className="tnum" style={{ color: THEME.text, fontWeight: 700 }}>{fmt(s.wordsLeft)}</strong>{` words left ${s.periodLabel}`}</>
          )}
        </span>
        {!s.unlimited && <span className="tnum" style={{ fontSize: 11, color: THEME.textMuted }}>{`${fmt(usage.wordsLimit)}`}</span>}
      </div>
      <div role="progressbar" aria-label={`Words used ${s.periodLabel}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={s.pct}
        style={{ height: 5, background: THEME.surface3, borderRadius: 999, overflow: "hidden" }}>
        <div style={{ height: 5, width: `${s.unlimited ? 0 : s.pct}%`, background: barColor, borderRadius: 999, transition: "width .4s ease" }} />
      </div>
      {bonus > 0 && (
        <div className="tnum" style={{ fontSize: 11, color: THEME.accentHi, fontWeight: 600, marginTop: 5 }}>
          {`+${fmt(bonus)} bonus words`}
        </div>
      )}
    </div>
  );
}

/** Phone top-bar chip: the balance at a glance; a button once the words run out. */
export function UsageChip({ usage, onUpgrade }: { usage: UsageSnapshot | null; onUpgrade: () => void }) {
  if (!usage) return <Skeleton width={84} height={22} radius={999} />;
  const s = summarizeUsage(usage, usagePeriod(usage));
  if (s.unlimited) return null;

  if (s.limitReached) {
    return (
      <button onClick={onUpgrade} style={{ ...chip, background: THEME.warnDim, borderColor: `${THEME.warn}66`, color: THEME.text, cursor: "pointer" }}>
        <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: 999, background: THEME.warn }} />
        Out of words
      </button>
    );
  }
  const left = s.wordsLeft + (usage.bonusWords ?? 0);
  return (
    <span className="tnum" style={chip} title={`${fmt(s.wordsLeft)} words left ${s.periodLabel}`}>
      <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: 999, background: s.low ? THEME.warn : THEME.human }} />
      {`${left >= 10000 ? `${Math.floor(left / 1000)}k` : fmt(left)} left`}
    </span>
  );
}

const chip: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6, height: 26, padding: "0 10px", borderRadius: 999,
  background: THEME.surface1, border: `1px solid ${THEME.border}`, fontSize: 12, fontWeight: 600, color: THEME.textDim,
  fontFamily: THEME.fontSans, whiteSpace: "nowrap",
};
