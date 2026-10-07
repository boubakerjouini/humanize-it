// ===========================================================
// lib/email/inbound-rules.ts — Pure rules for mail received at @humanizeit.app.
//
// humanizeit.app is a receive-only Resend domain: support@ and any other
// address on it land in Resend, which calls our webhook with email.received.
// lib/email/inbound.ts forwards each message to the founder; these helpers
// decide what is forwarded and how the CRM task reads. Pure (no DB, no SDK),
// so they are unit-tested directly.
// ===========================================================

/** Domains we send from or receive on: forwarding mail from them could loop. */
export const OWN_DOMAINS: readonly string[] = ["humanizeit.app", "mail.humanizeit.app"];

/** Forwards per UTC day across all senders (Resend's free plan shares 100 sends a day with every other email). */
export const INBOUND_DAILY_CAP = 40;

/** Forwards per sender per UTC day: one sender can't flood the founder or the quota. */
export const INBOUND_SENDER_DAILY_CAP = 5;

/** The bare, lower-cased address of an RFC 5322 value such as `Jane <jane@x.com>`. */
export function bareAddress(value: string): string {
  const match = /<([^<>]+)>/.exec(value);
  return (match ? match[1] : value).trim().toLowerCase();
}

/** True when the address is on one of our own domains (or a subdomain of them). */
export function isOwnAddress(value: string): boolean {
  const domain = bareAddress(value).split("@")[1] ?? "";
  return OWN_DOMAINS.some((own) => domain === own || domain.endsWith(`.${own}`));
}

/**
 * Where forwards go: INBOUND_FORWARD_TO (comma-separated) when set, otherwise
 * the admin list (the founder first). Own-domain addresses are dropped so a
 * misconfiguration can never forward mail back into this inbox.
 */
export function forwardTargets(configured: string | undefined, admins: readonly string[]): string[] {
  const source = configured?.trim() ? configured.split(",") : admins;
  const seen = new Set<string>();
  for (const raw of source) {
    const address = bareAddress(raw);
    if (address.includes("@") && !isOwnAddress(address)) seen.add(address);
  }
  return [...seen];
}

/** One-line, length-capped title for the CRM task that tracks the reply. */
export function inboundTaskTitle(from: string, subject: string | null | undefined): string {
  const clean = (subject ?? "").replace(/\s+/g, " ").trim() || "(no subject)";
  return `Reply to ${bareAddress(from)}: ${clean}`.slice(0, 180);
}
