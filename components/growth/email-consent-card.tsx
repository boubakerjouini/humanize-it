"use client";

// ===========================================================
// components/growth/email-consent-card.tsx — The one-time in-app opt-in for
// writing tips, asked right after a first successful rewrite (ask after
// value). The box starts unticked; Save without a tick and Not now both just
// record that we asked, so the card never comes back (the server keeps
// consentPromptedAt). The label is CONSENT_WORDING["inapp-tips-v1"] verbatim,
// because the ConsentRecord stores that wording id as proof.
// ===========================================================

import { useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { Mail } from "lucide-react";
import { THEME } from "@/lib/theme";
import { CONSENT_WORDING } from "@/lib/growth/constants";

type Prefs = { prompt: boolean };

/**
 * `onVisibleChange` fires once the prompt check resolved (false on any error)
 * and again when the card closes, so the parent can show something else
 * (the share chip) only when this card isn't taking the slot.
 */
export function EmailConsentCard({ onVisibleChange }: { onVisibleChange?: (visible: boolean) => void }) {
  const [visible, setVisible] = useState(false);
  const [resolved, setResolved] = useState(false);
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const checkboxId = useId();

  useEffect(() => {
    let alive = true;
    fetch("/api/me/email-preferences")
      .then((r) => (r.ok ? (r.json() as Promise<Prefs>) : null))
      .then((d) => {
        if (!alive) return;
        setVisible(!!d?.prompt);
        setResolved(true);
      })
      .catch(() => {
        if (alive) setResolved(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (resolved) onVisibleChange?.(visible);
  }, [resolved, visible, onVisibleChange]);

  async function answer(subscribe: boolean) {
    setSaving(true);
    try {
      const res = await fetch("/api/me/email-preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscribe: subscribe ? ["tips"] : [], dismissPrompt: true, source: "consent_card" }),
      });
      if (!res.ok) throw new Error(String(res.status));
      if (subscribe) toast.success("Subscribed. You can unsubscribe any time in Settings.");
      setVisible(false);
    } catch {
      toast.error("Couldn't save that. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (!visible) return null;

  return (
    <section aria-label="Email tips" style={{ background: THEME.surface2, border: `1px solid ${THEME.border}`, borderRadius: THEME.radius, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10, fontFamily: THEME.fontSans }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <Mail size={16} color={THEME.brand} aria-hidden="true" />
        <span style={{ fontSize: 14, fontWeight: 700, color: THEME.text }}>
          Want writing tips and early access? About 2 emails a month.
        </span>
      </div>
      <label htmlFor={checkboxId} style={{ display: "flex", alignItems: "flex-start", gap: 9, fontSize: 13, color: THEME.textDim, cursor: "pointer", lineHeight: 1.5 }}>
        <input
          id={checkboxId}
          type="checkbox"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          style={{ marginTop: 3, accentColor: THEME.brand }}
        />
        {CONSENT_WORDING["inapp-tips-v1"]}
      </label>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={() => answer(checked)}
          disabled={saving}
          style={{ background: THEME.brand, color: "#fff", border: "none", borderRadius: 8, padding: "7px 16px", fontSize: 13, fontWeight: 700, cursor: saving ? "wait" : "pointer" }}
        >
          Save
        </button>
        <button
          onClick={() => answer(false)}
          disabled={saving}
          style={{ background: "transparent", color: THEME.textDim, border: `1px solid ${THEME.border}`, borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 600, cursor: saving ? "wait" : "pointer" }}
        >
          Not now
        </button>
      </div>
    </section>
  );
}
