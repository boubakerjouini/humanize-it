"use client";

// ===========================================================
// components/admin/crm-dialogs.tsx — Interactive admin primitives.
//   ConfirmDialog  native <dialog> opened with showModal(): focus trap, Escape
//                  and top layer come from the browser. `requireText` makes
//                  the admin type a value (e.g. the recipient count) first.
//   Tabs           controlled tablist with arrow-key navigation.
//   Popover        a panel anchored under its trigger button. Fixed
//                  positioning from getBoundingClientRect (CSS anchor
//                  positioning isn't usable across browsers yet); closes on
//                  Escape, outside click, scroll and resize.
// ===========================================================

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Loader2 } from "lucide-react";
import { THEME } from "@/lib/theme";
import { dangerBtn, disabledStyle, ghostBtn, primaryBtn } from "@/components/admin/crm-ui";

// ── ConfirmDialog ───────────────────────────────────────────────────────────

export type ConfirmDialogProps = {
  open: boolean;
  title: ReactNode;
  body?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** The exact text the admin must type before confirming (e.g. "12" to send to 12 people). */
  requireText?: string;
  danger?: boolean;
  /** May be async; the dialog shows a busy state until it settles. The parent closes it. */
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
};

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel = "Cancel",
  requireText,
  danger = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const titleId = useId();
  const bodyId = useId();
  const inputId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setTyped("");
      setBusy(false);
      dialog.showModal();
      // Start where it is safest: the confirmation input, else Cancel.
      (requireText ? inputRef.current : cancelRef.current)?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open, requireText]);

  const matches = !requireText || typed.trim() === requireText;
  const canConfirm = matches && !busy;

  const confirm = useCallback(async () => {
    if (!canConfirm) return;
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  }, [canConfirm, onConfirm]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={body ? bodyId : undefined}
      // Escape closes the native dialog; keep the parent's state in sync (and refuse while busy).
      onCancel={(e) => {
        if (busy) e.preventDefault();
      }}
      onClose={() => {
        if (open) onClose();
      }}
      style={{
        width: "min(440px, calc(100vw - 32px))",
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
          onSubmit={(e) => {
            e.preventDefault();
            void confirm();
          }}
          style={{ padding: 22, fontFamily: THEME.fontSans }}
        >
          <h2 id={titleId} style={{ fontSize: 16, fontWeight: 700, fontFamily: THEME.fontHeading, margin: 0 }}>
            {title}
          </h2>
          {body ? (
            <div id={bodyId} style={{ fontSize: 13, lineHeight: 1.55, color: THEME.textDim, marginTop: 8 }}>
              {body}
            </div>
          ) : null}
          {requireText ? (
            <div style={{ marginTop: 16 }}>
              <label htmlFor={inputId} style={{ display: "block", fontSize: 12, fontWeight: 600, color: THEME.textDim, marginBottom: 6 }}>
                Type <strong style={{ color: THEME.text }}>{requireText}</strong> to confirm
              </label>
              <input
                ref={inputRef}
                id={inputId}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "9px 12px",
                  borderRadius: 9,
                  border: `1px solid ${matches && typed ? THEME.human : THEME.border}`,
                  background: THEME.surface2,
                  color: THEME.text,
                  fontSize: 14,
                }}
              />
            </div>
          ) : null}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
            <button ref={cancelRef} type="button" onClick={onClose} disabled={busy} style={disabledStyle(ghostBtn, busy)}>
              {cancelLabel}
            </button>
            <button type="submit" disabled={!canConfirm} style={disabledStyle(danger ? { ...dangerBtn, background: THEME.ai, color: "#fff", border: "none" } : primaryBtn, !canConfirm)}>
              {busy ? <Loader2 size={14} aria-hidden="true" style={{ animation: "crm-spin 0.8s linear infinite" }} /> : null}
              {confirmLabel}
            </button>
          </div>
          <style>{`@keyframes crm-spin { to { transform: rotate(360deg); } } dialog::backdrop { background: rgba(29, 23, 38, 0.35); }`}</style>
        </form>
      ) : null}
    </dialog>
  );
}

// ── Tabs ────────────────────────────────────────────────────────────────────

export type TabItem = { id: string; label: ReactNode; count?: number };

/** id of the panel a tab controls; render the panel with role="tabpanel" and this id. */
export function tabPanelId(idPrefix: string, tabId: string): string {
  return `${idPrefix}-panel-${tabId}`;
}

export function tabId(idPrefix: string, id: string): string {
  return `${idPrefix}-tab-${id}`;
}

export function Tabs({
  tabs,
  value,
  onChange,
  idPrefix,
  label,
}: {
  tabs: TabItem[];
  value: string;
  onChange: (id: string) => void;
  /** Prefix for tab and panel ids (see tabPanelId). */
  idPrefix: string;
  /** Accessible name of the tab list. */
  label: string;
}) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const index = tabs.findIndex((t) => t.id === value);
    if (index === -1) return;
    let next = index;
    if (e.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (e.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    else return;
    e.preventDefault();
    const id = tabs[next].id;
    onChange(id);
    refs.current[id]?.focus();
  };

  return (
    <div role="tablist" aria-label={label} onKeyDown={onKeyDown} style={{ display: "flex", gap: 4, borderBottom: `1px solid ${THEME.border}`, marginBottom: 16, overflowX: "auto" }}>
      {tabs.map((t) => {
        const selected = t.id === value;
        return (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[t.id] = el;
            }}
            id={tabId(idPrefix, t.id)}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={tabPanelId(idPrefix, t.id)}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(t.id)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "9px 14px",
              marginBottom: -1,
              border: "none",
              borderBottom: `2px solid ${selected ? THEME.brand : "transparent"}`,
              background: "transparent",
              color: selected ? THEME.brandHi : THEME.textDim,
              fontSize: 13,
              fontWeight: selected ? 600 : 500,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {t.label}
            {typeof t.count === "number" ? (
              <span className="tnum" style={{ fontSize: 11, color: THEME.textMuted, background: THEME.surface3, borderRadius: 999, padding: "1px 7px" }}>
                {t.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

// ── Popover ─────────────────────────────────────────────────────────────────

const VIEWPORT_MARGIN = 8;
const GAP = 6;

const PopoverCloseContext = createContext<() => void>(() => {});

/** Inside a Popover: closes it and returns focus to its trigger (e.g. after picking an action). */
export function usePopoverClose(): () => void {
  return useContext(PopoverCloseContext);
}

export function Popover({
  trigger,
  label,
  children,
  align = "start",
  width = 300,
  triggerStyle,
}: {
  /** Content of the trigger button (e.g. a ScoreBadge). */
  trigger: ReactNode;
  /** Accessible name of the panel (and of the trigger when its content is not text). */
  label: string;
  children: ReactNode;
  align?: "start" | "end";
  width?: number;
  triggerStyle?: CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const close = useCallback((restoreFocus = false) => {
    setOpen(false);
    setPosition(null);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);
  const closeAndRefocus = useCallback(() => close(true), [close]);

  // Place the panel under the trigger (or above when there's no room), inside the viewport.
  useLayoutEffect(() => {
    if (!open) return;
    const trig = triggerRef.current;
    const panel = panelRef.current;
    if (!trig || !panel) return;
    const rect = trig.getBoundingClientRect();
    const panelWidth = panel.offsetWidth;
    const panelHeight = panel.offsetHeight;
    let left = align === "end" ? rect.right - panelWidth : rect.left;
    left = Math.min(Math.max(left, VIEWPORT_MARGIN), window.innerWidth - panelWidth - VIEWPORT_MARGIN);
    let top = rect.bottom + GAP;
    if (top + panelHeight > window.innerHeight - VIEWPORT_MARGIN && rect.top - GAP - panelHeight >= VIEWPORT_MARGIN) {
      top = rect.top - GAP - panelHeight;
    }
    setPosition({ top, left: Math.max(left, VIEWPORT_MARGIN) });
  }, [open, align]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      close();
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") close(true);
    };
    const onViewportChange = () => close();
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onViewportChange);
    window.addEventListener("scroll", onViewportChange, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("scroll", onViewportChange, true);
    };
  }, [open, close]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={typeof trigger === "string" ? undefined : label}
        onClick={() => (open ? close() : setOpen(true))}
        style={{ display: "inline-flex", alignItems: "center", padding: 0, border: "none", background: "transparent", cursor: "pointer", ...triggerStyle }}
      >
        {trigger}
      </button>
      {open ? (
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-label={label}
          style={{
            position: "fixed",
            top: position?.top ?? 0,
            left: position?.left ?? 0,
            // Invisible for the one frame before it is measured and placed.
            visibility: position ? "visible" : "hidden",
            zIndex: 50,
            width,
            maxWidth: `calc(100vw - ${VIEWPORT_MARGIN * 2}px)`,
            maxHeight: `calc(100vh - ${VIEWPORT_MARGIN * 2}px)`,
            overflowY: "auto",
            padding: 14,
            borderRadius: THEME.radius,
            border: `1px solid ${THEME.border}`,
            background: THEME.surface2,
            boxShadow: "0 16px 40px rgba(29, 23, 38, 0.14)",
            fontFamily: THEME.fontSans,
            fontSize: 13,
            color: THEME.text,
          }}
        >
          <PopoverCloseContext.Provider value={closeAndRefocus}>{children}</PopoverCloseContext.Provider>
        </div>
      ) : null}
    </>
  );
}
