"use client";

// ===========================================================
// components/pricing-button.tsx — A paid plan's button on the home page
// pricing section. Signed out, it keeps the pick through sign-up; signed in,
// it starts Polar checkout. While payments are paused the server's message
// shows as a toast instead of a silent failure.
// ===========================================================

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { track } from "@vercel/analytics";
import posthog from "posthog-js";
import { THEME, glow } from "@/lib/theme";
import { signUpUrlFor } from "@/lib/checkout-intent";
import { requestCheckout } from "@/components/checkout-outcome";

interface PricingButtonProps {
  plan: "PRO" | "TEAM";
  annual: boolean;
  isPro: boolean; // visual style: highlighted card
  label: string;
}

export function PricingButton({ plan, annual, isPro, label }: PricingButtonProps) {
  const { isSignedIn } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    track("pricing_cta_clicked", { plan, annual: annual ? "true" : "false" });
    posthog.capture("landing_plan_selected", { plan, annual: annual ? "true" : "false" });

    if (!isSignedIn) {
      // Keep the pick through sign-up: the new account lands on the plan menu with it selected.
      router.push(signUpUrlFor({ plan, annual }));
      return;
    }

    setLoading(true);
    try {
      const outcome = await requestCheckout(plan, annual);
      if (outcome.kind === "redirect") {
        window.location.href = outcome.url;
        return;
      }
      if (outcome.kind === "paused") toast(outcome.message);
      else console.error("[PricingButton] no checkout URL", outcome.body);
      setLoading(false);
    } catch (err) {
      console.error("[PricingButton] fetch error", err);
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        width: "100%",
        textAlign: "center",
        padding: "11px",
        borderRadius: THEME.radius,
        fontSize: "13px",
        fontWeight: isPro ? 700 : 600,
        fontFamily: THEME.fontSans,
        background: isPro ? THEME.gradient : THEME.surface2,
        color: isPro ? "#ffffff" : THEME.brandHi,
        border: isPro ? "none" : `1px solid ${THEME.borderStrong}`,
        boxShadow: isPro ? glow(THEME.brand, 0.32) : "none",
        cursor: loading ? "wait" : "pointer",
        opacity: loading ? 0.7 : 1,
      }}
    >
      {loading && <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} aria-hidden="true" />}
      {loading ? "Redirecting…" : label}
    </button>
  );
}
