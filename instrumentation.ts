// ===========================================================
// instrumentation.ts — Server hooks Next.js loads once per runtime.
// onRequestError counts every uncaught server error in DailyMetric under a
// bounded area (lib/ops/areas.ts), so the daily ops check can flag a spike.
// Only the message and the route are logged: never the body, headers or any
// user text. Sentry, once set up, would hook in here as well.
// ===========================================================

import type { Instrumentation } from "next";

export const onRequestError: Instrumentation.onRequestError = async (err, _request, context) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[ops] ${context.routePath}: ${message.slice(0, 300)}`);
  // The DB client is Node-only: edge errors (middleware) are only logged. The
  // import must sit inside this exact check, which the bundler resolves at
  // build time, or the edge build tries to bundle pg.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const [{ opsArea }, { bumpDailyMetric }] = await Promise.all([import("@/lib/ops/areas"), import("@/lib/growth/daily-metrics")]);
    await bumpDailyMetric(`ops.5xx.${opsArea(context.routePath)}`);
  }
};
