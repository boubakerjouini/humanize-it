"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, X } from "lucide-react";
import { THEME } from "@/lib/theme";

const STORAGE_KEY = "humanizeit_onboarded";

export function OnboardingChecklist() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && !localStorage.getItem(STORAGE_KEY)) {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setVisible(false);
  };

  const steps = [
    { label: "Create your account", done: true, href: undefined },
    { label: "Analyze a text", done: false, href: "/dashboard/editor", cta: "Analyze Now" },
    { label: "Humanize the result", done: false, href: "/dashboard/editor" },
  ];

  return (
    <div style={{
      background: THEME.surface2,
      border: `1px solid ${THEME.border}`,
      borderRadius: THEME.radiusLg,
      padding: "24px",
      marginBottom: "28px",
      position: "relative",
    }}>
      <button
        onClick={dismiss}
        style={{
          position: "absolute", top: "16px", right: "16px",
          background: "transparent", border: "none", cursor: "pointer",
          color: THEME.textDim, padding: "4px",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
        aria-label="Dismiss onboarding"
      >
        <X size={16} aria-hidden="true" />
      </button>

      <div className="kicker" style={{ marginBottom: "8px" }}>GET STARTED</div>

      <h3 style={{
        fontSize: "16px", fontWeight: 700, color: THEME.text,
        marginBottom: "4px", fontFamily: THEME.fontHeading, letterSpacing: "-0.01em",
      }}>
        Get started with HumanizeIt
      </h3>
      <p style={{ fontSize: "13px", color: THEME.textDim, marginBottom: "20px", fontFamily: THEME.fontSans }}>
        Complete these steps to get the most out of the platform.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {steps.map((step, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: "12px",
            padding: "12px 16px",
            background: step.done ? THEME.humanDim : THEME.surface1,
            borderRadius: THEME.radius,
            border: `1px solid ${step.done ? THEME.border : THEME.border}`,
          }}>
            {step.done ? (
              <CheckCircle2 size={20} color={THEME.human} aria-hidden="true" style={{ flexShrink: 0 }} />
            ) : (
              <Circle size={20} color={THEME.textMuted} aria-hidden="true" style={{ flexShrink: 0 }} />
            )}
            <span className="mono" style={{
              flex: 1,
              fontSize: "13px",
              fontWeight: step.done ? 500 : 600,
              color: step.done ? THEME.textDim : THEME.text,
              textDecoration: step.done ? "line-through" : "none",
              letterSpacing: "0.01em",
            }}>
              {step.label}
            </span>
            {step.cta && step.href && (
              <Link href={step.href} style={{
                fontSize: "12px", fontWeight: 700, color: "#ffffff",
                background: THEME.brand, padding: "6px 14px", borderRadius: THEME.radius,
                textDecoration: "none", whiteSpace: "nowrap",
                fontFamily: THEME.fontSans,
              }}>
                {step.cta}
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
