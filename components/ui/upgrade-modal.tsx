"use client";

import { useState, useEffect } from "react";
import { usePostHog } from "posthog-js/react";

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPlan: string;
}

const PLANS = [
  { id: "FREE", name: "Free", price: "$0", period: "", words: "500w/d", popular: false },
  { id: "PRO",  name: "Pro",  price: "$9", period: "/mo", words: "50k w/mo", popular: true },
  { id: "TEAM", name: "Team", price: "$29", period: "/mo", words: "200k w/mo", popular: false },
];

export function UpgradeModal({ isOpen, onClose, currentPlan }: UpgradeModalProps) {
  const posthog = usePostHog();
  const [code, setCode] = useState("");
  const [codeStatus, setCodeStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [redeeming, setRedeeming] = useState(false);

  // Lock body scroll + track open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      posthog?.capture("upgrade_modal_viewed", { current_plan: currentPlan });
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

  async function handleRedeem() {
    if (!code.trim()) return;
    setRedeeming(true);
    setCodeStatus(null);
    try {
      const res = await fetch("/api/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json() as { success?: boolean; plan?: string; error?: { message: string } };
      if (res.ok && data.success) {
        setCodeStatus({ type: "success", message: `Upgraded to ${data.plan}!` });
        posthog?.capture("discount_code_success", { plan: data.plan });
      } else {
        setCodeStatus({ type: "error", message: data.error?.message ?? "Invalid code." });
        posthog?.capture("discount_code_failed", { code: code.trim() });
      }
    } catch {
      setCodeStatus({ type: "error", message: "Network error." });
    } finally {
      setRedeeming(false);
    }
  }

  if (!isOpen) return null;

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
          width: "100%", maxWidth: "520px",
          background: "#0f0f12", border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "16px", padding: "32px", position: "relative",
        }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          style={{
            position: "absolute", top: "16px", right: "16px",
            background: "transparent", border: "none", color: "rgba(255,255,255,0.4)",
            fontSize: "18px", cursor: "pointer", padding: "4px", lineHeight: 1,
          }}
        >
          &#x2715;
        </button>

        {/* Header */}
        <h2 style={{ fontSize: "22px", fontWeight: 800, color: "#fafafa", marginBottom: "6px" }}>
          You&apos;ve reached your daily limit
        </h2>
        <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.4)", marginBottom: "24px" }}>
          Upgrade to keep humanizing
        </p>

        {/* Plan cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginBottom: "24px" }}>
          {PLANS.map((plan) => {
            const isCurrent = currentPlan.toUpperCase() === plan.id;
            const isPro = plan.id === "PRO";
            return (
              <div
                key={plan.id}
                style={{
                  background: isPro ? "rgba(139,92,246,0.08)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${isPro ? "rgba(139,92,246,0.3)" : "rgba(255,255,255,0.07)"}`,
                  borderRadius: "10px", padding: "16px", textAlign: "center",
                  position: "relative",
                }}
              >
                {plan.popular && (
                  <div style={{
                    position: "absolute", top: "-8px", left: "50%", transform: "translateX(-50%)",
                    background: "#8b5cf6", color: "#fafafa", fontSize: "9px", fontWeight: 700,
                    padding: "2px 8px", borderRadius: "100px", textTransform: "uppercase",
                    letterSpacing: "0.5px", whiteSpace: "nowrap",
                  }}>
                    Popular
                  </div>
                )}
                <div style={{ fontSize: "13px", fontWeight: 600, color: "rgba(255,255,255,0.6)", marginBottom: "6px" }}>
                  {plan.name}
                </div>
                <div style={{ fontSize: "28px", fontWeight: 800, color: "#fafafa", lineHeight: 1 }}>
                  {plan.price}
                  <span style={{ fontSize: "13px", fontWeight: 400, color: "rgba(255,255,255,0.35)" }}>{plan.period}</span>
                </div>
                <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)", margin: "8px 0 12px" }}>
                  {plan.words}
                </div>
                {isCurrent ? (
                  <div style={{
                    padding: "8px", borderRadius: "6px", fontSize: "12px", fontWeight: 600,
                    background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.3)",
                  }}>
                    Current
                  </div>
                ) : plan.id !== "FREE" ? (
                  <a
                    href={`/api/checkout?plan=${plan.id.toLowerCase()}`}
                    onClick={() => posthog?.capture("upgrade_cta_clicked", { plan: plan.id, current_plan: currentPlan })}
                    style={{
                      display: "block", padding: "8px", borderRadius: "6px",
                      fontSize: "12px", fontWeight: 600, textDecoration: "none",
                      background: isPro ? "#8b5cf6" : "rgba(255,255,255,0.08)",
                      color: isPro ? "#fafafa" : "rgba(255,255,255,0.6)",
                      textAlign: "center",
                    }}
                  >
                    Upgrade &rarr;
                  </a>
                ) : null}
              </div>
            );
          })}
        </div>

        {/* What you unlock */}
        <div style={{ marginBottom: "20px" }}>
          <div style={{
            fontSize: "11px", fontWeight: 600, color: "rgba(255,255,255,0.3)",
            textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "10px",
          }}>
            What you unlock:
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {[
              "Unlimited humanizations (within plan)",
              "4 tone modes",
              "History & saved documents",
              "Priority processing",
            ].map((f) => (
              <div key={f} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "rgba(255,255,255,0.55)" }}>
                <span style={{ color: "#22c55e" }}>&#x2713;</span>
                {f}
              </div>
            ))}
          </div>
        </div>

        {/* Discount code */}
        <div style={{ marginBottom: "20px" }}>
          <div style={{
            fontSize: "11px", fontWeight: 600, color: "rgba(255,255,255,0.3)",
            textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px",
          }}>
            Have a discount code?
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Enter code..."
              style={{
                flex: 1, padding: "10px 12px", borderRadius: "6px",
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                color: "#fafafa", fontSize: "13px", outline: "none",
              }}
            />
            <button
              onClick={handleRedeem}
              disabled={redeeming || !code.trim()}
              style={{
                padding: "10px 16px", borderRadius: "6px", border: "none",
                background: code.trim() ? "#8b5cf6" : "rgba(139,92,246,0.3)",
                color: "#fafafa", fontSize: "13px", fontWeight: 600,
                cursor: code.trim() ? "pointer" : "not-allowed",
              }}
            >
              {redeeming ? "..." : "Apply"}
            </button>
          </div>
          {codeStatus && (
            <div style={{
              marginTop: "6px", fontSize: "12px",
              color: codeStatus.type === "success" ? "#22c55e" : "#ef4444",
            }}>
              {codeStatus.message}
            </div>
          )}
        </div>

        {/* Maybe later */}
        <button
          onClick={onClose}
          style={{
            width: "100%", padding: "10px", borderRadius: "6px",
            background: "transparent", border: "1px solid rgba(255,255,255,0.06)",
            color: "rgba(255,255,255,0.3)", fontSize: "13px", cursor: "pointer",
          }}
        >
          Maybe later
        </button>
      </div>
    </div>
  );
}
