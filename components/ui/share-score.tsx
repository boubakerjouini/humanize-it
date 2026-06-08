"use client";

import { Sparkles } from "lucide-react";
import { THEME, humanScore, humanScoreColor } from "@/lib/theme";

interface ShareScoreProps {
  /** Original AI-likelihood score (0 = human, 100 = AI). */
  score: number;
  /** AI-likelihood score after humanizing (0 = human, 100 = AI), or null. */
  humanizedScore: number | null;
}

export function ShareScore({ score, humanizedScore }: ShareScoreProps) {
  if (humanizedScore === null) return null;

  // Present HUMAN scores (higher = more human) in shared copy.
  const humanAfter = humanScore(humanizedScore);
  const humanBefore = humanScore(score);

  const twitterText = encodeURIComponent(
    `I just humanized my AI text to ${humanAfter}% human with HumanizeIt! Try it free: https://humanizeit.app`
  );
  const linkedinUrl = encodeURIComponent("https://humanizeit.app");
  const linkedinTitle = encodeURIComponent(
    `I just humanized my AI text from ${humanBefore}% human to ${humanAfter}% with HumanizeIt!`
  );

  const humanColor = humanScoreColor(humanAfter);

  const linkStyle: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: "5px",
    padding: "6px 11px", borderRadius: THEME.radius,
    background: THEME.surface2, border: `1px solid ${THEME.border}`,
    color: THEME.brandHi, fontSize: "11px", fontWeight: 600,
    textDecoration: "none", cursor: "pointer",
    transition: "all 0.2s", fontFamily: THEME.fontSans,
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
      {/* Celebratory human-score chip */}
      <span style={{
        display: "inline-flex", alignItems: "center", gap: "5px",
        padding: "6px 11px", borderRadius: "999px",
        background: THEME.humanDim, border: `1px solid ${humanColor}33`,
        fontSize: "11px", fontWeight: 700, color: humanColor,
        fontFamily: THEME.fontSans,
      }}>
        <Sparkles size={12} color={humanColor} aria-hidden="true" />
        <span className="tnum">{humanAfter}%</span> human
      </span>
      <a
        href={`https://twitter.com/intent/tweet?text=${twitterText}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Share your human score on X"
        style={linkStyle}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
        Share
      </a>
      <a
        href={`https://www.linkedin.com/sharing/share-offsite/?url=${linkedinUrl}&title=${linkedinTitle}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Share your human score on LinkedIn"
        style={linkStyle}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
        </svg>
        Share
      </a>
    </div>
  );
}
