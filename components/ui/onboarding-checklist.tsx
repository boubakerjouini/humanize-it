"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, X } from "lucide-react";

const STORAGE_KEY = "humanizeit_onboarded";

const V = {
  brand: "#7e22ce",
};

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
      background: "#ffffff",
      border: "1px solid #e9d5ff",
      borderRadius: "16px",
      padding: "24px",
      marginBottom: "28px",
      position: "relative",
    }}>
      <button
        onClick={dismiss}
        style={{
          position: "absolute", top: "16px", right: "16px",
          background: "transparent", border: "none", cursor: "pointer",
          color: "#9ca3af", padding: "4px",
        }}
        aria-label="Dismiss onboarding"
      >
        <X size={16} />
      </button>

      <h3 style={{
        fontSize: "16px", fontWeight: 700, color: "#3b0764",
        marginBottom: "4px", fontFamily: "var(--font-heading)",
      }}>
        Get started with HumanizeIt
      </h3>
      <p style={{ fontSize: "13px", color: "#6b7280", marginBottom: "20px" }}>
        Complete these steps to get the most out of the platform.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {steps.map((step, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: "12px",
            padding: "12px 16px",
            background: step.done ? "rgba(126,34,206,0.04)" : "#faf5ff",
            borderRadius: "12px",
            border: "1px solid #f3e8ff",
          }}>
            {step.done ? (
              <CheckCircle2 size={20} color={V.brand} />
            ) : (
              <Circle size={20} color="#d1d5db" />
            )}
            <span style={{
              flex: 1,
              fontSize: "14px",
              fontWeight: step.done ? 500 : 600,
              color: step.done ? "#6b7280" : "#111827",
              textDecoration: step.done ? "line-through" : "none",
            }}>
              {step.label}
            </span>
            {step.cta && step.href && (
              <Link href={step.href} style={{
                fontSize: "12px", fontWeight: 700, color: "#ffffff",
                background: V.brand, padding: "6px 14px", borderRadius: "8px",
                textDecoration: "none", whiteSpace: "nowrap",
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
