// ===========================================================
// components/admin/email/api.ts — Fetch helper and formatters shared by the
// email admin pages. Errors come back as a message ready for a toast, from the
// { error: { code, message } } envelope the admin routes return.
// ===========================================================

import { THEME } from "@/lib/theme";

export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; code: string | null; message: string };

export async function api<T>(url: string, init?: RequestInit & { json?: unknown }): Promise<ApiResult<T>> {
  const { json, ...rest } = init ?? {};
  try {
    const res = await fetch(url, {
      ...rest,
      headers: json !== undefined ? { "Content-Type": "application/json", ...(rest.headers ?? {}) } : rest.headers,
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
    const data = (await res.json().catch(() => null)) as (T & { error?: { code?: string; message?: string } }) | null;
    if (!res.ok) {
      return { ok: false, status: res.status, code: data?.error?.code ?? null, message: data?.error?.message ?? `Request failed (${res.status}).` };
    }
    return { ok: true, data: data as T };
  } catch {
    return { ok: false, status: 0, code: null, message: "Network error." };
  }
}

/** "12.5%" with one decimal, "—" when there is no denominator. */
export function pct(n: number, d: number, digits = 1): string {
  if (!d) return "—";
  return `${((n / d) * 100).toFixed(digits)}%`;
}

/** "+24h", "−14d", "at signup" for step offsets. */
export function fmtOffset(hours: number): string {
  if (hours === 0) return "right away";
  const sign = hours < 0 ? "−" : "+";
  const abs = Math.abs(hours);
  return abs % 24 === 0 ? `${sign}${abs / 24}d` : `${sign}${abs}h`;
}

export const SKIP_REASON_LABELS: Record<string, string> = {
  no_email: "no email",
  no_consent: "no consent",
  unverified: "unverified",
  suppressed: "suppressed",
  bad_status: "bounced/complained",
  lifecycle_off: "account emails off",
  not_user: "no account",
  no_postal_address: "no postal address",
  late: "too late",
  condition: "condition",
  trial_cap: "pass cap",
  contact_missing: "contact gone",
  not_allowlisted: "not allowlisted",
};

export const reasonLabel = (r: string) => SKIP_REASON_LABELS[r] ?? r.replace(/_/g, " ");

export const CAMPAIGN_STATUS_COLORS: Record<string, string> = {
  draft: THEME.textMuted,
  tested: "#2563eb",
  sending: THEME.warn,
  sent: THEME.human,
  cancelled: THEME.ai,
};
