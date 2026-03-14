"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Loader2 } from "lucide-react";
import { track } from "@vercel/analytics";
import posthog from "posthog-js";

const V = {
  brand: "#7e22ce",
};

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
      router.push(`/sign-up?redirect_url=/dashboard`);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, annual }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error("[PricingButton] no checkout URL", data);
        setLoading(false);
      }
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
        padding: "10px",
        borderRadius: "12px",
        fontSize: "13px",
        fontWeight: 600,
        background: isPro ? "#ffffff" : "transparent",
        color: isPro ? V.brand : "#4b5563",
        border: isPro ? "none" : "1px solid #e5e7eb",
        cursor: loading ? "wait" : "pointer",
        opacity: loading ? 0.7 : 1,
      }}
    >
      {loading && <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />}
      {loading ? "Redirecting…" : label}
    </button>
  );
}
