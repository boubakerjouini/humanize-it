"use client";

import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import { useEffect } from "react";
import { useUser } from "@clerk/nextjs";

// Initialize PostHog once
function PostHogInit() {
  const { user } = useUser();

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key || posthog.__loaded) return;

    posthog.init(key, {
      // Proxy through our domain — avoids adblockers
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "/ingest",
      ui_host: "https://us.posthog.com",
      capture_pageview: false, // We handle this manually
      capture_pageleave: true,
      persistence: "localStorage",
      autocapture: false, // Opt-in only — GDPR friendly
    });
  }, []);

  // Identify user when signed in
  useEffect(() => {
    if (!user) return;
    posthog.identify(user.id, {
      email: user.emailAddresses[0]?.emailAddress,
      name: user.fullName,
      plan: user.publicMetadata?.plan ?? "FREE",
      created_at: user.createdAt,
    });
  }, [user?.id]);

  // Reset on signout
  useEffect(() => {
    if (!user && posthog.__loaded) {
      posthog.reset();
    }
  }, [user]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PostHogProvider client={posthog}>
      <PostHogInit />
      {children}
    </PostHogProvider>
  );
}
