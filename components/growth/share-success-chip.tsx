"use client";

// ===========================================================
// components/growth/share-success-chip.tsx — Ask for a referral at the moment
// of success (a finished rewrite), never before. Shown at most once per day
// per browser and only while the referral program is on. The once-a-day mark
// lives in localStorage: losing it just means the chip may show again.
// ===========================================================

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Gift, X } from "lucide-react";
import { THEME } from "@/lib/theme";
import { copyReferralLink, useReferralInfo } from "@/components/growth/referral-card";

const SHOWN_KEY = "hz_share_chip_day";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function shownToday(): boolean {
  try {
    return localStorage.getItem(SHOWN_KEY) === today();
  } catch {
    return false;
  }
}

function markShown(): void {
  try {
    localStorage.setItem(SHOWN_KEY, today());
  } catch {
    /* storage blocked: the chip may show again, which is harmless */
  }
}

export function ShareSuccessChip() {
  const info = useReferralInfo();
  // Decided once per mount, before the mark below can flip it. The server
  // renders nothing either way (info is null until the client fetch resolves).
  const [eligible] = useState(() => typeof window !== "undefined" && !shownToday());
  const [dismissed, setDismissed] = useState(false);
  const visible = !!info?.link && eligible && !dismissed;

  useEffect(() => {
    if (visible) markShown();
  }, [visible]);

  if (!info?.link || !visible) return null;
  const link = info.link;

  async function copy() {
    if (await copyReferralLink(link)) toast.success("Invite link copied");
    else toast.error("Couldn't copy the link. Find it in Settings → Invite friends.");
  }

  return (
    <div role="status" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", background: THEME.accentDim, border: `1px solid ${THEME.accent}33`, borderRadius: THEME.radius, padding: "10px 14px", fontFamily: THEME.fontSans }}>
      <Gift size={16} color={THEME.accentHi} aria-hidden="true" />
      <span style={{ fontSize: 13, color: THEME.text, flex: 1, minWidth: 200 }}>
        {`Know someone who writes a lot? Invite them and you both get ${info.rewardWords.toLocaleString("en-US")} bonus words.`}
      </span>
      <button onClick={copy} style={{ background: THEME.surface2, color: THEME.accentHi, border: `1px solid ${THEME.accent}55`, borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
        Copy invite link
      </button>
      <button onClick={() => setDismissed(true)} aria-label="Dismiss" style={{ display: "inline-flex", background: "transparent", border: "none", color: THEME.textMuted, cursor: "pointer", padding: 4 }}>
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  );
}
