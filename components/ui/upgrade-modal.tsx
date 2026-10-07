"use client";

// ===========================================================
// components/ui/upgrade-modal.tsx — The plan menu: opened from upgrade buttons
// and, with trigger="quota", when a request hits the plan's limit. A
// Monthly/Annual toggle sends { plan, annual } to /api/checkout; annual prices
// are shown per month (≈$6.58/mo for Pro). Prices and limits come from
// lib/plans.ts.
// ===========================================================

import { useState, useEffect, useRef } from "react";
import { usePostHog } from "posthog-js/react";
import { track } from "@vercel/analytics";
import { Check, X } from "lucide-react";
import { THEME, glow } from "@/lib/theme";
import { PLANS as PLAN_CONFIG, type PlanConfig } from "@/lib/plans";

export type UpgradeTrigger = "upgrade" | "quota";
type Billing = "monthly" | "annual";

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPlan: string;
  /** "quota": opened because a request hit the plan's limit (changes the header copy). */
  trigger?: UpgradeTrigger;
}

const PLAN_IDS = ["FREE", "PRO", "TEAM"] as const;

function fmtUsd(amount: number): string {
  return Number.isInteger(amount) ? `$${amount}` : `$${amount.toFixed(2)}`;
}

function fmtWords(plan: PlanConfig): string {
  const n = plan.wordsLimit >= 1000 ? `${plan.wordsLimit / 1000}k` : String(plan.wordsLimit);
  return `${n} words/${plan.wordsLimitPeriod === "day" ? "day" : "mo"}`;
}

/** Price shown on a card: the annual price spread per month (checkout bills it once a year). */
function displayPrice(plan: PlanConfig, billing: Billing): { price: string; note: string | null } {
  if (plan.price === 0) return { price: "$0", note: null };
  if (billing === "annual" && plan.priceAnnual) {
    return {
      price: `≈${fmtUsd(Math.round((plan.priceAnnual / 12) * 100) / 100)}`,
      note: `${fmtUsd(plan.priceAnnual)} billed yearly`,
    };
  }
  return { price: fmtUsd(plan.price), note: "billed monthly" };
}

/** Annual saving vs 12 monthly payments for Pro, e.g. 27. */
const ANNUAL_SAVING_PCT = (() => {
  const pro = PLAN_CONFIG.PRO;
  return pro.priceAnnual ? Math.round((1 - pro.priceAnnual / (pro.price * 12)) * 100) : 0;
})();

export function UpgradeModal({ isOpen, onClose, currentPlan, trigger = "upgrade" }: UpgradeModalProps) {
  const posthog = usePostHog();
  const [code, setCode] = useState("");
  const [codeStatus, setCodeStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [redeeming, setRedeeming] = useState(false);
  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const [billing, setBilling] = useState<Billing>("monthly");
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  async function handleUpgrade(planId: string) {
    if (checkingOut) return;
    setCheckingOut(planId);
    const annual = billing === "annual";
    posthog?.capture("upgrade_cta_clicked", { plan: planId, current_plan: currentPlan, annual, trigger });
    track("upgrade_cta_clicked", { plan: planId, annual });
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId, annual }),
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
      posthog?.capture("upgrade_modal_viewed", { current_plan: currentPlan, trigger });
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

          <div className="kicker" style={{ marginBottom: "10px" }}>{trigger === "quota" ? "Limit reached" : "Nice work"}</div>
          <h2
            id="upgrade-modal-title"
            style={{ fontSize: "22px", fontWeight: 700, color: THEME.text, marginBottom: "6px", fontFamily: THEME.fontHeading, letterSpacing: "-0.02em" }}
          >
            {trigger === "quota" ? (
              <>Keep going <span style={{ color: THEME.accent }}>today</span></>
            ) : (
              <>Keep your writing <span style={{ color: THEME.accent }}>sounding like you</span></>
            )}
          </h2>
          <p style={{ fontSize: "14px", color: THEME.textDim, fontFamily: THEME.fontSans }}>
            {trigger !== "quota"
              ? "More words, unlimited rewrites, document upload and saved history."
              : currentPlan.toUpperCase() === "FREE"
                ? "Free words reset 24 hours after your last reset. Need more now? Pick monthly or annual."
                : "You've used this month's words. They reset with your next billing month, or you can move up a plan."}
          </p>
        </div>

        <div style={{ padding: "24px 32px 32px" }}>
          {/* Billing toggle */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "18px" }}>
            <div role="radiogroup" aria-label="Billing period" style={{ display: "inline-flex", background: THEME.surface3, borderRadius: "999px", padding: "3px", gap: "2px" }}>
              {(["monthly", "annual"] as const).map((b) => {
                const active = billing === b;
                return (
                  <button
                    key={b}
                    role="radio"
                    aria-checked={active}
                    onClick={() => setBilling(b)}
                    style={{
                      border: "none", cursor: "pointer", borderRadius: "999px", padding: "6px 14px",
                      fontSize: "12px", fontWeight: active ? 700 : 500, fontFamily: THEME.fontSans,
                      background: active ? THEME.surface2 : "transparent",
                      color: active ? THEME.text : THEME.textDim,
                      boxShadow: active ? "0 1px 3px rgba(29,23,38,0.12)" : "none",
                    }}
                  >
                    {b === "monthly" ? "Monthly" : `Annual · save ${ANNUAL_SAVING_PCT}%`}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Plan cards */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "14px 10px", marginBottom: "8px" }}>
            {PLAN_IDS.map((id) => {
              const plan = { ...PLAN_CONFIG[id], popular: id === "PRO" };
              const { price, note } = displayPrice(plan, billing);
              const isCurrent = currentPlan.toUpperCase() === plan.id;
              const isPro = plan.id === "PRO";
              const isFree = plan.id === "FREE";
              return (
                <div
                  key={plan.id}
                  style={{
                    flex: "1 1 130px", minWidth: 0,
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
                  <div className="tnum" style={{ fontSize: "26px", fontWeight: 700, color: isPro ? THEME.brandHi : THEME.text, lineHeight: 1 }}>
                    {price}
                    {!isFree && <span className="tnum" style={{ fontSize: "13px", fontWeight: 400, color: THEME.textMuted }}>/mo</span>}
                  </div>
                  <div className="tnum" style={{ fontSize: "11px", color: THEME.textMuted, marginTop: "4px", minHeight: "14px" }}>
                    {note}
                  </div>
                  <div className="tnum" style={{ fontSize: "12px", color: THEME.textDim, margin: "6px 0 12px" }}>
                    {fmtWords(plan)}
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

          <div style={{ marginBottom: "22px" }} />

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
                "Unlimited rewrites (within your plan's words)",
                "More tones",
                "PDF and Word upload",
                "Saved history",
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
