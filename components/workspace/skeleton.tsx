// ===========================================================
// components/workspace/skeleton.tsx — shimmering placeholder blocks shown
// while workspace data loads, so the layout appears at once instead of a
// spinner or a blank flash. The keyframes ship with the component (React
// dedupes the hoisted <style> by href) so it works outside the shell too.
// ===========================================================

import { THEME } from "@/lib/theme";

const CSS = `
@keyframes ws-skeleton { 0% { background-position: 100% 0; } 100% { background-position: -100% 0; } }
.ws-skeleton {
  background: linear-gradient(90deg, ${THEME.surface3} 0%, ${THEME.surface1} 50%, ${THEME.surface3} 100%);
  background-size: 200% 100%;
  animation: ws-skeleton 1.4s ease-in-out infinite;
}
@media (prefers-reduced-motion: reduce) { .ws-skeleton { animation: none; } }
`;

export function Skeleton({ width = "100%", height = 12, radius = 6, style }: {
  width?: number | string;
  height?: number | string;
  radius?: number | string;
  style?: React.CSSProperties;
}) {
  return (
    <>
      <style href="ws-skeleton" precedence="default">{CSS}</style>
      <span aria-hidden="true" className="ws-skeleton" style={{ display: "block", width, height, borderRadius: radius, ...style }} />
    </>
  );
}

/** Placeholder history rows, shaped like the real cards in the drawer. */
export function HistoryRowsSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading history" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} style={{ background: THEME.surface2, border: `1px solid ${THEME.border}`, borderRadius: THEME.radiusLg, padding: "15px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
          <Skeleton width={`${78 - (i % 3) * 12}%`} height={13} />
          <div style={{ display: "flex", gap: 10 }}>
            <Skeleton width={96} height={10} />
            <Skeleton width={58} height={10} />
            <Skeleton width={52} height={10} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Generic signed-in page: a heading block and two cards (Voice, Organization). */
export function PageSkeleton() {
  return (
    <div role="status" aria-label="Loading" style={{ maxWidth: 720, margin: "0 auto", padding: "40px 24px", display: "flex", flexDirection: "column", gap: 18 }}>
      <Skeleton width={220} height={24} radius={8} />
      <Skeleton width="60%" height={12} />
      {[0, 1].map((i) => (
        <div key={i} style={{ background: THEME.surface2, border: `1px solid ${THEME.border}`, borderRadius: THEME.radiusXl, padding: 24, display: "flex", flexDirection: "column", gap: 12 }}>
          <Skeleton width={160} height={14} />
          <Skeleton height={10} />
          <Skeleton width="85%" height={10} />
          <Skeleton width={130} height={36} radius={10} style={{ marginTop: 6 }} />
        </div>
      ))}
    </div>
  );
}

/** The editor's frame (toolbar + canvas lines) while the workspace route loads. */
export function EditorSkeleton() {
  return (
    <div role="status" aria-label="Loading the editor" style={{ display: "flex", flexDirection: "column", minHeight: "100dvh" }}>
      <div style={{ borderBottom: `1px solid ${THEME.border}` }}>
        <div style={{ maxWidth: 980, margin: "0 auto", padding: "10px 20px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <Skeleton width={128} height={40} radius={10} />
          <Skeleton width={118} height={40} radius={10} />
          <Skeleton width={150} height={34} radius={8} />
          <Skeleton width={150} height={34} radius={8} />
        </div>
      </div>
      <div style={{ width: "100%", maxWidth: 820, margin: "0 auto", padding: "32px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
        <Skeleton width="70%" height={16} />
        <Skeleton width="92%" height={16} />
        <Skeleton width="54%" height={16} />
      </div>
    </div>
  );
}
