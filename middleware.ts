import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextRequest, NextResponse, NextFetchEvent } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/compare",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/extension-auth(.*)",
  "/api/webhooks(.*)",
  "/api/extension-token(.*)",
  // Extension uses custom HMAC JWT — auth handled inside route handler
  "/api/analyze(.*)",
  "/api/humanize(.*)",
  // Developer API v1 — API key auth handled inside route handlers
  "/api/v1(.*)",
  // Blog
  "/blog(.*)",
  // Legal pages
  "/privacy",
  "/terms",
  "/cookies",
  "/refunds",
]);

// Clerk middleware for protected routes only
const clerkHandler = clerkMiddleware(async (auth) => {
  await auth.protect();
});

// Custom middleware: bypass Clerk entirely for public routes
// This ensures the landing page stays up even when Clerk FAPI is degraded
export default async function middleware(request: NextRequest, event: NextFetchEvent) {
  if (isPublicRoute(request)) {
    return NextResponse.next();
  }
  return clerkHandler(request, event);
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
