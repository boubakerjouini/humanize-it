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
  // Legal pages
  "/privacy",
  "/terms",
  "/cookies",
  "/refunds",
]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
