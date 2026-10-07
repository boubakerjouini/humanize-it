"use client";

// ===========================================================
// app/email/preferences/preferences-form.tsx — The preference center form.
// Topic checkboxes, the account-email toggle, and one prominent "unsubscribe
// from everything" button (highlighted when the visitor came from an
// Unsubscribe link). Changes apply as soon as they are saved.
// ===========================================================

import { useId, useState, type CSSProperties } from "react";
import type { PreferencesView } from "@/lib/email/preferences";
import type { Topic } from "@/lib/growth/constants";
import { THEME } from "@/lib/theme";

type Props = { token: string; initial: PreferencesView; highlightUnsubscribe: boolean };

const card: CSSProperties = {
  background: THEME.surface2,
  border: `1px solid ${THEME.border}`,
  borderRadius: THEME.radiusLg,
  padding: "24px 22px",
};

const button: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 44,
  padding: "10px 18px",
  borderRadius: 10,
  fontSize: 15,
  fontWeight: 600,
  cursor: "pointer",
};

const TOPIC_HELP: Record<Topic, string> = {
  tips: "Practical writing tips and, sometimes, an offer. About two emails a month.",
  extension_launch: "Updates on the Chrome extension, and the launch email.",
};

export function PreferencesForm({ token, initial, highlightUnsubscribe }: Props) {
  const [prefs, setPrefs] = useState(initial);
  const [topics, setTopics] = useState<Set<Topic>>(() => new Set(initial.topics.filter((t) => t.subscribed).map((t) => t.topic)));
  const [lifecycle, setLifecycle] = useState(initial.lifecycle.enabled);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const statusId = useId();

  const everythingOff = topics.size === 0 && (!prefs.lifecycle.applicable || !lifecycle);

  async function save(all: boolean) {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/email/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ t: token, topics: all ? [] : [...topics], lifecycle: all ? false : lifecycle, all }),
      });
      const data = (await res.json().catch(() => null)) as { preferences?: PreferencesView; error?: { message?: string } } | null;
      if (!res.ok || !data?.preferences) {
        setStatus({ kind: "error", text: data?.error?.message ?? "Could not save. Please try again." });
        return;
      }
      const next = data.preferences;
      setPrefs(next);
      setTopics(new Set(next.topics.filter((t) => t.subscribed).map((t) => t.topic)));
      setLifecycle(next.lifecycle.enabled);
      setStatus({
        kind: "ok",
        text: all
          ? "You're unsubscribed. From now on you only get billing receipts and emails you ask for yourself."
          : "Saved. Your choices apply right away.",
      });
    } catch {
      setStatus({ kind: "error", text: "Network error. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  const toggleTopic = (topic: Topic, on: boolean) =>
    setTopics((prev) => {
      const next = new Set(prev);
      if (on) next.add(topic);
      else next.delete(topic);
      return next;
    });

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={card}>
        <h1 style={{ fontFamily: THEME.fontHeading, fontSize: 22, fontWeight: 700, margin: "0 0 6px", letterSpacing: "-0.01em" }}>
          Email preferences
        </h1>
        <p style={{ fontSize: 15, color: THEME.textDim, margin: 0 }}>
          For <strong style={{ color: THEME.text }}>{prefs.maskedEmail}</strong>
        </p>
        {!prefs.deliverable ? (
          <p style={{ fontSize: 14, color: THEME.textDim, margin: "10px 0 0" }}>
            Earlier emails to this address bounced or were reported, so we only send what you explicitly request.
          </p>
        ) : null}
      </div>

      {highlightUnsubscribe ? (
        <div style={{ ...card, borderColor: THEME.brand, boxShadow: `0 0 0 3px ${THEME.brandDim}` }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 6px" }}>Unsubscribe</h2>
          <p style={{ fontSize: 15, lineHeight: 1.6, color: THEME.textDim, margin: "0 0 14px" }}>
            One click stops every tip, update and account email. Billing receipts and anything you ask for yourself (like
            a report or a guide) still arrive.
          </p>
          <button
            type="button"
            onClick={() => void save(true)}
            disabled={busy}
            aria-describedby={statusId}
            style={{ ...button, border: "none", background: THEME.brand, color: "#fff", opacity: busy ? 0.6 : 1 }}
          >
            {busy ? "Saving…" : "Unsubscribe from everything except account and billing notices"}
          </button>
        </div>
      ) : null}

      <form
        style={card}
        onSubmit={(e) => {
          e.preventDefault();
          void save(false);
        }}
      >
        <fieldset style={{ border: "none", margin: 0, padding: 0 }}>
          <legend style={{ fontSize: 17, fontWeight: 700, marginBottom: 12, padding: 0 }}>What you get from us</legend>
          <div style={{ display: "grid", gap: 14 }}>
            {prefs.topics.map((t) => (
              <label key={t.topic} style={{ display: "flex", gap: 12, alignItems: "flex-start", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={topics.has(t.topic)}
                  onChange={(e) => toggleTopic(t.topic, e.target.checked)}
                  style={{ width: 20, height: 20, marginTop: 2, accentColor: THEME.brand, flexShrink: 0 }}
                />
                <span>
                  <span style={{ display: "block", fontSize: 15, fontWeight: 600 }}>{t.label.charAt(0).toUpperCase() + t.label.slice(1)}</span>
                  <span style={{ display: "block", fontSize: 14, color: THEME.textDim, marginTop: 2 }}>
                    {TOPIC_HELP[t.topic]}
                    {t.pending ? " Waiting for your confirmation: ticking it here confirms it." : ""}
                  </span>
                </span>
              </label>
            ))}
            {prefs.lifecycle.applicable ? (
              <label style={{ display: "flex", gap: 12, alignItems: "flex-start", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={lifecycle}
                  onChange={(e) => setLifecycle(e.target.checked)}
                  style={{ width: 20, height: 20, marginTop: 2, accentColor: THEME.brand, flexShrink: 0 }}
                />
                <span>
                  <span style={{ display: "block", fontSize: 15, fontWeight: 600 }}>Account emails</span>
                  <span style={{ display: "block", fontSize: 14, color: THEME.textDim, marginTop: 2 }}>
                    Getting started tips, plan and access reminders, and the occasional note from the founder.
                  </span>
                </span>
              </label>
            ) : null}
          </div>
        </fieldset>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18 }}>
          <button
            type="submit"
            disabled={busy}
            aria-describedby={statusId}
            style={{ ...button, border: "none", background: THEME.brand, color: "#fff", opacity: busy ? 0.6 : 1 }}
          >
            {busy ? "Saving…" : "Save preferences"}
          </button>
          {!highlightUnsubscribe && !everythingOff ? (
            <button
              type="button"
              onClick={() => void save(true)}
              disabled={busy}
              style={{ ...button, border: `1px solid ${THEME.border}`, background: THEME.surface2, color: THEME.textDim }}
            >
              Unsubscribe from everything
            </button>
          ) : null}
        </div>
      </form>

      <p
        id={statusId}
        role="status"
        aria-live="polite"
        style={{
          fontSize: 14,
          margin: 0,
          minHeight: 20,
          color: status?.kind === "error" ? THEME.ai : THEME.human,
        }}
      >
        {status?.text ?? ""}
      </p>
      <p style={{ fontSize: 13, color: THEME.textMuted, margin: 0 }}>
        Receipts and emails you request still arrive. Changes take effect immediately.
      </p>
    </div>
  );
}
