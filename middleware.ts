import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

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
  // AI-detection deep scan — anonymous-capable; per-IP vs per-user limits are
  // enforced inside the handler (auth() still resolves the session here).
  "/api/detect(.*)",
  // Developer API v1 — API key auth handled inside route handlers
  "/api/v1(.*)",
  // Growth engine — public pages (magnets + PDFs, waitlist, email preferences, referral links).
  // The matcher doesn't skip .pdf, so the lead-magnet files must be listed here.
  "/free(.*)",
  "/lead-magnets/(.*)",
  "/extension",
  "/extension/(.*)",
  "/email/(.*)",
  "/r/(.*)",
  // Growth engine — token-authenticated email endpoints + Vercel Cron (CRON_SECRET checked in handler)
  "/api/email/(.*)",
  "/api/cron/(.*)",
  // Blog
  "/blog(.*)",
  // Legal pages
  "/privacy",
  "/terms",
  "/cookies",
  "/refunds",
  // Next.js metadata routes (opengraph-image, twitter-image, icon, apple-icon)
  // at any depth: crawlers and link unfurlers fetch them signed out. Route-group
  // variants get a hash suffix (`/opengraph-image-1a2b3c`) and
  // generateImageMetadata adds an `/<id>` segment. The app, admin and API areas
  // are excluded so this can never open anything behind them.
  /^(?!\/(?:dashboard|admin|api)(?:\/|$))(?:\/[^/]+)*\/(?:opengraph-image|twitter-image|icon|apple-icon)(?:-[0-9a-z]+)?(?:\/[^/]+)?$/,
  "/manifest.json",
  "/manifest.webmanifest",
]);

// Standard Clerk middleware: runs on ALL routes so session cookies are always
// processed (enabling auth() to return userId for logged-in users on public
// routes). Only PROTECTS non-public routes (redirects to sign-in if not authed).
export default clerkMiddleware(async (auth, req) => {
  // Signed-in users who hit the marketing homepage go straight to the app.
  // Other marketing routes (/blog, /compare, …) stay browsable while signed in.
  if (req.nextUrl.pathname === "/") {
    const { userId } = await auth();
    if (userId) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }

  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next internals, static files, AND the Workflow DevKit's internal
    // routes (`/.well-known/workflow/*`) — Clerk must never intercept those or
    // the durable document pipeline can't enqueue/resume steps.
    // Also skipped: the PostHog reverse proxy (`/ingest/*`, rewritten in
    // next.config.ts — signed-out analytics calls were being 404ed by
    // auth.protect()) and the root crawler files: robots.txt, sitemap.xml and
    // the IndexNow key (`/<32 hex>.txt`). They are named exactly rather than
    // skipping every .txt/.xml path: a generic exclusion would also let
    // `/admin/users/x.xml` bypass Clerk, and the admin layout then 500s instead
    // of getting the protect 404.
    "/((?!_next|ingest(?:/|$)|\\.well-known/workflow|(?:robots\\.txt|sitemap\\.xml|[0-9a-f]{32}\\.txt)$|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
