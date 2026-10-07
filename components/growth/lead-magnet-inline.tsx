// ===========================================================
// components/growth/lead-magnet-inline.tsx — An inline "free PDF" box for
// content pages (blog posts, the AI detector page). Server component: the
// copy and cover render in the HTML, only the form is client-side.
// ===========================================================

import Link from "next/link";
import { LeadCaptureForm } from "@/components/growth/lead-capture-form";
import { MagnetCover } from "@/components/growth/magnet-cover";
import { MAGNETS, magnetPath } from "@/lib/growth/magnets";
import type { MagnetSlug, PublicLeadSource } from "@/lib/growth/constants";
import { THEME, glow } from "@/lib/theme";

export function LeadMagnetInline({
  slug,
  source = "blog_inline",
  heading,
}: {
  slug: MagnetSlug;
  source?: PublicLeadSource;
  /** Overrides the default "Free {noun}: {title}" heading. */
  heading?: string;
}) {
  const magnet = MAGNETS[slug];
  return (
    <aside
      aria-labelledby={`magnet-inline-${slug}`}
      style={{
        marginTop: "48px",
        background: THEME.surface1,
        border: `1px solid ${THEME.border}`,
        borderRadius: THEME.radiusLg,
        padding: "24px",
        boxShadow: glow(THEME.brand, 0.1),
      }}
    >
      <div style={{ display: "flex", gap: "20px", alignItems: "flex-start", flexWrap: "wrap", marginBottom: "16px" }}>
        <MagnetCover magnet={magnet} size="sm" />
        <div style={{ flex: "1 1 240px", minWidth: 0 }}>
          <div style={{ fontSize: "12px", color: THEME.accent, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>
            Free {magnet.noun} · {magnet.pages} pages
          </div>
          <h2
            id={`magnet-inline-${slug}`}
            style={{ fontFamily: THEME.fontHeading, fontWeight: 700, fontSize: "20px", lineHeight: 1.3, color: THEME.text, margin: "0 0 8px" }}
          >
            {heading ?? magnet.title}
          </h2>
          <p style={{ fontSize: "15px", color: THEME.textDim, lineHeight: 1.6, margin: "0 0 8px" }}>{magnet.promise}</p>
          <Link href={magnetPath(slug)} style={{ fontSize: "13px", color: THEME.brandHi }}>
            See what&apos;s inside
          </Link>
        </div>
      </div>
      <LeadCaptureForm source={source} magnet={slug} variant="inline" ctaLabel={`Get the free ${magnet.noun}`} />
    </aside>
  );
}
