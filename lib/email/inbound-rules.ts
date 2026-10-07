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

/** Forward recipients per UTC day (Resend's free plan shares 100 sends a day with every other email). */
export const INBOUND_DAILY_CAP = 40;

/** New support emails tracked per UTC day: bounds the CRM tasks a spam run can open when nothing is being forwarded. */
export const INBOUND_TASK_DAILY_CAP = 60;

/** Inline sends a forward must leave free, so support mail (spam included) can't eat the welcome and magnet emails. */
export const INBOUND_INLINE_RESERVE = 10;

/** Forwards per sender per day: one sender can't flood the founder or the quota. */
export const INBOUND_SENDER_DAILY_CAP = 5;

/** Above this the original isn't attached: the banner points to Resend instead. */
export const ORIGINAL_MAX_BYTES = 10 * 1024 * 1024;

/** Resend tag on every forward, so the webhook keeps their delivery events off customer state. */
export const FORWARD_STREAM_TAG = { name: "stream", value: "inbound_forward" } as const;

/** Second tag on a forward: the received email's id, so a bounce can be written on its task. */
export const INBOUND_ID_TAG = "inbound";

/** Most of the plain-text body quoted in the forward (the full message stays in Resend). */
export const QUOTED_TEXT_MAX_CHARS = 8000;

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

export type AutomatedReason = "auto_submitted" | "precedence" | "autoreply_header" | "delivery_report" | "list" | "role_sender";

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
  if (headerValue(headers, "List-Id") !== null || headerValue(headers, "List-Unsubscribe") !== null) return "list";
  if (isRoleAddress(bareAddress(from))) return "role_sender";
  return null;
}

export type AuthVerdict = "pass" | "fail" | "none" | "mixed";

export type SenderAuth = {
  spf: AuthVerdict;
  dkim: AuthVerdict;
  dmarc: AuthVerdict;
  /** The verdicts come from our receiving server's header; false means nothing was checked. */
  checked: boolean;
  /** DMARC passed for the From domain: only then is the sender treated as who they say. */
  verified: boolean;
};

const UNCHECKED: SenderAuth = { spf: "none", dkim: "none", dmarc: "none", checked: false, verified: false };

/** The header block of a raw RFC 5322 message: everything before the first blank line. */
export function rawHeaderBlock(raw: string): string {
  const end = raw.search(/\r?\n\r?\n/);
  return end === -1 ? raw : raw.slice(0, end);
}

/** The TOPMOST instance of a header in a raw header block, unfolded, or null. */
export function topHeader(block: string, name: string): string | null {
  const wanted = name.toLowerCase();
  for (const line of block.replace(/\r?\n[ \t]+/g, " ").split(/\r?\n/)) {
    const colon = line.indexOf(":");
    if (colon > 0 && line.slice(0, colon).trim().toLowerCase() === wanted) return line.slice(colon + 1).trim();
  }
  return null;
}

/** An RFC 8601 result word: only an explicit fail fails; none, neutral and errors decide nothing. */
function resultOf(word: string): "pass" | "fail" | null {
  if (word === "pass") return "pass";
  return word === "fail" || word === "softfail" ? "fail" : null;
}

function verdictOf(words: string[]): AuthVerdict {
  const results = words.map(resultOf).filter((r) => r !== null);
  if (results.length === 0) return "none";
  if (results.every((r) => r === "pass")) return "pass";
  return results.some((r) => r === "pass") ? "mixed" : "fail";
}

// SES writes sender-controlled values (envelope-from, helo) between the clauses,
// and a quoted local part or an address literal can carry ";": drop quoted
// strings, comments and address literals before splitting on it.
const OPAQUE_TEXT = /"(?:[^"\\]|\\.)*"|\((?:[^()\\]|\\.)*\)|\[[^\]]*\]/g;

/**
 * SPF/DKIM/DMARC as our receiving server saw them. A sender can add their own
 * Authentication-Results headers, and the parsed headers Record may keep any
 * one of several, so the verdict comes from the raw header block only: the
 * TOPMOST Authentication-Results (a receiving MX prepends its own), and only
 * when its authserv-id is the pinned one (INBOUND_AUTHSERV_ID). Another id, no
 * header or no pin gives "not checked", never a pass.
 */
export function senderAuth(rawHeaders: string | null, from: string, authservId: string | null | undefined): SenderAuth {
  const pinned = authservId?.trim().toLowerCase();
  const header = rawHeaders ? topHeader(rawHeaders, "Authentication-Results") : null;
  if (!pinned || !header) return UNCHECKED;
  const [idPart, ...clauses] = header.replace(OPAQUE_TEXT, " ").split(";");
  if (idPart.trim().split(/\s+/)[0]?.toLowerCase() !== pinned) return UNCHECKED;

  const found: Record<"spf" | "dkim" | "dmarc", string[]> = { spf: [], dkim: [], dmarc: [] };
  const senderDomain = emailDomain(bareAddress(from));
  let alignedFrom = true;
  for (const clause of clauses) {
    const m = /^\s*(spf|dkim|dmarc)\s*=\s*([a-z]+)/i.exec(clause);
    if (!m) continue;
    const method = m[1].toLowerCase() as "spf" | "dkim" | "dmarc";
    found[method].push(m[2].toLowerCase());
    if (method === "dmarc") {
      const headerFrom = /header\.from\s*=\s*([^\s;]+)/i.exec(clause)?.[1]?.toLowerCase();
      if (headerFrom !== senderDomain) alignedFrom = false;
    }
  }
  // Any explicit DMARC fail wins, and a pass counts only as the header's one
  // dmarc clause: our server writes exactly one.
  const dmarc = found.dmarc.some((w) => resultOf(w) === "fail") ? "fail" : verdictOf(found.dmarc);
  return {
    spf: verdictOf(found.spf),
    dkim: verdictOf(found.dkim),
    dmarc,
    checked: true,
    verified: dmarc === "pass" && found.dmarc.length === 1 && alignedFrom && !!senderDomain,
  };
}

/** "SPF pass, DKIM pass, DMARC fail", or why nothing was checked. */
export function describeAuth(auth: SenderAuth): string {
  if (!auth.checked) return "not checked (no Authentication-Results from our receiving server)";
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

const RISKY_EXTENSION = /\.(exe|com|scr|pif|msi|bat|cmd|ps1|vbs|vbe|js|jse|wsf|hta|lnk|jar|zip|rar|7z|iso|img|html?)$/i;

const RISKY_TYPES = new Set([
  "application/x-msdownload",
  "application/x-msdos-program",
  "application/x-dosexec",
  "application/x-executable",
  "application/java-archive",
  "application/javascript",
  "text/javascript",
  "application/zip",
  "application/x-zip-compressed",
  "application/vnd.rar",
  "application/x-rar-compressed",
  "application/x-7z-compressed",
  "application/x-iso9660-image",
  "text/html",
]);

/**
 * True when an attachment is a program, script, archive or HTML file. Gmail
 * bounces mail carrying those (inside a nested .eml too), and a bounce can get
 * the founder's address suppressed for every later forward, so such an
 * original is not attached.
 */
export function hasRiskyAttachment(
  attachments: readonly { filename?: string | null; content_type?: string | null }[] | null | undefined
): boolean {
  return (attachments ?? []).some((a) => {
    const type = (a.content_type ?? "").split(";")[0].trim().toLowerCase();
    return RISKY_EXTENSION.test((a.filename ?? "").trim()) || RISKY_TYPES.has(type);
  });
}

/** In-Reply-To/References to the original, so the founder's reply threads with it on the customer's side. */
export function threadingHeaders(messageId: string | null | undefined): Record<string, string> {
  const id = messageId?.trim();
  return id && /^<[^<>\s]{1,250}>$/.test(id) ? { "In-Reply-To": id, References: id } : {};
}

// Control and invisible/bidi characters, except tab and newline.
const UNSAFE_TEXT = /[\u0000-\u0008\u000b-\u001f\u007f​-‏‪-‮⁦-⁩]/g;

/** The untrusted plain-text body as "> " quoted lines, capped; null when there is none. */
export function quotedText(text: string | null | undefined, max = QUOTED_TEXT_MAX_CHARS): string | null {
  const clean = (text ?? "").replace(/\r\n?/g, "\n").replace(UNSAFE_TEXT, "").trim();
  if (!clean) return null;
  const lines = clean.slice(0, max).split("\n").map((line) => `> ${line}`);
  if (clean.length > max) lines.push(`> [cut here: read the rest in ${RESEND_INBOX_HINT}]`);
  return lines.join("\n");
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
 * Plain-text banner of the forward, then the quoted plain-text body. The
 * original's (untrusted) HTML is never shown as our mail: it travels only
 * inside the attached original.eml.
 */
export function forwardBanner(input: {
  sender: string;
  subject: string;
  auth: SenderAuth;
  receivedFor: readonly string[];
  tasksUrl: string;
  attachment: "attached" | "too_large" | "unavailable" | "withheld";
  text?: string | null;
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
  else if (input.attachment === "withheld")
    lines.push(`Its attachments could be unsafe (programs, scripts or archives), so they were withheld: read it in ${RESEND_INBOX_HINT}.`);
  else lines.push(`The original couldn't be attached: read it in ${RESEND_INBOX_HINT}.`);
  lines.push("It comes from outside: don't open links or attachments you weren't expecting.");
  const quoted = quotedText(input.text);
  if (quoted) lines.push("", "--- Original message (plain text, untrusted) ---", quoted);
  return lines.join("\n");
}
