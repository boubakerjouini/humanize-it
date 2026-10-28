// instrumentation.ts: an uncaught server error is counted under its bounded
// area, and only the route and message are logged, never the request.

jest.mock("@/lib/growth/daily-metrics", () => ({ bumpDailyMetric: jest.fn(async () => {}) }));

import { onRequestError } from "@/instrumentation";
import { bumpDailyMetric } from "@/lib/growth/daily-metrics";

const context = { routerKind: "App Router", routePath: "/api/detect", routeType: "route", revalidateReason: undefined } as const;
const request = { path: "/api/detect?x=secretquery", method: "POST", headers: { cookie: "secretcookie" } };
const runtime = process.env.NEXT_RUNTIME;

afterEach(() => {
  process.env.NEXT_RUNTIME = runtime;
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

it("counts the error under its area and logs only the route and message", async () => {
  process.env.NEXT_RUNTIME = "nodejs";
  const log = jest.spyOn(console, "error").mockImplementation(() => {});
  await onRequestError(new Error("boom"), request, context);
  expect(bumpDailyMetric).toHaveBeenCalledTimes(1);
  expect(bumpDailyMetric).toHaveBeenCalledWith("ops.5xx.api/detect");
  expect(log).toHaveBeenCalledWith("[ops] /api/detect: boom");
  expect(JSON.stringify(log.mock.calls)).not.toMatch(/secret/);
});

it("only logs on the edge runtime, where the DB client can't load", async () => {
  process.env.NEXT_RUNTIME = "edge";
  jest.spyOn(console, "error").mockImplementation(() => {});
  await onRequestError(new Error("boom"), request, { ...context, routePath: "/middleware", routeType: "proxy" });
  expect(bumpDailyMetric).not.toHaveBeenCalled();
});
