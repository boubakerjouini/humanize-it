// middleware.ts: only the app areas (dashboard, admin, API) go through
// auth.protect(). An unknown URL falls through to the 404 page instead of the
// Clerk sign-in, every public route stays public, and no other spelling of an
// app path (percent-encoding, case, slashes, an .rsc suffix) skips protection.

// clerkMiddleware(handler) returns the handler itself so the test can call it
// with a stub auth. createRouteMatcher stays Clerk's real one.
jest.mock("@clerk/nextjs/server", () => ({
  ...jest.requireActual("@clerk/nextjs/server"),
  clerkMiddleware: (handler: unknown) => handler,
}));

import { NextRequest } from "next/server";
import middleware from "@/middleware";

type Handler = (auth: unknown, req: NextRequest) => Promise<Response | void>;

async function run(path: string, userId: string | null = null) {
  const protect = jest.fn(async () => ({ userId }));
  const auth = Object.assign(jest.fn(async () => ({ userId })), { protect });
  // A browser page request: Clerk would answer protect() with the sign-in redirect.
  const req = new NextRequest(`https://humanizeit.app${path}`, { headers: { accept: "text/html" } });
  const res = await (middleware as unknown as Handler)(auth, req);
  return { protectCalled: protect.mock.calls.length > 0, res };
}

const isProtected = async (path: string) => (await run(path)).protectCalled;

describe("middleware: what auth.protect() guards", () => {
  it.each([
    "/dashboard",
    "/dashboard/settings",
    "/dashboard/documents/abc/report",
    "/admin",
    "/admin/users/123",
    "/api/usage",
    "/api/me/referral",
    "/api/admin/users",
    "/api/documents/process",
    "/api/not-a-route",
    "/trpc/anything",
    "/dashboard/opengraph-image",
  ])("protects the app area %s", async (path) => {
    expect(await isProtected(path)).toBe(true);
  });

  it.each([
    "/DASHBOARD",
    "/Admin/users",
    "/API/usage",
    "/%64ashboard",
    "/%2564ashboard",
    "/dashboard%2Fsettings",
    "/%61pi/usage",
    "//dashboard",
    "/%5Cdashboard",
    "/dashboard.rsc",
    "/admin;x",
  ])("still protects the odd spelling %s", async (path) => {
    expect(await isProtected(path)).toBe(true);
  });

  it.each([
    "/pricing",
    "/features",
    "/support",
    "/some/deep/unknown/path",
    "/dashboards",
    "/administrator",
    "/apiary",
    "/api-docs",
    "/wp-login.php",
  ])("lets the unknown URL %s reach the 404 page", async (path) => {
    expect(await isProtected(path)).toBe(false);
  });

  it.each([
    "/",
    "/ai-detector",
    "/free-ai-humanizer",
    "/free/false-ai-flag-appeal-kit",
    "/blog/ai-detection-how-it-works",
    "/bypass/turnitin",
    "/about",
    "/lifetime",
    "/extension",
    "/sign-in",
    "/sign-up/verify-email-address",
    "/invite/abc",
    "/r/abc123",
    "/email/preferences",
    "/privacy",
    "/opengraph-image",
    "/ai-detector/opengraph-image-1a2b3c",
  ])("keeps the public page %s public", async (path) => {
    expect(await isProtected(path)).toBe(false);
  });

  it.each([
    "/api/public/humanize",
    "/api/public/leads",
    "/api/webhooks/clerk",
    "/api/v1/analyze",
    "/api/detect",
    "/api/analyze",
    "/api/humanize",
    "/api/extension-token",
    "/api/invitations/tok/accept",
    "/api/email/unsubscribe",
    "/api/cron/daily",
  ])("keeps the public endpoint %s public", async (path) => {
    expect(await isProtected(path)).toBe(false);
  });

  it("sends a signed-in visitor on / to the dashboard", async () => {
    const { res, protectCalled } = await run("/", "user_1");
    expect(res?.headers.get("location")).toBe("https://humanizeit.app/dashboard");
    expect(protectCalled).toBe(false);
  });
});
