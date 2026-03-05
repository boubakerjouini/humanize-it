import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      // Proxy PostHog static assets (JS bundle)
      {
        source: "/ingest/static/:path*",
        destination: "https://eu-assets.i.posthog.com/static/:path*",
      },
      // Proxy PostHog API calls — EU Cloud
      {
        source: "/ingest/:path*",
        destination: "https://eu.i.posthog.com/:path*",
      },
    ];
  },
  // Required so PostHog cookies are not blocked
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
