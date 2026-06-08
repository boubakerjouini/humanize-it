import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "HumanizeIt — AI Text Humanizer That Bypasses GPTZero & Turnitin";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

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
          backgroundColor: "#0a0b0e",
          padding: "64px 72px",
          fontFamily: "system-ui, sans-serif",
          position: "relative",
        }}
      >
        {/* Violet brand glow background */}
        <div style={{
          position: "absolute",
          top: "-120px",
          right: "-100px",
          width: "600px",
          height: "600px",
          borderRadius: "300px",
          background: "radial-gradient(circle, rgba(124,92,255,0.28) 0%, transparent 70%)",
          display: "flex",
        }} />
        {/* Neon-green human accent glow */}
        <div style={{
          position: "absolute",
          bottom: "-160px",
          left: "-120px",
          width: "520px",
          height: "520px",
          borderRadius: "260px",
          background: "radial-gradient(circle, rgba(62,224,143,0.14) 0%, transparent 70%)",
          display: "flex",
        }} />

        {/* Top: Logo + Badge */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{
              width: "40px", height: "40px", borderRadius: "10px",
              background: "linear-gradient(135deg, #7c5cff, #4c1d95)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "22px", fontWeight: 800, color: "#ffffff",
            }}>H</div>
            <span style={{ fontSize: "20px", fontWeight: 700, color: "#e8eaef" }}>HumanizeIt</span>
          </div>
          <span style={{
            fontSize: "14px", fontWeight: 600, color: "#9a80ff",
            background: "rgba(124,92,255,0.14)", border: "1px solid rgba(124,92,255,0.4)",
            padding: "6px 16px", borderRadius: "100px",
          }}>
            Free Plan Available
          </span>
        </div>

        {/* Center: Main headline */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <h1 style={{
            fontSize: "72px", fontWeight: 900, color: "#e8eaef",
            lineHeight: 1.05, margin: 0, letterSpacing: "-0.03em",
          }}>
            Your AI text,<br />
            <span style={{ color: "#7c5cff" }}>finally sounds human.</span>
          </h1>
          <p style={{
            fontSize: "24px", color: "#9aa1ad", margin: 0, lineHeight: 1.4, maxWidth: "700px",
          }}>
            Beat GPTZero, Turnitin &amp; Originality.ai in seconds. 24 detection patterns. Free to start.
          </p>
        </div>

        {/* Bottom: CTA + Score badge */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {/* CTA Button */}
          <div style={{
            display: "flex", alignItems: "center", gap: "12px",
            background: "linear-gradient(135deg, #7c5cff, #6d28d9)",
            padding: "16px 36px", borderRadius: "14px",
            fontSize: "20px", fontWeight: 700, color: "#ffffff",
          }}>
            Try Free — No Credit Card
          </div>

          {/* Score pill */}
          <div style={{
            display: "flex", alignItems: "center", gap: "16px",
            background: "rgba(62,224,143,0.10)", border: "1px solid rgba(62,224,143,0.35)",
            padding: "12px 24px", borderRadius: "100px",
          }}>
            <div style={{
              fontSize: "32px", fontWeight: 800, color: "#3ee08f",
              fontFamily: "monospace",
            }}>94%</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <span style={{ fontSize: "14px", fontWeight: 600, color: "#3ee08f" }}>Human Score</span>
              <span style={{ fontSize: "12px", color: "#767e8b" }}>humanizeit.app</span>
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
