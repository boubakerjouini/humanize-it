"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Hand, X } from "lucide-react";
import { THEME, glow } from "@/lib/theme";

export function ExitIntent() {
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
