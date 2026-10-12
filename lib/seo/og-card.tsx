// ===========================================================
// lib/seo/og-card.tsx — Branded 1200x630 share card for the pages people
// share by link, so each preview names its page. Same look as the home card
// (app/opengraph-image.tsx): white canvas, aurora glows, the gradient H badge.
// Satori can't read CSS vars, so colors are literal hex mirroring lib/theme.ts.
// ===========================================================

import { ImageResponse } from "next/og";

export const OG_CARD_SIZE = { width: 1200, height: 630 };

const BG = "#ffffff";
const TEXT = "#1d1726";
const TEXT_DIM = "#5b5470";
const TEXT_MUTED = "#8b8399";
const ACCENT = "#f97316";

export type OgCardContent = {
  /** Small pill, top right ("Free tool · No signup"). */
  eyebrow: string;
  title: string;
  subtitle: string;
  /** Text of the gradient button, bottom left. */
  cta: string;
};

/** Headline size that keeps titles of up to about 50 characters on two lines. */
export function ogTitleSize(title: string): number {
  if (title.length <= 24) return 76;
  if (title.length <= 36) return 66;
  return 56;
}

export function ogCard({ eyebrow, title, subtitle, cta }: OgCardContent): ImageResponse {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: BG,
          padding: "64px 72px",
          fontFamily: "system-ui, sans-serif",
          position: "relative",
        }}
      >
        {/* Purple aurora glow top-left */}
        <div style={{
          position: "absolute", top: "-140px", left: "-120px", width: "600px", height: "600px", borderRadius: "300px",
          background: "radial-gradient(circle, rgba(124,58,237,0.16) 0%, transparent 70%)", display: "flex",
        }} />
        {/* Orange aurora glow top-right */}
        <div style={{
          position: "absolute", top: "-120px", right: "-120px", width: "540px", height: "540px", borderRadius: "270px",
          background: "radial-gradient(circle, rgba(249,115,22,0.14) 0%, transparent 70%)", display: "flex",
        }} />

        {/* Top: logo + page pill */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{
              width: "44px", height: "44px", borderRadius: "12px",
              background: "linear-gradient(135deg, #7c3aed 0%, #a855f7 55%, #f97316 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "24px", fontWeight: 800, color: "#ffffff",
            }}>H</div>
            <span style={{ fontSize: "21px", fontWeight: 700, color: TEXT }}>HumanizeIt</span>
          </div>
          <span style={{
            fontSize: "15px", fontWeight: 600, color: ACCENT,
            background: "#fff2e6", border: "1px solid #ffd9b3",
            padding: "7px 18px", borderRadius: "100px",
          }}>
            {eyebrow}
          </span>
        </div>

        {/* Center: page title + one-line promise */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={{
            display: "flex", fontSize: `${ogTitleSize(title)}px`, fontWeight: 800, color: TEXT,
            lineHeight: 1.08, letterSpacing: "-0.03em", maxWidth: "1000px",
          }}>
            {title}
          </div>
          <div style={{ display: "flex", fontSize: "26px", color: TEXT_DIM, lineHeight: 1.4, maxWidth: "900px" }}>
            {subtitle}
          </div>
        </div>

        {/* Bottom: CTA + domain */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{
            display: "flex", alignItems: "center",
            background: "linear-gradient(100deg, #7c3aed 0%, #a855f7 45%, #f97316 100%)",
            padding: "18px 38px", borderRadius: "14px",
            fontSize: "21px", fontWeight: 700, color: "#ffffff",
          }}>
            {cta}
          </div>
          <span style={{ fontSize: "20px", fontWeight: 600, color: TEXT_MUTED }}>humanizeit.app</span>
        </div>
      </div>
    ),
    { ...OG_CARD_SIZE }
  );
}
