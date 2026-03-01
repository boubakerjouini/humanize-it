import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      // Proxy PostHog static assets (JS bundle)
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      // Proxy PostHog API calls (events, decide, etc.)
      {
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
    ];
  },
  // Required so PostHog cookies are not blocked
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
