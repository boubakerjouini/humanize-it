import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "HumanizeIt — Detect & Humanize AI Text";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

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
          backgroundColor: "#0a0b0e",
          padding: "60px",
          fontFamily: "system-ui, sans-serif",
        }}
      >
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
              border: "6px solid #3ee08f",
              backgroundColor: "rgba(62, 224, 143, 0.08)",
            }}
          >
            <span
              style={{
                fontSize: "56px",
                fontWeight: 800,
                color: "#3ee08f",
                fontFamily: "monospace",
              }}
            >
              94
            </span>
          </div>
          <span
            style={{
              fontSize: "16px",
              color: "#3ee08f",
              fontWeight: 600,
              letterSpacing: "0.05em",
              textTransform: "uppercase" as const,
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
                    color: "#9aa1ad",
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
                    backgroundColor: "#15181f",
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
                          ? "linear-gradient(90deg, #3ee08f, #6df0ad)"
                          : score >= 80
                            ? "linear-gradient(90deg, #f5b13d, #ffce6e)"
                            : "linear-gradient(90deg, #7c5cff, #9a80ff)",
                    }}
                  />
                </div>
                <span
                  style={{
                    fontSize: "13px",
                    color: "#e8eaef",
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
                width: "44px",
                height: "44px",
                borderRadius: "10px",
                background: "linear-gradient(135deg, #7c5cff, #6d28d9)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "24px",
                fontWeight: 800,
                color: "#ffffff",
              }}
            >
              H
            </div>
            <span
              style={{
                fontSize: "22px",
                fontWeight: 700,
                color: "#e8eaef",
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
              color: "#e8eaef",
              lineHeight: 1.1,
              margin: 0,
            }}
          >
            Humanize
            <br />
            <span style={{ color: "#7c5cff" }}>AI Text</span>
          </h1>

          {/* Subtitle */}
          <p
            style={{
              fontSize: "22px",
              color: "#9aa1ad",
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
              color: "#767e8b",
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
