"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePostHog } from "posthog-js/react";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  redirectAfterSignup?: string;
}

export function AuthModal({ isOpen, onClose, redirectAfterSignup = "/dashboard/editor" }: AuthModalProps) {
  const posthog = usePostHog();
  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      posthog?.capture("auth_modal_viewed");
      return () => { document.body.style.overflow = ""; };
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
        background: "rgba(0,0,0,0.7)", backdropFilter: "blur(2px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "16px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: "440px",
          background: "#0f0f12", border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "16px", padding: "32px", position: "relative",
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: "absolute", top: "16px", right: "16px",
            background: "transparent", border: "none", color: "rgba(255,255,255,0.4)",
            fontSize: "18px", cursor: "pointer", padding: "4px",
            lineHeight: 1,
          }}
        >
          &#x2715;
        </button>

        {/* Header */}
        <h2 style={{ fontSize: "22px", fontWeight: 800, color: "#fafafa", marginBottom: "6px" }}>
          Fix your AI score — free
        </h2>
        <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.4)", marginBottom: "24px" }}>
          Join 12,000+ writers using HumanizeIt
        </p>

        <div style={{ height: "1px", background: "rgba(255,255,255,0.06)", marginBottom: "24px" }} />

        {/* Auth buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "16px" }}>
          <Link
            href={signUpUrl}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
              background: "#fafafa", color: "#09090b", textDecoration: "none",
              padding: "12px", borderRadius: "8px", fontSize: "14px", fontWeight: 600,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Continue with Google
          </Link>
          <Link
            href={signUpUrl}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "#8b5cf6", color: "#fafafa", textDecoration: "none",
              padding: "12px", borderRadius: "8px", fontSize: "14px", fontWeight: 600,
            }}
          >
            Sign up with email
          </Link>

        </div>

        <div style={{ textAlign: "center", marginBottom: "20px" }}>
          <Link
            href={`/sign-in?redirect_url=${encodeURIComponent(redirectAfterSignup)}`}
            style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)", textDecoration: "underline" }}
          >
            Already have an account? Sign in
          </Link>
        </div>

        {/* Divider */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
          <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.06)" }} />
          <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.2)" }}>or</span>
          <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.06)" }} />
        </div>

        {/* Free plan features */}
        <div style={{ fontSize: "11px", fontWeight: 600, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "10px" }}>
          FREE plan includes:
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {[
            "500 words/day humanization",
            "37-pattern AI detection",
            "Text heatmap",
            "No credit card needed",
          ].map((f) => (
            <div key={f} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "rgba(255,255,255,0.55)" }}>
              <span style={{ color: "#22c55e" }}>&#x2713;</span>
              {f}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
