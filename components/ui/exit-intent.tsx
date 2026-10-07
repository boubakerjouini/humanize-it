"use client";

// ===========================================================
// components/ui/exit-intent.tsx — Exit-intent popups.
//   signup (default)  the home page's "500 free words" nudge, unchanged
//   magnet            a free PDF offer on tool and blog pages: desktop mouse
//                     exit, or on touch devices after 45 s and 60% scroll;
//                     at most once per 14 days, never after an email capture,
//                     never while a scan or rewrite is running, one per page
// ===========================================================

import { useState, useEffect, useId, useRef } from "react";
import Link from "next/link";
import { Hand, X } from "lucide-react";
import { THEME, glow } from "@/lib/theme";
import { LeadCaptureForm, hasCapturedLead } from "@/components/growth/lead-capture-form";
import { getMagnet } from "@/lib/growth/magnets";
import type { MagnetSlug, PublicLeadSource } from "@/lib/growth/constants";

type ExitIntentProps = {
  variant?: "signup" | "magnet";
  magnet?: MagnetSlug;
  source?: PublicLeadSource;
  /** True while a detection or rewrite is in flight: the popup must not cover the result. */
  suppress?: boolean;
};

export function ExitIntent({ variant = "signup", magnet, source = "exit_intent", suppress = false }: ExitIntentProps = {}) {
  if (variant === "magnet" && magnet) return <MagnetExitIntent magnet={magnet} source={source} suppress={suppress} />;
  return <SignupExitIntent />;
}

function SignupExitIntent() {
  const [show, setShow] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem("humanizeit_exit_shown") === "true") return;

    const handler = (e: MouseEvent) => {
      if (e.clientY < 10) {
        setShow(true);
        localStorage.setItem("humanizeit_exit_shown", "true");
        document.removeEventListener("mouseout", handler);
      }
    };

    document.addEventListener("mouseout", handler);
    return () => document.removeEventListener("mouseout", handler);
  }, []);

  // Focus management + ESC when shown
  useEffect(() => {
    if (!show) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    requestAnimationFrame(() => panelRef.current?.focus());
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShow(false);
    };
    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      previouslyFocused.current?.focus?.();
    };
  }, [show]);

  if (!show) return null;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(29,23,38,0.36)", backdropFilter: "blur(6px)",
        padding: "16px",
      }}
      onClick={() => setShow(false)}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="exit-intent-title"
        onClick={(e) => e.stopPropagation()}
        className="animate-fade-up"
        style={{
          background: THEME.surface2, borderRadius: THEME.radiusXl,
          border: `1px solid ${THEME.border}`,
          boxShadow: "0 28px 70px -18px rgba(124,58,237,0.32), 0 10px 30px -14px rgba(29,23,38,0.14)",
          maxWidth: "420px", width: "90%",
          padding: "40px 32px", textAlign: "center",
          position: "relative",
          outline: "none",
        }}
      >
        <button
          onClick={() => setShow(false)}
          style={{
            position: "absolute", top: "14px", right: "14px",
            background: "transparent", border: "none",
            color: THEME.textDim, cursor: "pointer",
            width: "32px", height: "32px", display: "flex",
            alignItems: "center", justifyContent: "center",
            borderRadius: THEME.radius,
          }}
          aria-label="Close"
        >
          <X size={18} aria-hidden="true" />
        </button>

        <div style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: "56px", height: "56px", borderRadius: "50%",
          background: THEME.accentDim, marginBottom: "16px",
        }}>
          <Hand size={28} color={THEME.accent} aria-hidden="true" />
        </div>

        <h3
          id="exit-intent-title"
          style={{
            fontSize: "22px", fontWeight: 700, color: THEME.text,
            marginBottom: "10px", letterSpacing: "-0.02em",
            fontFamily: THEME.fontHeading,
          }}
        >
          Wait — get{" "}
          <span style={{ color: THEME.accent }}>500 free words</span>{" "}
          before you go
        </h3>

        <p style={{
          fontSize: "14px", color: THEME.textDim, lineHeight: 1.6,
          marginBottom: "24px", fontFamily: THEME.fontSans,
        }}>
          Paste any AI text, get a detection score, and humanize it — completely free. No credit card required.
        </p>

        <Link
          href="/sign-up"
          style={{
            display: "inline-block",
            background: THEME.gradient,
            color: "#ffffff", fontWeight: 700,
            padding: "14px 32px", borderRadius: THEME.radius,
            fontSize: "15px", textDecoration: "none",
            boxShadow: glow(THEME.brand, 0.4),
            fontFamily: THEME.fontSans,
          }}
        >
          Claim 500 free words →
        </Link>
      </div>
    </div>
  );
}

// ── Magnet variant ───────────────────────────────────────────────────────────

const SHOWN_AT_KEY = "hz_exit_magnet_at";
const FREQUENCY_MS = 14 * 24 * 60 * 60 * 1000;
const MOBILE_MIN_MS = 45_000;
const MOBILE_MIN_SCROLL = 0.6;

declare global {
  interface Window {
    __hzExitMounted?: boolean;
  }
}

function shownRecently(now: number): boolean {
  try {
    const at = Number(localStorage.getItem(SHOWN_AT_KEY) ?? "0");
    return Number.isFinite(at) && now - at < FREQUENCY_MS;
  } catch {
    return false;
  }
}

function rememberShown(now: number): void {
  try {
    localStorage.setItem(SHOWN_AT_KEY, String(now));
  } catch {
    // Storage blocked: the popup may show again on a later visit, nothing worse.
  }
}

function MagnetExitIntent({ magnet, source, suppress }: { magnet: MagnetSlug; source: PublicLeadSource; suppress: boolean }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const suppressRef = useRef(suppress);
  const titleId = useId();
  const entry = getMagnet(magnet);

  useEffect(() => {
    suppressRef.current = suppress;
  }, [suppress]);

  useEffect(() => {
    // One exit popup per page, even when several components mount one: only
    // the first instance listens; the others stay closed forever.
    if (window.__hzExitMounted) return;
    window.__hzExitMounted = true;
    const release = () => {
      window.__hzExitMounted = false;
    };
    const startedAt = Date.now();
    if (hasCapturedLead() || shownRecently(startedAt)) return release;

    let done = false;
    const open = () => {
      if (done || suppressRef.current || hasCapturedLead()) return;
      const dialog = dialogRef.current;
      if (!dialog || dialog.open) return;
      done = true;
      rememberShown(Date.now());
      dialog.showModal();
      cleanup();
    };

    const onMouseOut = (e: MouseEvent) => {
      if (e.clientY < 10 && !e.relatedTarget) open();
    };
    const onScroll = () => {
      if (Date.now() - startedAt < MOBILE_MIN_MS) return;
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - window.innerHeight;
      if (scrollable > 0 && window.scrollY / scrollable >= MOBILE_MIN_SCROLL) open();
    };

    const coarse = window.matchMedia("(pointer: coarse)").matches;
    if (coarse) window.addEventListener("scroll", onScroll, { passive: true });
    else document.addEventListener("mouseout", onMouseOut);

    function cleanup() {
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("mouseout", onMouseOut);
    }
    return () => {
      cleanup();
      release();
    };
  }, []);

  // Light dismiss for browsers without <dialog closedby> (Safari).
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || "closedBy" in HTMLDialogElement.prototype) return;
    const onClick = (event: MouseEvent) => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      const inside =
        rect.top <= event.clientY && event.clientY <= rect.bottom && rect.left <= event.clientX && event.clientX <= rect.right;
      if (!inside) dialog.close();
    };
    dialog.addEventListener("click", onClick);
    return () => dialog.removeEventListener("click", onClick);
  }, []);

  if (!entry) return null;

  return (
    <dialog
      ref={dialogRef}
      closedby="any"
      aria-labelledby={titleId}
      className="hz-exit-dialog"
      style={{
        border: `1px solid ${THEME.border}`,
        borderRadius: THEME.radiusXl,
        padding: "32px 28px 28px",
        maxWidth: "440px",
        width: "calc(100% - 32px)",
        // The global reset zeroes margins, which would pin the modal to the top-left corner.
        margin: "auto",
        background: THEME.surface2,
        color: THEME.text,
        boxShadow: "0 28px 70px -18px rgba(124,58,237,0.32), 0 10px 30px -14px rgba(29,23,38,0.14)",
      }}
    >
      <style>{`.hz-exit-dialog::backdrop{background:rgba(29,23,38,0.36);backdrop-filter:blur(6px);}`}</style>
      <form method="dialog" style={{ position: "absolute", top: "12px", right: "12px", margin: 0 }}>
        <button
          type="submit"
          aria-label="Close"
          style={{ background: "transparent", border: "none", color: THEME.textDim, cursor: "pointer", width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: THEME.radius }}
        >
          <X size={18} aria-hidden="true" />
        </button>
      </form>
      <div style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: THEME.accent, marginBottom: "8px" }}>
        Free {entry.noun} · {entry.pages} pages
      </div>
      <h2 id={titleId} style={{ fontSize: "21px", fontWeight: 700, lineHeight: 1.25, margin: "0 0 10px", letterSpacing: "-0.02em", fontFamily: THEME.fontHeading, color: THEME.text }}>
        Before you go: the free {entry.shortTitle}
      </h2>
      <ul style={{ margin: "0 0 16px", paddingLeft: "18px", listStyle: "disc", color: THEME.textDim, fontSize: "14px", lineHeight: 1.6 }}>
        {entry.bullets.slice(0, 2).map((b) => (
          <li key={b} style={{ marginBottom: "4px" }}>
            {b}
          </li>
        ))}
      </ul>
      <LeadCaptureForm source={source} magnet={entry.slug} variant="compact" ctaLabel="Get the PDF" />
    </dialog>
  );
}
