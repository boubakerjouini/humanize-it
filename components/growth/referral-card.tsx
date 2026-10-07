"use client";

// ===========================================================
// components/growth/referral-card.tsx — "Invite friends": the user's referral
// link, a copy button, share links and their stats. Rendered only while the
// program is on (GET /api/me/referral says enabled); every surface that shows
// it (workspace sidebar dialog, settings, the result-screen chip) reads the
// same cached request through useReferralInfo().
// ===========================================================

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Copy, Gift, Mail } from "lucide-react";
import { THEME } from "@/lib/theme";

export type ReferralInfo = {
  enabled: boolean;
  code: string | null;
  link: string | null;
  rewardWords: number;
  referred: number;
  rewarded: number;
  bonusWords: number;
};

// One request per page load, shared by every component that asks.
let cached: Promise<ReferralInfo | null> | null = null;

function loadReferralInfo(): Promise<ReferralInfo | null> {
  if (!cached) {
    cached = fetch("/api/me/referral")
      .then((r) => (r.ok ? (r.json() as Promise<ReferralInfo>) : null))
      .catch(() => null);
  }
  return cached;
}

/** The signed-in user's referral data, or null while loading, on error, or when the program is off. */
export function useReferralInfo(): ReferralInfo | null {
  const [info, setInfo] = useState<ReferralInfo | null>(null);
  useEffect(() => {
    let alive = true;
    void loadReferralInfo().then((d) => {
      if (alive && d?.enabled && d.link) setInfo(d);
    });
    return () => {
      alive = false;
    };
  }, []);
  return info;
}

export function shareMessage(info: Pick<ReferralInfo, "rewardWords">): string {
  return `I check my writing with HumanizeIt before I send it. Sign up with my link and we both get ${info.rewardWords.toLocaleString("en-US")} bonus words:`;
}

/** Copy the referral link; resolves true when it reached the clipboard. */
export async function copyReferralLink(link: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(link);
    return true;
  } catch {
    return false;
  }
}

export function ReferralCard({ info, compact = false }: { info: ReferralInfo; compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  const link = info.link ?? "";
  const words = info.rewardWords.toLocaleString("en-US");
  const message = shareMessage(info);

  async function copy() {
    if (await copyReferralLink(link)) {
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error("Couldn't copy. Select the link and copy it instead.");
    }
  }

  const shares = [
    { label: "X", href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${message} ${link}`)}` },
    { label: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(link)}` },
    { label: "WhatsApp", href: `https://wa.me/?text=${encodeURIComponent(`${message} ${link}`)}` },
  ];
  const mailto = `mailto:?subject=${encodeURIComponent("Try HumanizeIt with my link")}&body=${encodeURIComponent(`${message}\n${link}`)}`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, fontFamily: THEME.fontSans }}>
      {!compact && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 10, background: THEME.accentDim, flexShrink: 0 }}>
            <Gift size={17} color={THEME.accentHi} aria-hidden="true" />
          </span>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: THEME.text }}>{`You both get ${words} words`}</div>
            <p style={{ fontSize: 13, color: THEME.textDim, margin: "3px 0 0", lineHeight: 1.5 }}>
              When a friend signs up with your link and runs their first check, you each get {words} bonus words. They never
              expire and kick in once your plan&apos;s allowance runs out.
            </p>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          readOnly
          value={link}
          aria-label="Your referral link"
          onFocus={(e) => e.currentTarget.select()}
          className="mono"
          style={{ flex: 1, minWidth: 0, border: `1px solid ${THEME.border}`, borderRadius: 8, padding: "9px 12px", fontSize: 13, color: THEME.text, background: THEME.surface1, outline: "none" }}
        />
        <button onClick={copy} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: THEME.brand, color: "#fff", border: "none", borderRadius: 8, padding: "9px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, color: THEME.textMuted }}>Share on</span>
        {shares.map((s) => (
          <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" style={shareLink}>
            {s.label}
          </a>
        ))}
        <a href={mailto} style={shareLink}>
          <Mail size={12} aria-hidden="true" /> Email
        </a>
      </div>

      <div className="tnum" style={{ fontSize: 12, color: THEME.textMuted }}>
        {`${info.referred} signed up · ${info.rewarded} rewarded · up to 10 rewards every 30 days`}
      </div>
    </div>
  );
}

const shareLink: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  padding: "5px 11px",
  borderRadius: 999,
  background: THEME.surface2,
  border: `1px solid ${THEME.border}`,
  color: THEME.brandHi,
  fontSize: 12,
  fontWeight: 600,
  textDecoration: "none",
};
