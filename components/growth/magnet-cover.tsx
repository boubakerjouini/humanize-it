// ===========================================================
// components/growth/magnet-cover.tsx — A CSS mock of a lead magnet's PDF
// cover (no image files to keep in sync with the PDFs). Purely decorative:
// the title is repeated in the page text, so the mock is hidden from
// assistive tech. No hooks, so server and client components can both use it.
// ===========================================================

import type { Magnet } from "@/lib/growth/magnets";
import { THEME } from "@/lib/theme";

const ACCENTS: Record<string, string> = {
  "false-ai-flag-appeal-kit": THEME.accent,
  "ai-detection-field-guide": THEME.brand,
  "linkedin-humanizer-checklist": "#0a66c2",
};

export function MagnetCover({ magnet, size = "md" }: { magnet: Magnet; size?: "sm" | "md" }) {
  const width = size === "sm" ? 120 : 200;
  const accent = ACCENTS[magnet.slug] ?? THEME.brand;
  return (
    <div
      aria-hidden="true"
      style={{
        width,
        aspectRatio: "1 / 1.36",
        flex: "0 0 auto",
        borderRadius: size === "sm" ? "6px" : "10px",
        background: `linear-gradient(160deg, ${THEME.surface1} 0%, #ffffff 55%)`,
        border: `1px solid ${THEME.border}`,
        boxShadow: "0 18px 40px -18px rgba(29,23,38,0.35), 0 2px 6px rgba(29,23,38,0.06)",
        padding: size === "sm" ? "12px 10px" : "20px 16px",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
        fontFamily: THEME.fontHeading,
      }}
    >
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: size === "sm" ? 5 : 8, background: accent }} />
      <div style={{ fontSize: size === "sm" ? 7 : 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: accent, marginBottom: size === "sm" ? 6 : 10 }}>
        Free {magnet.noun}
      </div>
      <div style={{ fontSize: size === "sm" ? 11 : 17, fontWeight: 800, lineHeight: 1.2, color: THEME.text, letterSpacing: "-0.01em" }}>
        {magnet.shortTitle}
      </div>
      <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: size === "sm" ? 3 : 5 }}>
        {[0.9, 0.75, 0.82].map((w, i) => (
          <div key={i} style={{ height: size === "sm" ? 3 : 4, width: `${w * 100}%`, borderRadius: 2, background: THEME.border }} />
        ))}
        <div style={{ fontSize: size === "sm" ? 7 : 9, color: THEME.textMuted, marginTop: size === "sm" ? 4 : 8, fontFamily: THEME.fontSans }}>
          HumanizeIt · {magnet.pages} pages
        </div>
      </div>
    </div>
  );
}
