// ===========================================================
// lib/email/address.ts — Email address normalization and hashing (pure).
//
// Suppressions and sent-message rows store sha256(normalized address), never
// the address, so an erased contact stays suppressed without keeping PII.
// canonicalForLimits() folds Gmail dots and +tags; it is used only for
// anti-bombing rate limits, never as the address we send to.
// ===========================================================

import { createHash } from "node:crypto";

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;

export const ROLE_LOCAL_PARTS: readonly string[] = [
  "noreply",
  "no-reply",
  "donotreply",
  "do-not-reply",
  "mailer-daemon",
  "postmaster",
  "abuse",
];

const GMAIL_DOMAINS = new Set(["gmail.com", "googlemail.com"]);

/** trim + lower-case, or null when it isn't a plausible address. */
export function normalizeEmail(raw: string | null | undefined): string | null {
  const email = raw?.trim().toLowerCase();
  if (!email || email.length > MAX_EMAIL_LENGTH || !EMAIL_SHAPE.test(email)) return null;
  return email;
}

export function isValidEmail(raw: string | null | undefined): boolean {
  return normalizeEmail(raw) !== null;
}

function split(email: string): { local: string; domain: string } {
  const at = email.lastIndexOf("@");
  return { local: email.slice(0, at), domain: email.slice(at + 1) };
}

/** sha256 hex of the normalized address (falls back to the trimmed lower-case input). */
export function emailHash(raw: string): string {
  const email = normalizeEmail(raw) ?? raw.trim().toLowerCase();
  return createHash("sha256").update(email).digest("hex");
}

export function emailDomain(raw: string | null | undefined): string | null {
  const email = normalizeEmail(raw);
  return email ? split(email).domain : null;
}

/** noreply@, postmaster@, abuse@…: nobody reads these, and mail to them hurts reputation. */
export function isRoleAddress(raw: string | null | undefined): boolean {
  const email = normalizeEmail(raw);
  if (!email) return false;
  return ROLE_LOCAL_PARTS.includes(split(email).local);
}

/**
 * One key per real inbox for rate limits: drops "+tag" everywhere, and dots
 * for Gmail (googlemail.com folds into gmail.com). Not an address to send to.
 */
export function canonicalForLimits(raw: string): string {
  const email = normalizeEmail(raw) ?? raw.trim().toLowerCase();
  if (!email.includes("@")) return email;
  const { local, domain } = split(email);
  let canonicalLocal = local.split("+")[0] || local;
  let canonicalDomain = domain;
  if (GMAIL_DOMAINS.has(domain)) {
    canonicalLocal = canonicalLocal.replace(/\./g, "");
    canonicalDomain = "gmail.com";
  }
  return `${canonicalLocal}@${canonicalDomain}`;
}

export function canonicalHash(raw: string): string {
  return createHash("sha256").update(canonicalForLimits(raw)).digest("hex");
}

/** "bo***@gmail.com" for the preference center: enough to recognize, not to harvest. */
export function maskEmail(raw: string | null | undefined): string {
  const email = normalizeEmail(raw);
  if (!email) return "";
  const { local, domain } = split(email);
  const visible = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2);
  return `${visible}***@${domain}`;
}
