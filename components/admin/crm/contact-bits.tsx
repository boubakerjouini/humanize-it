// ===========================================================
// components/admin/crm/contact-bits.tsx — Small contact pieces shared by the
// contacts list, the pipeline cards, the tasks list and the 360 page: avatar,
// type badge, display name, the activity timeline list and a spinner. No hooks,
// so server and client pages can both render them.
// ===========================================================

import Link from "next/link";
import type { CSSProperties } from "react";
import { Loader2 } from "lucide-react";
import { THEME } from "@/lib/theme";
import { Pill, fmtDateTime, fmtRelative } from "@/components/admin/crm-ui";

export type ContactLike = { id: string; name: string | null; email: string | null; handle?: string | null; company?: string | null };

export function contactLabel(c: ContactLike): string {
  return c.name?.trim() || c.email || c.handle || c.company || "Unnamed contact";
}

export function ContactAvatar({ c, size = 30 }: { c: ContactLike; size?: number }) {
  const ch = (contactLabel(c)[0] ?? "?").toUpperCase();
  return (
    <div
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        flexShrink: 0,
        background: THEME.brandDim,
        color: THEME.brandHi,
        display: "grid",
        placeItems: "center",
        fontSize: Math.round(size * 0.43),
        fontWeight: 700,
      }}
    >
      {ch}
    </div>
  );
}

const TYPE_COLORS = { user: THEME.brand, lead: "#2563eb", prospect: "#64748b" } as const;
const TYPE_LABELS = { user: "Customer", lead: "Lead", prospect: "Prospect" } as const;

export function TypeBadge({ type }: { type: string }) {
  const known = type === "user" || type === "lead" || type === "prospect";
  return <Pill color={known ? TYPE_COLORS[type] : THEME.textMuted}>{known ? TYPE_LABELS[type] : type}</Pill>;
}

/** Avatar, linked name and a muted second line (email or company). */
export function ContactCell({ c, type, maxWidth = 260 }: { c: ContactLike; type?: string; maxWidth?: number }) {
  const label = contactLabel(c);
  const second = c.email && c.email !== label ? c.email : c.company || c.handle || null;
  const ellipsis: CSSProperties = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
      <ContactAvatar c={c} />
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Link href={`/admin/contacts/${c.id}`} style={{ ...ellipsis, color: THEME.text, fontWeight: 600, textDecoration: "none" }}>
            {label}
          </Link>
          {type ? <TypeBadge type={type} /> : null}
        </div>
        {second ? <div style={{ ...ellipsis, fontSize: 11, color: THEME.textMuted }}>{second}</div> : null}
      </div>
    </div>
  );
}

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div role="status" style={{ padding: 48, textAlign: "center", color: THEME.textDim, fontSize: 13 }}>
      <Loader2 size={18} aria-hidden="true" style={{ animation: "crm-spin 0.8s linear infinite", verticalAlign: "middle", marginRight: 8 }} />
      {label}
      <style>{`@keyframes crm-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export type TimelineEntry = {
  id: string;
  at: string | Date;
  kind: string;
  title: string;
  detail: string | null;
  actor: string | null;
};

const KIND_COLORS: Record<string, string> = {
  event: THEME.brand,
  email: "#2563eb",
  consent: THEME.human,
  note: THEME.accent,
  task: "#0d9488",
  audit: THEME.textMuted,
};

export function Timeline({ items, empty = "Nothing recorded yet." }: { items: TimelineEntry[]; empty?: string }) {
  if (items.length === 0) return <div style={{ fontSize: 13, color: THEME.textMuted, padding: "6px 0" }}>{empty}</div>;
  return (
    <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {items.map((t) => (
        <li key={t.id} style={{ display: "flex", gap: 10, padding: "9px 0", borderTop: `1px solid ${THEME.border}` }}>
          <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 999, marginTop: 5, flexShrink: 0, background: KIND_COLORS[t.kind] ?? THEME.textMuted }} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 13, color: THEME.text, overflowWrap: "anywhere" }}>{t.title}</div>
            {t.detail ? <div style={{ fontSize: 12, color: THEME.textDim, marginTop: 2, overflowWrap: "anywhere", whiteSpace: "pre-wrap" }}>{t.detail}</div> : null}
            <div style={{ fontSize: 11, color: THEME.textMuted, marginTop: 2 }}>
              <time dateTime={new Date(t.at).toISOString()} title={fmtDateTime(t.at)}>
                {fmtRelative(t.at)}
              </time>
              {" · "}
              {t.kind}
              {t.actor ? ` · ${t.actor}` : ""}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

const KEY_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  linkedin: "LinkedIn",
  dm: "DM",
  ai_assistant: "AI assistant",
  utm: "UTM",
};

/** "organic_search" → "Organic search", with brand and acronym casing kept. */
export const humanizeKey = (s: string | null | undefined) =>
  s ? (KEY_LABELS[s] ?? s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())) : "—";
