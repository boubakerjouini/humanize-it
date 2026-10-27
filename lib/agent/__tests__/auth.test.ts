// The agent API's only gate: a bearer token checked against its SHA-256, the
// API off (404) while no hash is configured.

jest.mock("@/lib/db", () => ({ db: {} }));
jest.mock("@/lib/crm/contacts", () => ({ getOrCreateContactForUser: jest.fn() }));

import { createHash } from "node:crypto";
import { agentTokenMatches, requireAgent } from "@/lib/agent/auth";

const TOKEN = "hia_0123456789abcdefghijklmnopqrstuvwxyzABCDEF";
const HASH = createHash("sha256").update(TOKEN).digest("hex");
const savedEnv = { ...process.env };

function request(authorization?: string) {
  return new Request("https://humanizeit.app/api/agent/inbox", { headers: authorization ? { authorization } : {} });
}

afterEach(() => {
  process.env = { ...savedEnv };
});

describe("agentTokenMatches", () => {
  it("accepts the token whose SHA-256 is configured, whatever the hex case", () => {
    expect(agentTokenMatches(`Bearer ${TOKEN}`, HASH)).toBe(true);
    expect(agentTokenMatches(`Bearer ${TOKEN}`, ` ${HASH.toUpperCase()} `)).toBe(true);
  });

  it("refuses another token, a missing scheme, extra words and an empty header", () => {
    expect(agentTokenMatches(`Bearer ${TOKEN}x`, HASH)).toBe(false);
    expect(agentTokenMatches(TOKEN, HASH)).toBe(false);
    expect(agentTokenMatches(`Bearer ${TOKEN} extra`, HASH)).toBe(false);
    expect(agentTokenMatches(null, HASH)).toBe(false);
  });

  it("refuses everything when the configured value isn't a SHA-256, even the raw token itself", () => {
    expect(agentTokenMatches(`Bearer ${TOKEN}`, TOKEN)).toBe(false);
    expect(agentTokenMatches(`Bearer ${TOKEN}`, undefined)).toBe(false);
    expect(agentTokenMatches(`Bearer ${TOKEN}`, HASH.slice(1))).toBe(false);
  });
});

describe("requireAgent", () => {
  it("answers 404 while the API is off, so it looks absent", () => {
    delete process.env.AGENT_API_TOKEN_SHA256;
    expect(() => requireAgent(request(`Bearer ${TOKEN}`))).toThrow(expect.objectContaining({ status: 404 }));
  });

  it("answers 401 for a missing or wrong token", () => {
    process.env.AGENT_API_TOKEN_SHA256 = HASH;
    expect(() => requireAgent(request())).toThrow(expect.objectContaining({ status: 401 }));
    expect(() => requireAgent(request("Bearer nope"))).toThrow(expect.objectContaining({ status: 401 }));
  });

  it("lets the right token through", () => {
    process.env.AGENT_API_TOKEN_SHA256 = HASH;
    expect(() => requireAgent(request(`Bearer ${TOKEN}`))).not.toThrow();
  });
});
