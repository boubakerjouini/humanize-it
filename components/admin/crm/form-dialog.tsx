"use client";

// ===========================================================
// components/admin/crm/form-dialog.tsx — A modal form on the native <dialog>
// (showModal: focus trap, Escape and the top layer come from the browser),
// matching ConfirmDialog's look. The parent owns `open` and closes it after a
// successful submit; while busy, Escape is refused so a request isn't orphaned.
// Also exports the field styles shared by the CRM forms.
// ===========================================================

import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { THEME } from "@/lib/theme";
import { disabledStyle, ghostBtn, primaryBtn } from "@/components/admin/crm-ui";

export const inputStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "8px 11px",
  borderRadius: 8,
  border: `1px solid ${THEME.border}`,
  background: THEME.surface2,
  color: THEME.text,
  fontSize: 13,
  fontFamily: THEME.fontSans,
  outline: "none",
};

export const selectStyle: CSSProperties = { ...inputStyle, width: "auto", cursor: "pointer", background: THEME.surface1, padding: "7px 9px" };

export function FormField({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0 }}>
      <label htmlFor={htmlFor} style={{ fontSize: 12, fontWeight: 600, color: THEME.textDim }}>
        {label}
      </label>
      {children}
      {hint ? <div style={{ fontSize: 11, color: THEME.textMuted }}>{hint}</div> : null}
    </div>
  );
}

export function FormDialog({
  open,
  title,
  description,
  submitLabel,
  submitDisabled = false,
  width = 480,
  onSubmit,
  onClose,
  children,
}: {
  open: boolean;
  title: ReactNode;
  description?: ReactNode;
  submitLabel: string;
  submitDisabled?: boolean;
  width?: number;
  /** May be async; the dialog shows a busy state until it settles. */
  onSubmit: () => void | Promise<void>;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setBusy(false);
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const disabled = busy || submitDisabled;

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        if (busy) e.preventDefault();
      }}
      onClose={() => {
        if (open) onClose();
      }}
      style={{
        width: `min(${width}px, calc(100vw - 32px))`,
        maxHeight: "calc(100vh - 48px)",
        // Tailwind's preflight zeroes margins, which removes the UA centering of a modal dialog.
        margin: "auto",
        padding: 0,
        border: `1px solid ${THEME.border}`,
        borderRadius: THEME.radiusLg,
        background: THEME.surface2,
        color: THEME.text,
        boxShadow: "0 24px 60px rgba(29, 23, 38, 0.18)",
      }}
    >
      {open ? (
        <form
          method="dialog"
          onSubmit={async (e) => {
            e.preventDefault();
            if (disabled) return;
            setBusy(true);
            try {
              await onSubmit();
            } finally {
              setBusy(false);
            }
          }}
          style={{ padding: 22, fontFamily: THEME.fontSans }}
        >
          <h2 id={titleId} style={{ fontSize: 16, fontWeight: 700, fontFamily: THEME.fontHeading, margin: 0 }}>
            {title}
          </h2>
          {description ? <div style={{ fontSize: 13, lineHeight: 1.5, color: THEME.textDim, marginTop: 6 }}>{description}</div> : null}
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 16 }}>{children}</div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
            <button type="button" onClick={onClose} disabled={busy} style={disabledStyle(ghostBtn, busy)}>
              Cancel
            </button>
            <button type="submit" disabled={disabled} style={disabledStyle(primaryBtn, disabled)}>
              {busy ? <Loader2 size={14} aria-hidden="true" style={{ animation: "crm-spin 0.8s linear infinite" }} /> : null}
              {submitLabel}
            </button>
          </div>
          <style>{`@keyframes crm-spin { to { transform: rotate(360deg); } } dialog::backdrop { background: rgba(29, 23, 38, 0.35); }`}</style>
        </form>
      ) : null}
    </dialog>
  );
}

/** POST/PATCH/DELETE JSON to an admin route; returns the parsed body or throws with the API's message. */
export async function sendJson<T = unknown>(url: string, method: "POST" | "PATCH" | "DELETE", body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
  if (!res.ok) throw new Error(data.error?.message ?? `Request failed (${res.status}).`);
  return data as T;
}
