"use client";

import { useState, useEffect, useRef } from "react";
import { usePostHog } from "posthog-js/react";
import { track } from "@vercel/analytics";
import { Check, X } from "lucide-react";
import { THEME, glow } from "@/lib/theme";

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
  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  async function handleUpgrade(planId: string) {
    if (checkingOut) return;
    setCheckingOut(planId);
    posthog?.capture("upgrade_cta_clicked", { plan: planId, current_plan: currentPlan });
    track("upgrade_cta_clicked", { plan: planId });
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId }),
      });
      const data = (await res.json()) as { url?: string; error?: { message: string } };
      if (res.ok && data.url) {
        window.location.href = data.url;
        return; // keep spinner until navigation
      }
      setCodeStatus({ type: "error", message: data.error?.message ?? "Could not start checkout. Try again." });
      setCheckingOut(null);
    } catch {
      setCodeStatus({ type: "error", message: "Network error starting checkout." });
      setCheckingOut(null);
    }
  }

  // Lock body scroll + track open + remember focus
  useEffect(() => {
    if (isOpen) {
      previouslyFocused.current = document.activeElement as HTMLElement | null;
      document.body.style.overflow = "hidden";
      posthog?.capture("upgrade_modal_viewed", { current_plan: currentPlan });
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
        background: "rgba(29,23,38,0.36)", backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "16px",
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="upgrade-modal-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: "520px",
          background: THEME.surface2, border: `1px solid ${THEME.border}`,
          borderRadius: THEME.radiusXl, overflow: "hidden", position: "relative",
          boxShadow: "0 28px 70px -18px rgba(124,58,237,0.32), 0 10px 30px -14px rgba(29,23,38,0.14)",
          outline: "none",
        }}
      >
        {/* Aurora header strip — the "win moment" */}
        <div style={{
          background: `linear-gradient(135deg, ${THEME.brandDim} 0%, ${THEME.accentDim} 100%)`,
          borderBottom: `1px solid ${THEME.border}`,
          padding: "24px 32px",
          position: "relative",
        }}>
          {/* Close */}
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

          <div className="kicker" style={{ marginBottom: "10px" }}>Nice work</div>
          <h2
            id="upgrade-modal-title"
            style={{ fontSize: "22px", fontWeight: 700, color: THEME.text, marginBottom: "6px", fontFamily: THEME.fontHeading, letterSpacing: "-0.02em" }}
          >
            Keep that human score{" "}
            <span style={{ color: THEME.accent }}>climbing</span>
          </h2>
          <p style={{ fontSize: "14px", color: THEME.textDim, fontFamily: THEME.fontSans }}>
            Upgrade for unlimited passes, every tone, and saved history.
          </p>
        </div>

        <div style={{ padding: "24px 32px 32px" }}>
          {/* Plan cards */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginBottom: "8px" }}>
            {PLANS.map((plan) => {
              const isCurrent = currentPlan.toUpperCase() === plan.id;
              const isPro = plan.id === "PRO";
              const isFree = plan.id === "FREE";
              return (
                <div
                  key={plan.id}
                  style={{
                    background: isPro ? THEME.brandDim : THEME.surface2,
                    border: `1px solid ${isPro ? THEME.brand : THEME.border}`,
                    borderRadius: THEME.radius, padding: "16px 12px", textAlign: "center",
                    position: "relative",
                    boxShadow: isPro ? glow(THEME.brand, 0.28) : "none",
                    opacity: isFree ? 0.62 : 1,
                  }}
                >
                  {plan.popular && (
                    <div style={{
                      position: "absolute", top: "-9px", left: "50%", transform: "translateX(-50%)",
                      background: THEME.accent, color: "#ffffff", fontSize: "10px", fontWeight: 700,
                      padding: "3px 10px", borderRadius: "100px", whiteSpace: "nowrap",
                      fontFamily: THEME.fontSans, letterSpacing: "0.01em",
                      boxShadow: glow(THEME.accent, 0.35),
                    }}>
                      Most popular
                    </div>
                  )}
                  <div style={{ fontSize: "13px", fontWeight: 700, color: isPro ? THEME.brandHi : THEME.text, marginBottom: "6px", fontFamily: THEME.fontSans }}>
                    {plan.name}
                  </div>
                  <div className="tnum" style={{ fontSize: "28px", fontWeight: 700, color: isPro ? THEME.brandHi : THEME.text, lineHeight: 1 }}>
                    {plan.price}
                    <span className="tnum" style={{ fontSize: "13px", fontWeight: 400, color: THEME.textMuted }}>{plan.period}</span>
                  </div>
                  <div className="tnum" style={{ fontSize: "12px", color: THEME.textDim, margin: "8px 0 12px" }}>
                    {plan.words}
                  </div>
                  {isCurrent ? (
                    <div style={{
                      padding: "8px", borderRadius: THEME.radius, fontSize: "12px", fontWeight: 600,
                      background: THEME.surface3, color: THEME.textDim,
                      fontFamily: THEME.fontSans,
                    }}>
                      Current plan
                    </div>
                  ) : plan.id !== "FREE" ? (
                    <button
                      onClick={() => handleUpgrade(plan.id)}
                      disabled={checkingOut !== null}
                      style={{
                        display: "block", width: "100%", padding: "9px", borderRadius: THEME.radius,
                        fontSize: "12px", fontWeight: 700, border: "none",
                        background: isPro ? THEME.gradient : THEME.surface3,
                        color: isPro ? "#ffffff" : THEME.text,
                        textAlign: "center",
                        cursor: checkingOut ? "wait" : "pointer",
                        opacity: checkingOut && checkingOut !== plan.id ? 0.6 : 1,
                        boxShadow: isPro ? glow(THEME.brand, 0.34) : "none",
                        fontFamily: THEME.fontSans,
                      }}
                    >
                      {checkingOut === plan.id ? "Starting…" : "Upgrade →"}
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>

          {/* Annual savings hint */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "24px" }}>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: "6px",
              fontSize: "12px", fontWeight: 600, fontFamily: THEME.fontSans,
              color: THEME.accentHi, background: THEME.accentDim,
              border: `1px solid ${THEME.accent}33`,
              padding: "5px 12px", borderRadius: "999px",
            }}>
              <span aria-hidden="true" style={{ width: "6px", height: "6px", borderRadius: "50%", background: THEME.accent }} />
              Save ~20% with annual billing
            </span>
          </div>

          {/* What you unlock */}
          <div style={{ marginBottom: "20px" }}>
            <div style={{
              fontSize: "13px", fontWeight: 600, color: THEME.text,
              marginBottom: "12px", fontFamily: THEME.fontSans,
            }}>
              Everything you unlock
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "9px" }}>
              {[
                "Unlimited humanizations (within plan)",
                "4 tone modes",
                "History & saved documents",
                "Priority processing",
              ].map((f) => (
                <div key={f} style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "13px", color: THEME.textDim, fontFamily: THEME.fontSans }}>
                  <span style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    width: "18px", height: "18px", borderRadius: "50%",
                    background: THEME.humanDim, flexShrink: 0,
                  }}>
                    <Check size={12} color={THEME.human} aria-hidden="true" strokeWidth={3} />
                  </span>
                  {f}
                </div>
              ))}
            </div>
          </div>

          {/* Discount code */}
          <div className="redeem-row" style={{ marginBottom: "20px" }}>
            <div style={{
              fontSize: "13px", fontWeight: 600, color: THEME.text,
              marginBottom: "8px", fontFamily: THEME.fontSans,
            }}>
              Have a discount code?
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Enter code"
                aria-label="Discount code"
                className="mono"
                style={{
                  flex: 1, padding: "10px 12px", borderRadius: THEME.radius,
                  background: THEME.surface1, border: `1px solid ${THEME.border}`,
                  color: THEME.text, fontSize: "13px", outline: "none", letterSpacing: "0.04em",
                }}
              />
              <button
                onClick={handleRedeem}
                disabled={redeeming || !code.trim()}
                style={{
                  padding: "10px 16px", borderRadius: THEME.radius, border: "none",
                  background: code.trim() ? THEME.brand : THEME.surface3,
                  color: code.trim() ? "#ffffff" : THEME.textMuted, fontSize: "13px", fontWeight: 600,
                  cursor: code.trim() ? "pointer" : "not-allowed",
                  fontFamily: THEME.fontSans,
                }}
              >
                {redeeming ? "..." : "Apply"}
              </button>
            </div>
            {codeStatus && (
              <div
                aria-live="polite"
                style={{
                  marginTop: "8px", fontSize: "12px", fontWeight: 500, fontFamily: THEME.fontSans,
                  color: codeStatus.type === "success" ? THEME.human : THEME.ai,
                }}
              >
                {codeStatus.message}
              </div>
            )}
          </div>

          {/* Maybe later */}
          <button
            onClick={onClose}
            style={{
              width: "100%", padding: "10px", borderRadius: THEME.radius,
              background: "transparent", border: `1px solid ${THEME.border}`,
              color: THEME.textDim, fontSize: "13px", cursor: "pointer",
              fontFamily: THEME.fontSans,
            }}
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}
