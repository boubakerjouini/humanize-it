"use client";

import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import { useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { AttributionCapture } from "@/components/growth/attribution-capture";

// PostHog itself is initialised in instrumentation-client.ts (before hydration).
// This component only ties the PostHog identity to the Clerk session.
function PostHogIdentity() {
  const { user, isLoaded } = useUser();

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

  // Reset after sign-out only. Resetting whenever `user` was empty gave every
  // anonymous page load a fresh distinct_id, which broke anonymous funnels.
  // `$user_state` is PostHog's own persisted flag, so this also catches a
  // sign-out followed by a full page load.
  useEffect(() => {
    if (!isLoaded || user || !posthog.__loaded) return;
    if (posthog.get_property("$user_state") === "identified") posthog.reset();
  }, [isLoaded, user]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PostHogProvider client={posthog}>
      <PostHogIdentity />
      <AttributionCapture />
      {children}
    </PostHogProvider>
  );
}
