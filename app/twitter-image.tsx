import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "HumanizeIt — Detect & Humanize AI Text";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Aurora palette (Satori can't read CSS vars, so literal hex mirrors lib/theme.ts)
const BG = "#ffffff";
const TEXT = "#1d1726";
const TEXT_DIM = "#5b5470";
const TEXT_MUTED = "#8b8399";
const HUMAN = "#16a34a";

export default function TwitterImage() {
  const scores = [92, 87, 95, 78, 91];
  const labels = ["Entropy", "Vocab", "Syntax", "Flow", "Style"];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          backgroundColor: BG,
          padding: "60px",
          fontFamily: "system-ui, sans-serif",
          position: "relative",
        }}
      >
        {/* Purple aurora glow top-left */}
        <div style={{
          position: "absolute",
          top: "-140px",
          left: "-120px",
          width: "560px",
          height: "560px",
          borderRadius: "280px",
          background: "radial-gradient(circle, rgba(124,58,237,0.15) 0%, transparent 70%)",
          display: "flex",
        }} />
        {/* Orange aurora glow bottom-right */}
        <div style={{
          position: "absolute",
          bottom: "-160px",
          right: "-120px",
          width: "520px",
          height: "520px",
          borderRadius: "260px",
          background: "radial-gradient(circle, rgba(249,115,22,0.13) 0%, transparent 70%)",
          display: "flex",
        }} />

        {/* Left side — score meter visual */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            width: "400px",
            gap: "16px",
          }}
        >
          {/* Main score circle */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "160px",
              height: "160px",
              borderRadius: "80px",
              border: `6px solid ${HUMAN}`,
              backgroundColor: "#e7f7ee",
            }}
          >
            <span
              style={{
                fontSize: "56px",
                fontWeight: 800,
                color: HUMAN,
                fontFamily: "monospace",
              }}
            >
              94
            </span>
          </div>
          <span
            style={{
              fontSize: "17px",
              color: HUMAN,
              fontWeight: 700,
            }}
          >
            Human Score
          </span>

          {/* Score bars */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              width: "300px",
              marginTop: "12px",
            }}
          >
            {scores.map((score, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                <span
                  style={{
                    fontSize: "13px",
                    color: TEXT_DIM,
                    width: "60px",
                    textAlign: "right",
                  }}
                >
                  {labels[i]}
                </span>
                <div
                  style={{
                    display: "flex",
                    flex: 1,
                    height: "10px",
                    borderRadius: "5px",
                    backgroundColor: "#efeaf7",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${score}%`,
                      height: "100%",
                      borderRadius: "5px",
                      background:
                        score >= 90
                          ? "linear-gradient(90deg, #16a34a, #34c773)"
                          : score >= 80
                            ? "linear-gradient(90deg, #f59e0b, #fbbf24)"
                            : "linear-gradient(90deg, #7c3aed, #a855f7)",
                    }}
                  />
                </div>
                <span
                  style={{
                    fontSize: "13px",
                    color: TEXT,
                    width: "32px",
                    fontFamily: "monospace",
                  }}
                >
                  {score}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right side — text content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            flex: 1,
            paddingLeft: "60px",
            gap: "20px",
          }}
        >
          {/* Logo mark */}
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "12px",
                background: "linear-gradient(135deg, #7c3aed 0%, #a855f7 55%, #f97316 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "26px",
                fontWeight: 800,
                color: "#ffffff",
              }}
            >
              H
            </div>
            <span
              style={{
                fontSize: "23px",
                fontWeight: 700,
                color: TEXT,
              }}
            >
              HumanizeIt
            </span>
          </div>

          {/* Title */}
          <h1
            style={{
              fontSize: "56px",
              fontWeight: 800,
              color: TEXT,
              lineHeight: 1.1,
              margin: 0,
              letterSpacing: "-0.02em",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span style={{ display: "flex" }}>Humanize</span>
            <span style={{ display: "flex" }}>
              <span style={{
                backgroundImage: "linear-gradient(100deg, #7c3aed 0%, #a855f7 45%, #f97316 100%)",
                backgroundClip: "text",
                WebkitBackgroundClip: "text",
                color: "transparent",
              }}>AI Text</span>
            </span>
          </h1>

          {/* Subtitle */}
          <p
            style={{
              fontSize: "22px",
              color: TEXT_DIM,
              margin: 0,
              lineHeight: 1.4,
            }}
          >
            Detect & bypass AI detection in seconds
          </p>

          {/* Domain */}
          <span
            style={{
              fontSize: "16px",
              color: TEXT_MUTED,
              marginTop: "8px",
            }}
          >
            humanizeit.app
          </span>
        </div>
      </div>
    ),
    { ...size }
  );
}
