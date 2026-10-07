"use client";

// ===========================================================
// components/growth/founding-cta.tsx — The /lifetime call to action, in one
// of three honest states decided on the server:
//   open      → checkout (signed out: sign up first, then come back here)
//   waitlist  → the LemonSqueezy product doesn't exist yet: reserve a spot
//               through the lead form (source founding_waitlist)
//   closed    → all 100 spots are taken; no form, no fake "last chance"
// ===========================================================

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2 } from "lucide-react";
import { THEME, glow } from "@/lib/theme";
import { FOUNDING } from "@/lib/plans";
import { LeadCaptureForm } from "@/components/growth/lead-capture-form";
import { startOfferCheckout } from "@/components/growth/founding-offers";

export type FoundingCtaState = "open" | "waitlist" | "closed";

export function FoundingCta({ state, signedIn }: { state: FoundingCtaState; signedIn: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (state === "closed") {
    return (
      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: 15, color: THEME.text, fontWeight: 600, margin: "0 0 12px" }}>{`All ${FOUNDING.seats} founding spots are taken. Founding ${FOUNDING.seats} is closed for good.`}</p>
        <Link href="/#pricing" style={secondaryBtn}>See the regular plans</Link>
      </div>
    );
  }

  if (state === "waitlist") {
    return (
      <div style={{ maxWidth: 460, margin: "0 auto" }}>
        <p style={{ fontSize: 14, color: THEME.textDim, textAlign: "center", margin: "0 0 12px", lineHeight: 1.6 }}>
          Checkout opens soon. Leave your email and we&apos;ll tell you when it does.
        </p>
        <LeadCaptureForm source="founding_waitlist" requiredTopic="tips" variant="card" ctaLabel="Get on the founding list" thing="the Founding 100 launch email" />
      </div>
    );
  }

  async function buy() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const message = await startOfferCheckout("founding");
    if (message) {
      setError(message);
      setBusy(false);
    }
  }

  return (
    <div style={{ textAlign: "center" }}>
      {signedIn ? (
        <button onClick={buy} disabled={busy} style={primaryBtn}>
          {busy ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : null}
          {busy ? "Starting checkout…" : `Become a founding member: $${FOUNDING.priceUsd}`}
          {!busy && <ArrowRight size={16} aria-hidden="true" />}
        </button>
      ) : (
        <Link href="/sign-up?redirect_url=/lifetime" style={primaryBtn}>
          {`Become a founding member: $${FOUNDING.priceUsd}`} <ArrowRight size={16} aria-hidden="true" />
        </Link>
      )}
      <p style={{ fontSize: 12, color: THEME.textMuted, margin: "10px 0 0" }}>
        {signedIn ? "One payment. Nothing renews automatically." : "Create your free account first (or sign in), then you'll come back here to pay."}
      </p>
      {error && <p role="alert" style={{ fontSize: 13, color: THEME.ai, margin: "10px 0 0" }}>{error}</p>}
    </div>
  );
}

const primaryBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
  background: THEME.gradient, color: "#fff", border: "none", borderRadius: THEME.radius,
  padding: "14px 26px", fontSize: 15, fontWeight: 700, cursor: "pointer", textDecoration: "none",
  boxShadow: glow(THEME.brand, 0.34), fontFamily: THEME.fontSans,
};
const secondaryBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6, padding: "11px 20px", borderRadius: THEME.radius,
  border: `1px solid ${THEME.borderStrong}`, color: THEME.brand, fontWeight: 600, fontSize: 14, textDecoration: "none",
};
