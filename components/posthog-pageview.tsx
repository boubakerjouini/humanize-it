"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { usePostHog } from "posthog-js/react";
import { scrubUrl } from "@/lib/url-scrub";

// Tracks page views on every route change (App Router compatible). Email links
// carry a signed token in ?t=, which is scrubbed before it can reach PostHog.
export function PostHogPageview() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const posthog = usePostHog();

  useEffect(() => {
    if (!pathname || !posthog) return;
    const url = scrubUrl(
      window.location.origin + pathname + (searchParams.toString() ? `?${searchParams.toString()}` : "")
    );
    posthog.capture("$pageview", { $current_url: url });
  }, [pathname, searchParams, posthog]);

  return null;
}
