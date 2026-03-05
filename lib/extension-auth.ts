import crypto from "crypto";

const SECRET = process.env.EXTENSION_TOKEN_SECRET || "humanize-ext-secret-2026";

interface ExtTokenPayload {
  clerkId: string;
  email: string;
  plan: string;
  iat: number;
  exp: number;
}

function base64urlDecode(str: string): string {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/").padEnd(str.length + ((4 - (str.length % 4)) % 4), "=");
  return Buffer.from(padded, "base64").toString("utf8");
}

/**
 * Verifies a HumanizeIt extension JWT token.
 * Returns the payload if valid, null otherwise.
 */
export function verifyExtensionToken(token: string): ExtTokenPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [header, body, signature] = parts;

    // Verify signature
    const expectedSig = crypto
      .createHmac("sha256", SECRET)
      .update(`${header}.${body}`)
      .digest("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");

    if (signature !== expectedSig) return null;

    const payload = JSON.parse(base64urlDecode(body)) as ExtTokenPayload;

    // Check expiry
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
  // 1. Clerk session auth (webapp)
  if (clerkAuthId) return clerkAuthId;

  // 2. Extension Bearer token
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const payload = verifyExtensionToken(token);
    if (payload) return payload.clerkId;
  }

  return null;
}
