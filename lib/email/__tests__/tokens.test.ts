import { createHmac } from "node:crypto";
import { TOKEN_TTL_SECONDS, signToken, verifyToken } from "@/lib/email/tokens";

const SECRET = "test-secret-0123456789abcdef0123456789";
const OLD_SECRET = "previous-secret-abcdef0123456789abcdef";
const NOW = Date.UTC(2026, 9, 6, 12, 0, 0);

const sign = (payload: Parameters<typeof signToken>[0], now = NOW) => signToken(payload, { secret: SECRET, now });
const verify = (token: string, purpose: Parameters<typeof verifyToken>[1], now = NOW, secrets = [SECRET]) =>
  verifyToken(token, purpose, { secrets, now });

function b64(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

describe("sign / verify", () => {
  it("round-trips each purpose", () => {
    expect(verify(sign({ p: "unsub", c: "c1", s: "marketing" }), "unsub")).toEqual({ p: "unsub", c: "c1", s: "marketing" });
    expect(verify(sign({ p: "prefs", c: "c1" }), "prefs")).toEqual({ p: "prefs", c: "c1" });
    expect(verify(sign({ p: "confirm", c: "c1", m: "ai-detection-field-guide" }), "confirm")).toMatchObject({
      p: "confirm",
      c: "c1",
      m: "ai-detection-field-guide",
    });
  });

  it("uses the v1.<payload>.<signature> format with URL-safe characters", () => {
    const token = sign({ p: "prefs", c: "c1" });
    expect(token).toMatch(/^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  });

  it("reads the secrets from the environment by default", () => {
    const saved = { ...process.env };
    process.env.EMAIL_TOKEN_SECRET = SECRET;
    delete process.env.EMAIL_TOKEN_SECRET_PREVIOUS;
    try {
      const token = signToken({ p: "prefs", c: "c9" });
      expect(verifyToken(token, "prefs")).toEqual({ p: "prefs", c: "c9" });
    } finally {
      process.env = saved;
    }
  });

  it("refuses to sign without a secret, and verifies nothing without one", () => {
    expect(() => signToken({ p: "prefs", c: "c1" }, { secret: "  " })).toThrow("EMAIL_TOKEN_SECRET");
    expect(verifyToken(sign({ p: "prefs", c: "c1" }), "prefs", { secrets: [] })).toBeNull();
  });
});

describe("tampering", () => {
  const token = sign({ p: "unsub", c: "contact_1", s: "lifecycle" });
  const [version, payload, signature] = token.split(".");

  it("rejects a modified payload", () => {
    const forged = b64({ p: "unsub", c: "contact_2", s: "lifecycle" });
    expect(verify(`${version}.${forged}.${signature}`, "unsub")).toBeNull();
  });

  it("rejects a modified signature", () => {
    const flipped = signature.slice(0, -1) + (signature.endsWith("A") ? "B" : "A");
    expect(verify(`${version}.${payload}.${flipped}`, "unsub")).toBeNull();
    expect(verify(`${version}.${payload}.${signature}x`, "unsub")).toBeNull();
    expect(verify(`${version}.${payload}.`, "unsub")).toBeNull();
  });

  it("rejects a token signed with another secret", () => {
    const other = signToken({ p: "unsub", c: "contact_1" }, { secret: "someone-else", now: NOW });
    expect(verify(other, "unsub")).toBeNull();
  });

  it("rejects malformed tokens", () => {
    for (const bad of ["", "v1", "v1.abc", "v2." + payload + "." + signature, `${token}.extra`, "x".repeat(3000)]) {
      expect(verify(bad, "unsub")).toBeNull();
    }
    expect(verifyToken(null, "unsub", { secrets: [SECRET] })).toBeNull();
  });

  it("rejects a validly signed payload with a bad shape", () => {
    const signRaw = (value: unknown) => {
      const encoded = b64(value);
      const sig = createHmac("sha256", SECRET).update(`v1.${encoded}`).digest("base64url");
      return `v1.${encoded}.${sig}`;
    };
    expect(verify(signRaw({ p: "unsub", c: "c1" }), "unsub")).toEqual({ p: "unsub", c: "c1" });
    expect(verify(signRaw({ p: "unsub", c: "" }), "unsub")).toBeNull();
    expect(verify(signRaw({ p: "unsub", c: "c1", s: "everything" }), "unsub")).toBeNull();
    expect(verify(signRaw({ p: "confirm", c: "c1", m: "not-a-magnet" }), "confirm")).toBeNull();
    expect(verify(signRaw({ p: "unlock", c: "c1" }), "unsub")).toBeNull();
    expect(verify(signRaw(["unsub", "c1"]), "unsub")).toBeNull();
  });
});

describe("purpose", () => {
  it("rejects a token used for another purpose", () => {
    const prefs = sign({ p: "prefs", c: "c1" });
    expect(verify(prefs, "unsub")).toBeNull();
    expect(verify(prefs, "confirm")).toBeNull();
    expect(verify(sign({ p: "confirm", c: "c1" }), "prefs")).toBeNull();
  });
});

describe("expiry", () => {
  const ttlMs = (TOKEN_TTL_SECONDS.confirm ?? 0) * 1000;

  it("gives confirm tokens a 30-day expiry", () => {
    expect(TOKEN_TTL_SECONDS.confirm).toBe(30 * 24 * 60 * 60);
    const payload = verify(sign({ p: "confirm", c: "c1" }), "confirm");
    expect(payload?.x).toBe(Math.floor(NOW / 1000) + 30 * 24 * 60 * 60);
  });

  it("accepts a confirm token until it expires, then rejects it", () => {
    const token = sign({ p: "confirm", c: "c1" });
    expect(verify(token, "confirm", NOW + ttlMs - 1000)).not.toBeNull();
    expect(verify(token, "confirm", NOW + ttlMs)).toBeNull();
  });

  it("honors an explicit expiry", () => {
    const token = sign({ p: "prefs", c: "c1", x: Math.floor(NOW / 1000) + 60 });
    expect(verify(token, "prefs", NOW + 59_000)).not.toBeNull();
    expect(verify(token, "prefs", NOW + 61_000)).toBeNull();
  });

  it("never expires unsubscribe and preference tokens", () => {
    const tenYears = 10 * 365 * 24 * 60 * 60 * 1000;
    expect(verify(sign({ p: "unsub", c: "c1", s: "all" }), "unsub", NOW + tenYears)).not.toBeNull();
    expect(verify(sign({ p: "prefs", c: "c1" }), "prefs", NOW + tenYears)).not.toBeNull();
  });
});

describe("secret rotation", () => {
  it("accepts tokens signed with the previous secret during rotation", () => {
    const old = signToken({ p: "unsub", c: "c1", s: "marketing" }, { secret: OLD_SECRET, now: NOW });
    expect(verify(old, "unsub", NOW, [SECRET])).toBeNull();
    expect(verify(old, "unsub", NOW, [SECRET, OLD_SECRET])).toEqual({ p: "unsub", c: "c1", s: "marketing" });
  });

  it("reads EMAIL_TOKEN_SECRET_PREVIOUS from the environment", () => {
    const saved = { ...process.env };
    process.env.EMAIL_TOKEN_SECRET = SECRET;
    process.env.EMAIL_TOKEN_SECRET_PREVIOUS = OLD_SECRET;
    try {
      const old = signToken({ p: "prefs", c: "c1" }, { secret: OLD_SECRET });
      expect(verifyToken(old, "prefs")).toEqual({ p: "prefs", c: "c1" });
    } finally {
      process.env = saved;
    }
  });
});
