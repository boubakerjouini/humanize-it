// ===========================================================
// lib/agent/auth.ts — Bearer-token guard for /api/agent/*, the API the
// founder's AI agent (Claude Code, through scripts/agent-mcp.mjs) uses to run
// email: read the support inbox, reply, send test-first 1:1 notes, close
// tasks and report.
//
// The paths are public in middleware.ts, so this is the only gate. The env
// holds only the token's SHA-256 (AGENT_API_TOKEN_SHA256, hex); the token
// itself stays on the founder's machine, so a leaked env can't be replayed.
// Unset means the API is off and answers 404, as if it didn't exist.
// The agent acts for the founder: its tests go to the founder's own inbox,
// so the test-first rule still puts every email in front of them, and its
// actions are audited under AGENT_ACTOR.
// ===========================================================

import { createHash, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { founderEmail } from "@/lib/admin";
import { getOrCreateContactForUser } from "@/lib/crm/contacts";

/** Audit actor (and task completedBy) of everything the agent does. */
export const AGENT_ACTOR = "agent:claude";

const SHA256_HEX = /^[0-9a-f]{64}$/i;
/** One token of printable ASCII, no spaces. */
const BEARER = /^Bearer ([\x21-\x7e]+)$/;

function statusError(status: number, message: string): Error {
  return Object.assign(new Error(message), { status });
}

/** Constant-time check of an `Authorization: Bearer <token>` header against the token's SHA-256. */
export function agentTokenMatches(header: string | null, expectedSha256: string | undefined): boolean {
  const expected = expectedSha256?.trim() ?? "";
  if (!SHA256_HEX.test(expected) || !header) return false;
  const token = BEARER.exec(header.trim())?.[1];
  if (!token) return false;
  return timingSafeEqual(createHash("sha256").update(token).digest(), Buffer.from(expected, "hex"));
}

/** Throws an Error tagged with `status`: 404 while the API is off, 401 for a missing or wrong token. */
export function requireAgent(req: Request): void {
  const expected = process.env.AGENT_API_TOKEN_SHA256;
  if (!expected?.trim()) throw statusError(404, "Not found.");
  if (!agentTokenMatches(req.headers.get("authorization"), expected)) throw statusError(401, "Authentication required.");
}

/** The founder's address and own contact: where the agent's tests go, and what unlocks its sends. */
export async function founderInbox(): Promise<{ email: string; contactId: string } | null> {
  const founder = await db.user.findFirst({
    where: { email: { equals: founderEmail(), mode: "insensitive" } },
    select: { id: true, email: true },
  });
  if (!founder) return null;
  const contactId = await getOrCreateContactForUser(founder.id);
  return contactId ? { email: founder.email, contactId } : null;
}
