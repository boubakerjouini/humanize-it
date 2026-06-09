import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/",
  // Marketing surface — MUST be crawlable. `/compare(.*)` (not exact `/compare`)
  // so the comparison detail/spoke pages are public too.
  "/compare(.*)",
  "/lifetime",
  "/use-cases(.*)",
  "/docs(.*)",
  "/bypass(.*)",
  "/alternatives(.*)",
  "/ai-detector(.*)",
  "/gptzero-checker(.*)",
  "/free-ai-humanizer(.*)",
  "/faq(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/extension-auth(.*)",
  "/invite(.*)",
  "/api/webhooks(.*)",
  "/api/invitations(.*)",
  "/api/extension-token(.*)",
  // Extension uses custom HMAC JWT — auth handled inside route handler
  "/api/analyze(.*)",
  "/api/humanize(.*)",
  // Public (anonymous, IP-rate-limited) tool endpoints
  "/api/public(.*)",
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
    // Skip Next internals, static files, AND the Workflow DevKit's internal
    // routes (`/.well-known/workflow/*`) — Clerk must never intercept those or
    // the durable document pipeline can't enqueue/resume steps.
    "/((?!_next|\\.well-known/workflow|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
