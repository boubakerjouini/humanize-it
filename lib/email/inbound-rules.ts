// ===========================================================
// lib/email/inbound-rules.ts — Pure rules for mail received at @humanizeit.app.
//
// humanizeit.app is a receive-only Resend domain: support@ and any other
// address on it land in Resend, which calls our webhook with email.received.
// lib/email/inbound.ts forwards each message to the founder; these helpers
// decide what is forwarded, who it goes to, how far the sender can be trusted
// and how the CRM task and the forward's banner read. Pure (no DB, no SDK), so
// they are unit-tested directly.
// ===========================================================

import { emailDomain, isRoleAddress, normalizeEmail } from "@/lib/email/address";

/** Domains we send from or receive on: forwarding mail from them could loop. */
export const OWN_DOMAINS: readonly string[] = ["humanizeit.app", "mail.humanizeit.app"];

/** Successful forwards per UTC day (Resend's free plan shares 100 sends a day with every other email). */
export const INBOUND_DAILY_CAP = 40;

/** Forwards per sender per day: one sender can't flood the founder or the quota. */
export const INBOUND_SENDER_DAILY_CAP = 5;

/** Above this the original isn't attached: the banner points to Resend instead. */
export const ORIGINAL_MAX_BYTES = 10 * 1024 * 1024;

/** Resend tag on every forward, so the webhook can ignore their delivery events. */
export const FORWARD_STREAM_TAG = { name: "stream", value: "inbound_forward" } as const;

/** Where the founder reads a message that wasn't forwarded. */
export const RESEND_INBOX_HINT = "Resend > Emails > Receiving";

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;

/** Control characters (NUL breaks Postgres, CR/LF break one-line fields) become spaces. */
export function stripControl(value: string): string {
  return value.replace(CONTROL_CHARS, " ");
}

/**
 * The bare, lower-cased address of an RFC 5322 value such as `Jane <jane@x.com>`.
 * The address is the LAST angle group: a display name can itself contain
 * `<...>` ("<ceo@humanizeit.app>" <evil@x.com>), so the first group can lie.
 */
export function bareAddress(value: string): string {
  const match = /<([^<>]*)>\s*$/.exec(value);
  return stripControl(match ? match[1] : value).trim().toLowerCase();
}

/** True when the address is on one of our own domains (or a subdomain of them). */
export function isOwnAddress(value: string): boolean {
  const domain = bareAddress(value).split("@")[1] ?? "";
  return OWN_DOMAINS.some((own) => domain === own || domain.endsWith(`.${own}`));
}

/**
 * Where forwards go: INBOUND_FORWARD_TO (comma-separated) when set, otherwise
 * the founder only. Addresses that can't receive a forward are dropped: our own
 * domains (loop), unconfirmed signup placeholders, and role inboxes.
 */
export function forwardTargets(configured: string | undefined, founder: string, placeholderSuffix: string): string[] {
  const source = configured?.trim() ? configured.split(",") : [founder];
  const seen = new Set<string>();
  for (const raw of source) {
    const address = normalizeEmail(bareAddress(raw));
    if (!address || isOwnAddress(address) || address.endsWith(placeholderSuffix) || isRoleAddress(address)) continue;
    seen.add(address);
  }
  return [...seen];
}

/**
 * Sender of the forwards: INBOUND_FORWARD_FROM when set, else an inbox@ address
 * on EMAIL_FROM's (verified) domain. Null when neither gives a usable address.
 */
export function forwardFrom(configured: string | undefined, emailFrom: string | undefined): string | null {
  const explicit = configured?.trim();
  if (explicit) return normalizeEmail(bareAddress(explicit)) ? explicit : null;
  const domain = emailDomain(bareAddress(emailFrom ?? ""));
  return domain ? `HumanizeIt Inbox <inbox@${domain}>` : null;
}

/** Case-insensitive header lookup (Resend returns the original header names). */
export function headerValue(headers: Record<string, string> | null | undefined, name: string): string | null {
  if (!headers) return null;
  const wanted = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === wanted) return typeof value === "string" ? value : String(value);
  }
  return null;
}

export type AutomatedReason = "auto_submitted" | "precedence" | "autoreply_header" | "delivery_report" | "role_sender";

/**
 * Why a message is machine-sent (out-of-office, bounce, list mail), or null for
 * a person. Forwarding those wastes sends, and a forwarded bounce or list
 * message can draw complaints against our sending domain.
 */
export function automatedReason(headers: Record<string, string> | null | undefined, from: string): AutomatedReason | null {
  const autoSubmitted = headerValue(headers, "Auto-Submitted")?.trim().toLowerCase();
  if (autoSubmitted && autoSubmitted !== "no") return "auto_submitted";
  const precedence = headerValue(headers, "Precedence")?.trim().toLowerCase();
  if (precedence && ["bulk", "junk", "list", "auto_reply"].includes(precedence)) return "precedence";
  if (headerValue(headers, "X-Autoreply") !== null || headerValue(headers, "X-Autorespond") !== null) return "autoreply_header";
  if (/^\s*multipart\/report\b/i.test(headerValue(headers, "Content-Type") ?? "")) return "delivery_report";
  if (isRoleAddress(bareAddress(from))) return "role_sender";
  return null;
}

export type AuthVerdict = "pass" | "fail" | "none" | "mixed";

export type SenderAuth = {
  spf: AuthVerdict;
  dkim: AuthVerdict;
  dmarc: AuthVerdict;
  /** DMARC passed for the From domain: only then is the sender treated as who they say. */
  verified: boolean;
};

function verdictOf(results: string[]): AuthVerdict {
  if (results.length === 0) return "none";
  if (results.every((r) => r === "pass")) return "pass";
  return results.some((r) => r === "pass") ? "mixed" : "fail";
}

/**
 * SPF/DKIM/DMARC from the Authentication-Results header the receiving server
 * added. A sender can forge an extra Authentication-Results header, so DMARC
 * counts as verified only when every dmarc= result passes and each one that
 * names header.from names the sender's own domain.
 */
export function senderAuth(headers: Record<string, string> | null | undefined, from: string): SenderAuth {
  const raw = headerValue(headers, "Authentication-Results") ?? "";
  const found: Record<"spf" | "dkim" | "dmarc", string[]> = { spf: [], dkim: [], dmarc: [] };
  const senderDomain = emailDomain(bareAddress(from));
  let alignedFrom = true;
  for (const clause of raw.split(/[;\n]/)) {
    const m = /^\s*(spf|dkim|dmarc)\s*=\s*([a-z]+)/i.exec(clause);
    if (!m) continue;
    const method = m[1].toLowerCase() as "spf" | "dkim" | "dmarc";
    found[method].push(m[2].toLowerCase());
    if (method === "dmarc") {
      const headerFrom = /header\.from\s*=\s*([^\s;]+)/i.exec(clause)?.[1]?.toLowerCase();
      if (headerFrom && headerFrom !== senderDomain) alignedFrom = false;
    }
  }
  const dmarc = verdictOf(found.dmarc);
  return {
    spf: verdictOf(found.spf),
    dkim: verdictOf(found.dkim),
    dmarc,
    verified: dmarc === "pass" && alignedFrom && !!senderDomain,
  };
}

/** "SPF pass, DKIM pass, DMARC fail" */
export function describeAuth(auth: SenderAuth): string {
  return `SPF ${auth.spf}, DKIM ${auth.dkim}, DMARC ${auth.dmarc}`;
}

export const UNVERIFIED_WARNING = "Sender NOT verified (DMARC did not pass): confirm identity before refunds or deletions.";

/** One-line, control-free subject, or "(no subject)". */
export function cleanSubject(subject: string | null | undefined, max = 150): string {
  return stripControl(subject ?? "").replace(/\s+/g, " ").trim().slice(0, max) || "(no subject)";
}

/** One-line, length-capped title for the CRM task that tracks the reply. */
export function inboundTaskTitle(from: string, subject: string | null | undefined): string {
  return `Reply to ${bareAddress(from)}: ${cleanSubject(subject, 180)}`.slice(0, 180);
}

/** Only the addresses on our domains it was delivered to (never third parties in To/Cc). */
export function ownRecipients(receivedFor: readonly string[] | null | undefined): string[] {
  const seen = new Set<string>();
  for (const raw of receivedFor ?? []) {
    const address = normalizeEmail(bareAddress(raw));
    if (address && isOwnAddress(address)) seen.add(address);
  }
  return [...seen];
}

/** Base body of the per-email task. Status lines are appended as the forward progresses. */
export function inboundTaskBody(input: { receivedFor: readonly string[]; auth: SenderAuth | null }): string {
  const at = input.receivedFor.length > 0 ? input.receivedFor.join(", ") : "an @humanizeit.app address";
  const lines = [
    `Received at ${at}. It should be in your inbox as a forward; if it isn't, read it in ${RESEND_INBOX_HINT}.`,
    input.auth ? `Sender check: ${describeAuth(input.auth)}.` : "Sender check: not available.",
  ];
  if (!input.auth?.verified) lines.push(UNVERIFIED_WARNING);
  return lines.join("\n");
}

/**
 * Plain-text banner of the forward. The original message travels only as an
 * attached original.eml, so its (untrusted) HTML is never shown as our mail.
 */
export function forwardBanner(input: {
  sender: string;
  subject: string;
  auth: SenderAuth;
  receivedFor: readonly string[];
  tasksUrl: string;
  attachment: "attached" | "too_large" | "unavailable";
}): string {
  const lines = [
    `New email to ${input.receivedFor.length > 0 ? input.receivedFor.join(", ") : "@humanizeit.app"}.`,
    "",
    `From: ${input.sender}`,
    `Subject: ${input.subject}`,
    `Sender check: ${describeAuth(input.auth)}`,
  ];
  if (!input.auth.verified) lines.push(UNVERIFIED_WARNING);
  lines.push("", `Hit Reply to answer ${input.sender} directly, then complete the task: ${input.tasksUrl}`, "");
  if (input.attachment === "attached") lines.push("The original message is attached as original.eml.");
  else if (input.attachment === "too_large") lines.push(`The original is over 10 MB, so it isn't attached: read it in ${RESEND_INBOX_HINT}.`);
  else lines.push(`The original couldn't be attached: read it in ${RESEND_INBOX_HINT}.`);
  lines.push("It comes from outside: don't open links or attachments you weren't expecting.");
  return lines.join("\n");
}
