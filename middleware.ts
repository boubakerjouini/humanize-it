import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

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

// Standard Clerk middleware: runs on ALL routes so session cookies are always
// processed (enabling auth() to return userId for logged-in users on public
// routes). Only PROTECTS non-public routes (redirects to sign-in if not authed).
export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
