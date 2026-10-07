// ===========================================================
// lib/email/tokens.ts — Signed, stateless email link tokens.
//
// Format: v1.<base64url(json payload)>.<base64url(HMAC-SHA256(secret, "v1." + payload))>
// Purposes: unsub (one-click unsubscribe), prefs (preference center), confirm
// (double opt-in). Unsubscribe and preference tokens never expire, so a link
// in a years-old email still works (CAN-SPAM wants at least 30 days). Confirm
// tokens expire after 30 days. EMAIL_TOKEN_SECRET_PREVIOUS keeps old links
// valid through a secret rotation.
// ===========================================================

import { createHmac, timingSafeEqual } from "node:crypto";
import { isMagnetSlug, type MagnetSlug } from "@/lib/growth/constants";

export type TokenPurpose = "unsub" | "prefs" | "confirm";
/** What a one-click unsubscribe withdraws. */
export type UnsubScope = "marketing" | "lifecycle" | "all";

export type TokenPayload = {
  p: TokenPurpose;
  /** contact id */
  c: string;
  s?: UnsubScope;
  m?: MagnetSlug;
  /** expiry, epoch seconds */
  x?: number;
};

export const TOKEN_TTL_SECONDS: Partial<Record<TokenPurpose, number>> = {
  confirm: 30 * 24 * 60 * 60,
};

const VERSION = "v1";
const MAX_TOKEN_LENGTH = 2048;
const UNSUB_SCOPES: readonly UnsubScope[] = ["marketing", "lifecycle", "all"];
const PURPOSES: readonly TokenPurpose[] = ["unsub", "prefs", "confirm"];

function sign(secret: string, encodedPayload: string): string {
  return createHmac("sha256", secret).update(`${VERSION}.${encodedPayload}`).digest("base64url");
}

function currentSecrets(): string[] {
  return [process.env.EMAIL_TOKEN_SECRET, process.env.EMAIL_TOKEN_SECRET_PREVIOUS].filter(
    (s): s is string => !!s && s.trim().length > 0
  );
}

/**
 * Sign a payload. Purposes with a TTL get `x` filled in when absent. Throws
 * when no secret is configured: a link that can't be verified is worse than none.
 */
export function signToken(payload: TokenPayload, opts: { secret?: string; now?: number } = {}): string {
  const secret = opts.secret ?? process.env.EMAIL_TOKEN_SECRET;
  if (!secret?.trim()) throw new Error("EMAIL_TOKEN_SECRET is not set");
  const body: TokenPayload = { ...payload };
  const ttl = TOKEN_TTL_SECONDS[payload.p];
  if (ttl && body.x === undefined) body.x = Math.floor((opts.now ?? Date.now()) / 1000) + ttl;
  const encoded = Buffer.from(JSON.stringify(body), "utf8").toString("base64url");
  return `${VERSION}.${encoded}.${sign(secret, encoded)}`;
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}

function parsePayload(encoded: string): TokenPayload | null {
  let raw: unknown;
  try {
    raw = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.p !== "string" || !PURPOSES.includes(o.p as TokenPurpose)) return null;
  if (typeof o.c !== "string" || o.c.length === 0 || o.c.length > 64) return null;
  const payload: TokenPayload = { p: o.p as TokenPurpose, c: o.c };
  if (o.s !== undefined) {
    if (typeof o.s !== "string" || !UNSUB_SCOPES.includes(o.s as UnsubScope)) return null;
    payload.s = o.s as UnsubScope;
  }
  if (o.m !== undefined) {
    if (!isMagnetSlug(o.m)) return null;
    payload.m = o.m;
  }
  if (o.x !== undefined) {
    if (typeof o.x !== "number" || !Number.isFinite(o.x)) return null;
    payload.x = o.x;
  }
  return payload;
}

/**
 * Verify a token for one purpose. Returns the payload, or null when the token is
 * malformed, tampered with, signed with an unknown secret, meant for another
 * purpose, or expired. Never throws.
 */
export function verifyToken(
  token: string | null | undefined,
  purpose: TokenPurpose,
  opts: { secrets?: string[]; now?: number } = {}
): TokenPayload | null {
  if (typeof token !== "string" || token.length === 0 || token.length > MAX_TOKEN_LENGTH) return null;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== VERSION) return null;
  const [, encoded, signature] = parts;
  if (!encoded || !signature) return null;

  const secrets = (opts.secrets ?? currentSecrets()).filter((s) => s.trim().length > 0);
  if (secrets.length === 0) return null;
  let valid = false;
  for (const secret of secrets) {
    // Check every secret (no early exit) so timing doesn't reveal which one matched.
    if (safeEqual(signature, sign(secret, encoded))) valid = true;
  }
  if (!valid) return null;

  const payload = parsePayload(encoded);
  if (!payload || payload.p !== purpose) return null;
  if (payload.x !== undefined && payload.x * 1000 <= (opts.now ?? Date.now())) return null;
  return payload;
}
