import crypto from "crypto";

/**
 * Resolve the extension-token signing secret. Fails closed: if the secret is
 * missing or too weak, signing/verification refuses rather than falling back to
 * a public, source-committed value. Set EXTENSION_TOKEN_SECRET to a random
 * 32+ byte value (e.g. `openssl rand -base64 48`) in the environment.
 */
function getSecret(): string {
  const s = process.env.EXTENSION_TOKEN_SECRET;
  if (!s || s.length < 24) {
    throw new Error(
      "EXTENSION_TOKEN_SECRET is not set (or too short). Refusing to sign/verify extension tokens."
    );
  }
  return s;
}

interface ExtTokenPayload {
  clerkId: string;
  email: string;
  plan: string;
  iat: number;
  exp: number;
}

function base64url(input: string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function base64urlDecode(str: string): string {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/").padEnd(str.length + ((4 - (str.length % 4)) % 4), "=");
  return Buffer.from(padded, "base64").toString("utf8");
}

function sign(headerDotBody: string): string {
  return crypto
    .createHmac("sha256", getSecret())
    .update(headerDotBody)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

/** Constant-time string comparison that never throws on length mismatch. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/**
 * Sign a HumanizeIt extension JWT. Throws if the secret is unset (fail closed).
 */
export function signExtensionToken(payload: ExtTokenPayload): string {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64url(JSON.stringify(payload));
  const sig = sign(`${header}.${body}`);
  return `${header}.${body}.${sig}`;
}

/**
 * Verify a HumanizeIt extension JWT. Returns the payload if valid, null otherwise.
 * Returns null (fails closed) if the signing secret is misconfigured.
 */
export function verifyExtensionToken(token: string): ExtTokenPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [header, body, signature] = parts;
    if (!safeEqual(signature, sign(`${header}.${body}`))) return null;

    const payload = JSON.parse(base64urlDecode(body)) as ExtTokenPayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;

    return payload;
  } catch {
    return null;
  }
}

/**
 * Extracts clerkId from either Clerk session auth or extension Bearer token.
 * Returns null if neither is valid.
 */
export function getClerkIdFromRequest(request: Request, clerkAuthId: string | null): string | null {
  if (clerkAuthId) return clerkAuthId;

  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const payload = verifyExtensionToken(token);
    if (payload) return payload.clerkId;
  }

  return null;
}
