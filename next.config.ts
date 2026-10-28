import type { NextConfig } from "next";
import createMDX from "@next/mdx";
import { withWorkflow } from "workflow/next";

const nextConfig: NextConfig = {
  pageExtensions: ["ts", "tsx", "md", "mdx"],
  // Tree-shake large icon/util barrels (lucide-react is imported across ~29
  // files) so marketing pages ship less JS.
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  // Retired blog posts that competed with stronger pages for the same query.
  // 301 rather than Next's default 308: same meaning to Google and Bing, and
  // understood by every older client too. `{/}?` also catches a trailing slash
  // (skipTrailingSlashRedirect is on).
  async redirects() {
    return [
      {
        source: "/blog/undetectable-ai-alternative{/}?",
        destination: "/alternatives/undetectable-ai",
        statusCode: 301,
      },
      {
        source: "/blog/bypass-ai-detection{/}?",
        destination: "/detectors",
        statusCode: 301,
      },
      // The detector guides moved from /bypass to /detectors when their copy was
      // rewritten around how each detector works and why it flags honest writing.
      {
        source: "/bypass{/}?",
        destination: "/detectors",
        statusCode: 301,
      },
      {
        source: "/bypass/:slug(turnitin|gptzero|zerogpt|originality-ai|copyleaks|winston-ai){/}?",
        destination: "/detectors/:slug",
        statusCode: 301,
      },
      // Any other old /bypass/* address lands on the hub instead of a 404.
      {
        source: "/bypass/:path*",
        destination: "/detectors",
        statusCode: 301,
      },
      // Addresses people type or guess from a DM, a directory form or an AI
      // answer. Without these they get the 404 page.
      ...[
        ["/pricing", "/#pricing"],
        ["/signup", "/sign-up"],
        ["/login", "/sign-in"],
        ["/signin", "/sign-in"],
        ["/contact", "/about#contact"],
        ["/support", "/about#contact"],
        ["/about-us", "/about"],
      ].map(([from, to]) => ({ source: `${from}{/}?`, destination: to, statusCode: 301 })),
    ];
  },
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://eu-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://eu.i.posthog.com/:path*",
      },
    ];
  },
  skipTrailingSlashRedirect: true,
};

const withMDX = createMDX({});

// withWorkflow enables the "use workflow" / "use step" directives used by the
// document-processing pipeline (extract → detect → humanize → score). It wraps
// the MDX-augmented config so both transforms run.
export default withWorkflow(withMDX(nextConfig));
