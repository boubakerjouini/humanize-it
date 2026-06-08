import type { NextConfig } from "next";
import createMDX from "@next/mdx";
import { withWorkflow } from "workflow/next";

const nextConfig: NextConfig = {
  pageExtensions: ["ts", "tsx", "md", "mdx"],
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
