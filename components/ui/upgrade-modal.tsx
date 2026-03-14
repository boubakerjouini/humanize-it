"use client";

import { useState, useEffect } from "react";
import { usePostHog } from "posthog-js/react";
import { track } from "@vercel/analytics";

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
        background: "rgba(0,0,0,0.3)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "16px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: "520px",
          background: "#ffffff", border: "1px solid #e5e7eb",
          borderRadius: "24px", overflow: "hidden", position: "relative",
          boxShadow: "0 20px 60px rgba(0,0,0,0.1)",
        }}
      >
        {/* Purple gradient header strip */}
        <div style={{
          background: "linear-gradient(135deg, #7e22ce, #9333ea)",
          padding: "24px 32px",
          position: "relative",
        }}>
          {/* Close */}
          <button
            onClick={onClose}
            style={{
              position: "absolute", top: "16px", right: "16px",
              background: "transparent", border: "none", color: "rgba(255,255,255,0.7)",
              fontSize: "18px", cursor: "pointer", padding: "4px", lineHeight: 1,
            }}
          >
            &#x2715;
          </button>

          <h2 style={{ fontSize: "22px", fontWeight: 800, color: "#ffffff", marginBottom: "6px", fontFamily: "var(--font-heading)" }}>
            You&apos;ve reached your daily limit
          </h2>
          <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.8)" }}>
            Upgrade to keep humanizing
          </p>
        </div>

        <div style={{ padding: "24px 32px 32px" }}>
          {/* Plan cards */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginBottom: "24px" }}>
            {PLANS.map((plan) => {
              const isCurrent = currentPlan.toUpperCase() === plan.id;
              const isPro = plan.id === "PRO";
              return (
                <div
                  key={plan.id}
                  style={{
                    background: isPro ? "#7e22ce" : "#ffffff",
                    border: `1px solid ${isPro ? "#7e22ce" : "#e5e7eb"}`,
                    borderRadius: "12px", padding: "16px", textAlign: "center",
                    position: "relative",
                  }}
                >
                  {plan.popular && (
                    <div style={{
                      position: "absolute", top: "-8px", left: "50%", transform: "translateX(-50%)",
                      background: "#a855f7", color: "#ffffff", fontSize: "9px", fontWeight: 700,
                      padding: "2px 8px", borderRadius: "100px", textTransform: "uppercase",
                      letterSpacing: "0.5px", whiteSpace: "nowrap",
                    }}>
                      Popular
                    </div>
                  )}
                  <div style={{ fontSize: "13px", fontWeight: 600, color: isPro ? "rgba(255,255,255,0.8)" : "#6b7280", marginBottom: "6px" }}>
                    {plan.name}
                  </div>
                  <div style={{ fontSize: "28px", fontWeight: 800, color: isPro ? "#ffffff" : "#111827", lineHeight: 1 }}>
                    {plan.price}
                    <span style={{ fontSize: "13px", fontWeight: 400, color: isPro ? "rgba(255,255,255,0.6)" : "#9ca3af" }}>{plan.period}</span>
                  </div>
                  <div style={{ fontSize: "12px", color: isPro ? "rgba(255,255,255,0.6)" : "#9ca3af", margin: "8px 0 12px" }}>
                    {plan.words}
                  </div>
                  {isCurrent ? (
                    <div style={{
                      padding: "8px", borderRadius: "8px", fontSize: "12px", fontWeight: 600,
                      background: isPro ? "rgba(255,255,255,0.15)" : "#f3f4f6", color: isPro ? "rgba(255,255,255,0.7)" : "#9ca3af",
                    }}>
                      Current
                    </div>
                  ) : plan.id !== "FREE" ? (
                    <a
                      href={`/api/checkout?plan=${plan.id.toLowerCase()}`}
                      onClick={() => { posthog?.capture("upgrade_cta_clicked", { plan: plan.id, current_plan: currentPlan }); track("upgrade_cta_clicked", { plan: plan.id }); }}
                      style={{
                        display: "block", padding: "8px", borderRadius: "8px",
                        fontSize: "12px", fontWeight: 600, textDecoration: "none",
                        background: isPro ? "#ffffff" : "#7e22ce",
                        color: isPro ? "#7e22ce" : "#ffffff",
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
              fontSize: "11px", fontWeight: 600, color: "#9ca3af",
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
                <div key={f} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#4b5563" }}>
                  <span style={{ color: "#16a34a" }}>&#x2713;</span>
                  {f}
                </div>
              ))}
            </div>
          </div>

          {/* Discount code */}
          <div style={{ marginBottom: "20px" }}>
            <div style={{
              fontSize: "11px", fontWeight: 600, color: "#9ca3af",
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
                  flex: 1, padding: "10px 12px", borderRadius: "10px",
                  background: "#f9fafb", border: "1px solid #e5e7eb",
                  color: "#111827", fontSize: "13px", outline: "none",
                }}
              />
              <button
                onClick={handleRedeem}
                disabled={redeeming || !code.trim()}
                style={{
                  padding: "10px 16px", borderRadius: "10px", border: "none",
                  background: code.trim() ? "#7e22ce" : "#e9d5ff",
                  color: code.trim() ? "#ffffff" : "#a855f7", fontSize: "13px", fontWeight: 600,
                  cursor: code.trim() ? "pointer" : "not-allowed",
                }}
              >
                {redeeming ? "..." : "Apply"}
              </button>
            </div>
            {codeStatus && (
              <div style={{
                marginTop: "6px", fontSize: "12px",
                color: codeStatus.type === "success" ? "#16a34a" : "#dc2626",
              }}>
                {codeStatus.message}
              </div>
            )}
          </div>

          {/* Maybe later */}
          <button
            onClick={onClose}
            style={{
              width: "100%", padding: "10px", borderRadius: "10px",
              background: "transparent", border: "1px solid #e5e7eb",
              color: "#9ca3af", fontSize: "13px", cursor: "pointer",
            }}
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}
