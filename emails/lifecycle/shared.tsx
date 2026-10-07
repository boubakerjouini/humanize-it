// ===========================================================
// emails/lifecycle/shared.tsx — Facts and formatting shared by the lifecycle,
// marketing and admin templates (stream D).
//
// Every number an email quotes comes from lib/plans.ts, so a price or limit
// change can't leave an email promising the old one. Dates are formatted in
// UTC because the send time, not the reader's clock, decides "tomorrow".
// Pure: no DB, safe to import from any template.
// ===========================================================

import type { ReactNode } from "react";
import { PLANS } from "@/lib/plans";
import { BRAND, Button, Signature } from "@/emails/components/primitives";

const DAY_MS = 24 * 60 * 60 * 1000;

export const FREE_WORDS = PLANS.FREE.wordsLimit;
export const PRO_WORDS = PLANS.PRO.wordsLimit;
export const TEAM_WORDS = PLANS.TEAM.wordsLimit;
export const PRO_HISTORY_DAYS = PLANS.PRO.historyDays ?? 30;
/** /api/documents shows a Free account its newest 5 documents only. */
export const FREE_HISTORY_DOCS = 5;

export const PLAN_NAMES = { FREE: "Free", PRO: "Pro", TEAM: "Team" } as const;

/**
 * The refund promise, exactly as /refunds states it today (annual only). When
 * the 14-day guarantee is extended to every paid plan, change it here and in
 * /refunds in the same pull request.
 */
export const REFUND_LINE = "Annual plans come with a 14-day money-back guarantee, and monthly plans cancel any time.";

/** "$9" or "$6.58": whole dollars without decimals. */
export function usd(amount: number): string {
  return Number.isInteger(amount) ? `$${amount}` : `$${amount.toFixed(2)}`;
}

/** Annual price spread over 12 months: 79 → "$6.58". */
export function perMonth(annual: number): string {
  return usd(Math.round((annual / 12) * 100) / 100);
}

export function words(n: number): string {
  return n.toLocaleString("en-US");
}

/** "October 21, 2026" for an ISO date; the raw string when it doesn't parse. */
export function fmtDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/** Whole days from `from` until `value`, at least 1; null when the date doesn't parse. */
export function daysUntil(value: string, from: Date): number | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.max(1, Math.ceil((date.getTime() - from.getTime()) / DAY_MS));
}

/** "in 14 days", "tomorrow", or "on October 21, 2026" when the date is unusual. */
export function endsWhen(value: string, from: Date): string {
  const days = daysUntil(value, from);
  if (days === null) return `on ${fmtDate(value)}`;
  return days === 1 ? "tomorrow" : `in ${days} days`;
}

/** An ordered list styled like the Bullets primitive. */
export function Numbered({ items }: { items: ReactNode[] }) {
  return (
    <ol style={{ margin: "0 0 16px", paddingLeft: 22, color: BRAND.text }}>
      {items.map((item, i) => (
        <li key={i} style={{ fontSize: 15, lineHeight: "24px", margin: "0 0 6px" }}>
          {item}
        </li>
      ))}
    </ol>
  );
}

/** The single CTA followed by the founder's sign-off, the order every branded email uses. */
export function CtaAndSignature({ href, children }: { href: string; children: ReactNode }) {
  return (
    <>
      <Button href={href}>{children}</Button>
      <Signature />
    </>
  );
}
