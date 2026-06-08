"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePostHog } from "posthog-js/react";
import { Check, X } from "lucide-react";
import { THEME, glow } from "@/lib/theme";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  redirectAfterSignup?: string;
}

export function AuthModal({ isOpen, onClose, redirectAfterSignup = "/dashboard/editor" }: AuthModalProps) {
  const posthog = usePostHog();
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // Lock body scroll when open + remember focus for restore
  useEffect(() => {
    if (isOpen) {
      previouslyFocused.current = document.activeElement as HTMLElement | null;
      document.body.style.overflow = "hidden";
      posthog?.capture("auth_modal_viewed");
      // Move focus into the dialog
      requestAnimationFrame(() => panelRef.current?.focus());
      return () => {
        document.body.style.overflow = "";
        previouslyFocused.current?.focus?.();
      };
    }
  }, [isOpen]);

  // Close on ESC
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const signUpUrl = `/sign-up?redirect_url=${encodeURIComponent(redirectAfterSignup)}`;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(0,0,0,0.66)", backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "16px",
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: "440px",
          background: THEME.surface1, border: `1px solid ${THEME.border}`,
          borderRadius: THEME.radiusXl, padding: "32px", position: "relative",
          boxShadow: "0 24px 70px rgba(0,0,0,0.6)",
          outline: "none",
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            position: "absolute", top: "16px", right: "16px",
            background: "transparent", border: "none", color: THEME.textDim,
            cursor: "pointer", padding: "4px", lineHeight: 1,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <X size={18} aria-hidden="true" />
        </button>

        {/* Kicker */}
        <div className="kicker" style={{ marginBottom: "10px" }}>FREE ACCESS</div>

        {/* Header */}
        <h2
          id="auth-modal-title"
          style={{ fontSize: "22px", fontWeight: 700, color: THEME.text, marginBottom: "6px", fontFamily: THEME.fontHeading, letterSpacing: "-0.02em" }}
        >
          Fix your AI score — free
        </h2>
        <p style={{ fontSize: "14px", color: THEME.textDim, marginBottom: "24px", fontFamily: THEME.fontSans }}>
          Join 12,000+ writers using HumanizeIt
        </p>

        <div style={{ height: "1px", background: THEME.border, marginBottom: "24px" }} />

        {/* Auth buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "16px" }}>
          <Link
            href={signUpUrl}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
              background: THEME.surface3, color: THEME.text, textDecoration: "none",
              padding: "12px", borderRadius: THEME.radius, fontSize: "14px", fontWeight: 600,
              border: `1px solid ${THEME.border}`, fontFamily: THEME.fontSans,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Continue with Google
          </Link>
          <Link
            href={signUpUrl}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              background: THEME.brand, color: "#ffffff", textDecoration: "none",
              padding: "12px", borderRadius: THEME.radius, fontSize: "14px", fontWeight: 600,
              fontFamily: THEME.fontSans, boxShadow: glow(THEME.brand, 0.35),
            }}
          >
            Sign up with email →
          </Link>

        </div>

        <div style={{ textAlign: "center", marginBottom: "20px" }}>
          <Link
            href={`/sign-in?redirect_url=${encodeURIComponent(redirectAfterSignup)}`}
            style={{ fontSize: "12px", color: THEME.brandHi, textDecoration: "underline", fontFamily: THEME.fontSans }}
          >
            Already have an account? Sign in
          </Link>
        </div>

        {/* Divider */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
          <div style={{ flex: 1, height: "1px", background: THEME.border }} />
          <span className="mono" style={{ fontSize: "11px", color: THEME.textMuted, textTransform: "uppercase", letterSpacing: "0.1em" }}>or</span>
          <div style={{ flex: 1, height: "1px", background: THEME.border }} />
        </div>

        {/* Free plan features */}
        <div className="mono" style={{ fontSize: "11px", fontWeight: 600, color: THEME.textDim, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "10px" }}>
          FREE plan includes:
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {[
            "500 words/day humanization",
            "37-pattern AI detection",
            "Text heatmap",
            "No credit card needed",
          ].map((f) => (
            <div key={f} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: THEME.textDim, fontFamily: THEME.fontSans }}>
              <Check size={14} color={THEME.human} aria-hidden="true" style={{ flexShrink: 0 }} />
              {f}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
