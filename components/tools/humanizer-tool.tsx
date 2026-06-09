"use client";

import { useState } from "react";
import Link from "next/link";
import { THEME, humanScore, humanScoreColor, glow } from "@/lib/theme";

const MAX_WORDS = 300;
const TONES = ["standard", "formal", "casual", "academic", "professional"] as const;

interface HumanizeResponse {
  humanizedText?: string;
  beforeScore?: number;
  afterScore?: number;
  error?: { code: string; message: string };
  signupCta?: boolean;
}

/**
 * Free, no-signup humanizer. Calls the capped POST /api/public/humanize
 * (anonymous, IP-rate-limited, 300-word cap). On the daily cap it surfaces a
 * sign-up CTA. Real per-document humanizing lives behind auth in the dashboard.
 */
export function HumanizerTool() {
  const [text, setText] = useState("");
  const [tone, setTone] = useState<(typeof TONES)[number]>("standard");
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<HumanizeResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const words = text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;
  const overCap = words > MAX_WORDS;
  const canRun = words >= 5 && !overCap && !loading;

  async function run() {
    setLoading(true);
    setRes(null);
    setCopied(false);
    try {
      const r = await fetch("/api/public/humanize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, tone }),
      });
      setRes((await r.json()) as HumanizeResponse);
    } catch {
      setRes({ error: { code: "NETWORK", message: "Something went wrong. Please try again." } });
    } finally {
      setLoading(false);
    }
  }

  const result = res?.humanizedText ? res : null;
  const err = res?.error ? res : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div style={{ background: THEME.surface2, border: `1px solid ${THEME.border}`, borderRadius: THEME.radiusLg, padding: "18px" }}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste your AI-generated text here to humanize it for free…"
          aria-label="Text to humanize"
          style={{
            width: "100%", minHeight: "180px", background: "transparent", border: "none", outline: "none",
            resize: "vertical", fontSize: "15px", color: THEME.text, lineHeight: 1.7, fontFamily: THEME.fontSans,
          }}
        />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "12px", flexWrap: "wrap", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "13px", color: overCap ? THEME.warn : THEME.textMuted }}>
              {words} / {MAX_WORDS} words
            </span>
            <select
              value={tone}
              onChange={(e) => setTone(e.target.value as (typeof TONES)[number])}
              aria-label="Tone"
              style={{
                fontSize: "13px", color: THEME.textDim, background: THEME.surface1,
                border: `1px solid ${THEME.border}`, borderRadius: THEME.radius, padding: "6px 10px",
                fontFamily: THEME.fontSans,
              }}
            >
              {TONES.map((t) => (
                <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)} tone</option>
              ))}
            </select>
          </div>
          <button
            onClick={run}
            disabled={!canRun}
            style={{
              background: canRun ? THEME.brand : THEME.border, color: "#fff", fontSize: "14px", fontWeight: 600,
              padding: "9px 24px", borderRadius: THEME.radius, border: "none",
              cursor: canRun ? "pointer" : "not-allowed", fontFamily: THEME.fontSans,
            }}
          >
            {loading ? "Humanizing…" : "Humanize free →"}
          </button>
        </div>
        {overCap && (
          <p style={{ fontSize: "13px", color: THEME.warn, margin: "10px 0 0" }}>
            The free humanizer is capped at {MAX_WORDS} words.{" "}
            <Link href="/sign-up" style={{ color: THEME.brandHi }}>Sign up free</Link> to humanize longer text.
          </p>
        )}
      </div>

      {err && (
        <div style={{ background: THEME.surface1, border: `1px solid ${THEME.border}`, borderRadius: THEME.radiusLg, padding: "22px", textAlign: "center" }}>
          <p style={{ fontSize: "15px", color: THEME.textDim, margin: "0 0 14px" }}>{err.error!.message}</p>
          {err.signupCta && (
            <Link
              href="/sign-up"
              style={{
                display: "inline-block", background: THEME.gradient, color: "#fff", fontWeight: 700, fontSize: "14px",
                padding: "10px 24px", borderRadius: THEME.radius, textDecoration: "none", boxShadow: glow(THEME.brand, 0.3),
              }}
            >
              Sign up free for more &rarr;
            </Link>
          )}
        </div>
      )}

      {result && (
        <div style={{ background: THEME.surface1, border: `1px solid ${THEME.border}`, borderRadius: THEME.radiusLg, padding: "22px" }}>
          <div style={{ display: "flex", gap: "16px", alignItems: "center", marginBottom: "16px", flexWrap: "wrap" }}>
            <ScorePill label="Before" score={result.beforeScore ?? 0} />
            <span aria-hidden="true" style={{ color: THEME.textMuted }}>&rarr;</span>
            <ScorePill label="After" score={result.afterScore ?? 0} />
            <span style={{ fontSize: "13px", color: THEME.textDim, marginLeft: "auto" }}>
              Higher = more human
            </span>
          </div>
          <div
            style={{
              background: THEME.surface2, border: `1px solid ${THEME.border}`, borderRadius: THEME.radius,
              padding: "16px", fontSize: "15px", color: THEME.text, lineHeight: 1.7, whiteSpace: "pre-wrap",
            }}
          >
            {result.humanizedText}
          </div>
          <div style={{ display: "flex", gap: "12px", marginTop: "14px", flexWrap: "wrap" }}>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(result.humanizedText ?? "");
                setCopied(true);
              }}
              style={{
                background: THEME.surface2, color: THEME.text, border: `1px solid ${THEME.border}`,
                fontSize: "13px", fontWeight: 600, padding: "8px 16px", borderRadius: THEME.radius, cursor: "pointer",
                fontFamily: THEME.fontSans,
              }}
            >
              {copied ? "Copied ✓" : "Copy result"}
            </button>
            <Link
              href="/sign-up"
              style={{
                background: THEME.brand, color: "#fff", fontSize: "13px", fontWeight: 600, padding: "8px 18px",
                borderRadius: THEME.radius, textDecoration: "none",
              }}
            >
              Get unlimited &rarr;
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function ScorePill({ label, score }: { label: string; score: number }) {
  const human = humanScore(score);
  const color = humanScoreColor(human);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
      <span style={{ fontSize: "11px", color: THEME.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
      <span style={{ fontSize: "22px", fontWeight: 700, color, fontFamily: THEME.fontHeading, fontVariantNumeric: "tabular-nums" }}>
        {human}<span style={{ fontSize: "13px", color: THEME.textMuted }}>/100</span>
      </span>
    </div>
  );
}
