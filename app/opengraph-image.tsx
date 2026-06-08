import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "HumanizeIt — AI Text Humanizer That Bypasses GPTZero & Turnitin";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Aurora palette (Satori can't read CSS vars, so literal hex mirrors lib/theme.ts)
const BG = "#ffffff";
const SURFACE = "#faf8fe";
const TEXT = "#1d1726";
const TEXT_DIM = "#5b5470";
const TEXT_MUTED = "#8b8399";
const ACCENT = "#f97316";
const HUMAN = "#16a34a";
const BORDER = "#e9e3f3";

export default function OGImage() {
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
          position: "absolute",
          top: "-140px",
          left: "-120px",
          width: "600px",
          height: "600px",
          borderRadius: "300px",
          background: "radial-gradient(circle, rgba(124,58,237,0.16) 0%, transparent 70%)",
          display: "flex",
        }} />
        {/* Orange aurora glow top-right */}
        <div style={{
          position: "absolute",
          top: "-120px",
          right: "-120px",
          width: "540px",
          height: "540px",
          borderRadius: "270px",
          background: "radial-gradient(circle, rgba(249,115,22,0.14) 0%, transparent 70%)",
          display: "flex",
        }} />

        {/* Top: Logo + Badge */}
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
            Free Plan Available
          </span>
        </div>

        {/* Center: Main headline */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <h1 style={{
            fontSize: "72px", fontWeight: 800, color: TEXT,
            lineHeight: 1.05, margin: 0, letterSpacing: "-0.03em",
            display: "flex", flexDirection: "column",
          }}>
            <span style={{ display: "flex" }}>Your AI text,</span>
            <span style={{ display: "flex" }}>
              <span style={{
                backgroundImage: "linear-gradient(100deg, #7c3aed 0%, #a855f7 45%, #f97316 100%)",
                backgroundClip: "text",
                WebkitBackgroundClip: "text",
                color: "transparent",
              }}>finally sounds human.</span>
            </span>
          </h1>
          <p style={{
            fontSize: "24px", color: TEXT_DIM, margin: 0, lineHeight: 1.4, maxWidth: "720px",
          }}>
            Beat GPTZero, Turnitin &amp; Originality.ai in seconds. 24 detection patterns. Free to start.
          </p>
        </div>

        {/* Bottom: CTA + Score badge */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {/* CTA Button */}
          <div style={{
            display: "flex", alignItems: "center", gap: "12px",
            background: "linear-gradient(100deg, #7c3aed 0%, #a855f7 45%, #f97316 100%)",
            padding: "18px 38px", borderRadius: "14px",
            fontSize: "21px", fontWeight: 700, color: "#ffffff",
          }}>
            Try Free — No Credit Card
          </div>

          {/* Score pill */}
          <div style={{
            display: "flex", alignItems: "center", gap: "16px",
            background: SURFACE, border: `1px solid ${BORDER}`,
            padding: "14px 26px", borderRadius: "100px",
          }}>
            <div style={{
              fontSize: "34px", fontWeight: 800, color: HUMAN,
              fontFamily: "monospace",
            }}>94%</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <span style={{ fontSize: "15px", fontWeight: 600, color: HUMAN }}>Human Score</span>
              <span style={{ fontSize: "13px", color: TEXT_MUTED }}>humanizeit.app</span>
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
