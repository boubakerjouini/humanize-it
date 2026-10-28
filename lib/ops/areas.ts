// ===========================================================
// lib/ops/areas.ts — Bounded buckets for the ops counters in DailyMetric
// (pure). A server error is counted under its area, never its exact path, so
// a crawler hitting random URLs can't grow the table: six keys at most.
// ===========================================================

export const OPS_AREAS = ["api/webhooks", "api/public", "api/detect", "api/humanize", "app", "other"] as const;
export type OpsArea = (typeof OPS_AREAS)[number];

export const WEBHOOK_SOURCES = ["clerk", "polar"] as const;
export type WebhookSource = (typeof WEBHOOK_SOURCES)[number];

export type OpsMetricKey = `ops.5xx.${OpsArea}` | `ops.webhook_fail.${WebhookSource}`;

/** Area of a route path such as "/api/detect" or "/blog/[slug]". */
export function opsArea(routePath: string | null | undefined): OpsArea {
  const path = (routePath ?? "").split("?")[0];
  for (const prefix of ["api/webhooks", "api/public", "api/detect", "api/humanize"] as const) {
    if (path === `/${prefix}` || path.startsWith(`/${prefix}/`)) return prefix;
  }
  if (path === "/api" || path.startsWith("/api/")) return "other";
  return path.startsWith("/") ? "app" : "other";
}
