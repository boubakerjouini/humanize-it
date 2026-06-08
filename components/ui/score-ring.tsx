"use client";

import { useEffect, useRef } from "react";
import { THEME, humanScore, humanScoreColor, humanScoreLabel } from "@/lib/theme";

interface ScoreRingProps {
  /** AI-likelihood score from the engine (0 = human, 100 = AI). */
  score: number;
  size?: number;
  strokeWidth?: number;
  animate?: boolean;
  /** Hide the caption label under the ring. */
  hideLabel?: boolean;
}

/**
 * Canonical Midnight Terminal score ring. Receives the engine's AI-likelihood
 * score and displays the HUMAN score (100 − ai) so a fuller, greener ring always
 * means "more human / better". This is the single ring used across the product.
 */
export function ScoreRing({ score, size = 140, strokeWidth = 8, animate = true, hideLabel = false }: ScoreRingProps) {
  const circleRef = useRef<SVGCircleElement>(null);
  const human = humanScore(score);
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (human / 100) * circumference;
  const color = humanScoreColor(human);

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
  }, [human, circumference, offset, animate]);

  return (
    <div
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}
      role="img"
      aria-label={`Human score ${human} out of 100 — ${humanScoreLabel(human)}`}
    >
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }} aria-hidden="true">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={THEME.border} strokeWidth={strokeWidth} />
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
            style={{ filter: `drop-shadow(0 2px 6px ${color}33)`, transition: animate ? undefined : "none" }}
          />
        </svg>

        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <span
            style={{
              fontSize: `${size * 0.30}px`,
              fontWeight: 600,
              lineHeight: 1,
              color,
              letterSpacing: "-1px",
              fontFamily: THEME.fontHeading,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {human}
          </span>
          <span style={{ fontSize: `${size * 0.085}px`, color: THEME.textMuted, marginTop: "2px", fontFamily: THEME.fontMono }}>
            / 100 human
          </span>
        </div>
      </div>

      {!hideLabel && (
        <div style={{ fontSize: "12px", fontWeight: 500, color: THEME.textDim, textAlign: "center", fontFamily: THEME.fontMono, letterSpacing: "0.04em", textTransform: "uppercase" }}>
          {humanScoreLabel(human)}
        </div>
      )}
    </div>
  );
}
