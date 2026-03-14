"use client";

import { useEffect, useRef } from "react";

interface ScoreRingProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  animate?: boolean;
}

function scoreColor(s: number): string {
  if (s >= 75) return "#ef4444";
  if (s >= 50) return "#7e22ce";
  if (s >= 25) return "#a855f7";
  return "#16a34a";
}

function scoreLabel(s: number): string {
  if (s >= 75) return "Very likely AI";
  if (s >= 50) return "Likely AI";
  if (s >= 25) return "Possibly AI";
  return "Looks human";
}

export function ScoreRing({ score, size = 140, strokeWidth = 8, animate = true }: ScoreRingProps) {
  const circleRef = useRef<SVGCircleElement>(null);
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = scoreColor(score);

  useEffect(() => {
    if (!animate || !circleRef.current) return;
    const el = circleRef.current;
    el.style.strokeDashoffset = String(circumference);
    el.style.transition = "none";

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.style.transition = "stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1)";
        el.style.strokeDashoffset = String(offset);
      });
    });
  }, [score, circumference, offset, animate]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          {/* Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth={strokeWidth}
          />
          {/* Progress — conic gradient effect via stroke */}
          <circle
            ref={circleRef}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={animate ? circumference : offset}
            style={{
              filter: `drop-shadow(0 0 4px ${color}40)`,
              transition: animate ? undefined : "none",
            }}
          />
        </svg>

        {/* Center text */}
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
        }}>
          <span style={{
            fontSize: `${size * 0.28}px`, fontWeight: 800,
            lineHeight: 1, color: "#3b0764",
            letterSpacing: "-1px",
            fontFamily: "var(--font-heading)",
          }}>
            {Math.round(score)}
          </span>
          <span style={{ fontSize: `${size * 0.09}px`, color: "#4b5563", marginTop: "2px" }}>
            / 100
          </span>
        </div>
      </div>

      {/* Label */}
      <div style={{ fontSize: "12px", fontWeight: 500, color: "#4b5563", textAlign: "center" }}>
        Human Score
      </div>
    </div>
  );
}
