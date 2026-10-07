// lib/posthog.ts — PostHog server-side client (Node.js / API routes)
import { PostHog } from "posthog-node";

let _client: PostHog | null = null;

export function getPostHogClient(): PostHog | null {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  // Production deployments only: local dev and previews carry the same key
  // and would otherwise mix test traffic into the real analytics.
  if (!key || process.env.VERCEL_ENV !== "production") return null;

  if (!_client) {
    _client = new PostHog(key, {
      // Straight to EU ingestion. NEXT_PUBLIC_POSTHOG_HOST is the browser's
      // /ingest reverse proxy (an ad-blocker workaround); server events don't
      // need it, and sending them through our own domain adds a hop through
      // the edge and the Clerk middleware (which used to 404 them).
      host: "https://eu.i.posthog.com",
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return _client;
}

/** Track a server-side event (fire & forget) */
export function trackServer(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>
) {
  const client = getPostHogClient();
  if (!client) return;
  client.capture({ distinctId, event, properties });
}
