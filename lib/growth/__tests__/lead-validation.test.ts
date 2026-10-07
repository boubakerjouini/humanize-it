import {
  MIN_FILL_MS,
  checkEmailQuality,
  checkMailDomain,
  deliveryFlow,
  isLikelyBot,
  leadKind,
  leadRequestSchema,
  recipientLimitKey,
  type MailResolver,
} from "@/lib/growth/lead-validation";
import { isDisposableDomain } from "@/lib/growth/disposable-domains";
import { fixForPattern, GENERIC_FIX, hasPatternFix } from "@/lib/growth/pattern-fixes";
import { MAGNETS, MAGNET_LIST, getMagnet, magnetForPost } from "@/lib/growth/magnets";
import { MAGNET_SLUGS } from "@/lib/growth/constants";
import { PATTERNS_CONFIG } from "@/lib/algorithms/patterns";

const base = { email: "sam@example.com", elapsedMs: 4000 };

describe("leadRequestSchema", () => {
  it("accepts a magnet capture and defaults topics to none", () => {
    const r = leadRequestSchema.safeParse({ ...base, source: "magnet_page", magnet: "ai-detection-field-guide" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.topics).toEqual([]);
  });

  it("rejects sources a public form may not claim", () => {
    expect(leadRequestSchema.safeParse({ ...base, source: "signup" }).success).toBe(false);
    expect(leadRequestSchema.safeParse({ ...base, source: "manual" }).success).toBe(false);
  });

  it("requires a magnet for magnet sources", () => {
    for (const source of ["magnet_page", "exit_intent", "blog_inline"]) {
      expect(leadRequestSchema.safeParse({ ...base, source }).success).toBe(false);
    }
  });

  it("requires the report context for detector reports, and never accepts the text", () => {
    expect(leadRequestSchema.safeParse({ ...base, source: "detector_report" }).success).toBe(false);
    const ok = { ...base, source: "detector_report", context: { instantScore: 62, patterns: [{ id: "filler", label: "Filler Phrases", hits: 3 }] } };
    expect(leadRequestSchema.safeParse(ok).success).toBe(true);
    expect(leadRequestSchema.safeParse({ ...ok, text: "my essay" }).success).toBe(false);
    expect(leadRequestSchema.safeParse({ ...ok, context: { ...ok.context, text: "my essay" } }).success).toBe(false);
  });

  it("bounds the report context", () => {
    const patterns = Array.from({ length: 13 }, (_, i) => ({ id: `p${i}`, label: "x", hits: 1 }));
    const ctx = { instantScore: 50, patterns };
    expect(leadRequestSchema.safeParse({ ...base, source: "detector_report", context: ctx }).success).toBe(false);
    expect(
      leadRequestSchema.safeParse({ ...base, source: "detector_report", context: { instantScore: 101, patterns: [] } }).success
    ).toBe(false);
  });

  it("ties topics to the right forms", () => {
    expect(leadRequestSchema.safeParse({ ...base, source: "extension_waitlist" }).success).toBe(false);
    expect(leadRequestSchema.safeParse({ ...base, source: "extension_waitlist", topics: ["extension_launch"] }).success).toBe(true);
    expect(leadRequestSchema.safeParse({ ...base, source: "founding_waitlist" }).success).toBe(false);
    expect(leadRequestSchema.safeParse({ ...base, source: "founding_waitlist", topics: ["tips"] }).success).toBe(true);
    expect(
      leadRequestSchema.safeParse({ ...base, source: "magnet_page", magnet: "ai-detection-field-guide", topics: ["extension_launch"] }).success
    ).toBe(false);
    expect(leadRequestSchema.safeParse({ ...base, source: "magnet_page", magnet: "ai-detection-field-guide", topics: ["spam"] }).success).toBe(false);
  });
});

describe("isLikelyBot", () => {
  it("flags a filled honeypot or a too-fast submit", () => {
    expect(isLikelyBot({ hp: "https://spam.example", elapsedMs: 9000 })).toBe(true);
    expect(isLikelyBot({ elapsedMs: MIN_FILL_MS - 1 })).toBe(true);
    expect(isLikelyBot({})).toBe(true);
    expect(isLikelyBot({ hp: "", elapsedMs: MIN_FILL_MS })).toBe(false);
  });
});

describe("checkEmailQuality", () => {
  it("normalizes a good address", () => {
    expect(checkEmailQuality("  Sam@Example.COM ")).toEqual({ ok: true, email: "sam@example.com", domain: "example.com" });
  });

  it("rejects malformed and role addresses", () => {
    expect(checkEmailQuality("not-an-email")).toMatchObject({ ok: false, code: "INVALID_EMAIL" });
    expect(checkEmailQuality("noreply@example.com")).toMatchObject({ ok: false, code: "INVALID_EMAIL" });
    expect(checkEmailQuality("postmaster@example.com")).toMatchObject({ ok: false, code: "INVALID_EMAIL" });
  });

  it("rejects throwaway domains, including their subdomains", () => {
    expect(checkEmailQuality("x@mailinator.com")).toMatchObject({ ok: false, code: "DISPOSABLE_EMAIL" });
    expect(isDisposableDomain("inbox.mailinator.com")).toBe(true);
    expect(isDisposableDomain("gmail.com")).toBe(false);
    expect(isDisposableDomain("outlook.com")).toBe(false);
    expect(isDisposableDomain("")).toBe(false);
  });
});

describe("checkMailDomain", () => {
  const notFound = () => Promise.reject(Object.assign(new Error("nf"), { code: "ENOTFOUND" }));
  const resolver = (over: Partial<MailResolver> = {}): MailResolver => ({
    resolveMx: notFound,
    resolve4: notFound,
    resolve6: notFound,
    ...over,
  });

  it("accepts a domain with MX records", async () => {
    const r = resolver({ resolveMx: async () => [{ exchange: "mx.example.com", priority: 10 }] });
    await expect(checkMailDomain("example.com", { resolver: r })).resolves.toBe("ok");
  });

  it("falls back to A records when there is no MX", async () => {
    const r = resolver({ resolve4: async () => ["93.184.216.34"] });
    await expect(checkMailDomain("example.com", { resolver: r })).resolves.toBe("ok");
  });

  it("rejects a domain that doesn't exist, and a null MX", async () => {
    await expect(checkMailDomain("nope.invalid", { resolver: resolver() })).resolves.toBe("invalid");
    const nullMx = resolver({ resolveMx: async () => [{ exchange: "", priority: 0 }] });
    await expect(checkMailDomain("example.com", { resolver: nullMx })).resolves.toBe("invalid");
  });

  it("fails open on timeouts and resolver errors", async () => {
    const slow = resolver({ resolveMx: () => new Promise(() => {}) });
    await expect(checkMailDomain("example.com", { resolver: slow, timeoutMs: 20 })).resolves.toBe("ok");
    const broken = resolver({ resolveMx: () => Promise.reject(Object.assign(new Error("x"), { code: "ESERVFAIL" })) });
    await expect(checkMailDomain("example.com", { resolver: broken })).resolves.toBe("ok");
  });
});

describe("lead routing", () => {
  it("maps each source to its kind and email flow", () => {
    expect(deliveryFlow(leadKind("magnet_page"))).toBe("magnet_delivery");
    expect(deliveryFlow(leadKind("exit_intent"))).toBe("magnet_delivery");
    expect(deliveryFlow(leadKind("detector_report"))).toBe("detector_report");
    expect(deliveryFlow(leadKind("extension_waitlist"))).toBe("waitlist_confirm");
    expect(deliveryFlow(leadKind("founding_waitlist"))).toBe("doi_confirm");
  });

  it("keys the per-recipient limit by magnet, else by source", () => {
    expect(recipientLimitKey("h", "magnet_page", "ai-detection-field-guide")).toBe("lead:to:h:ai-detection-field-guide");
    expect(recipientLimitKey("h", "detector_report")).toBe("lead:to:h:detector_report");
  });
});

describe("magnets", () => {
  it("has an entry for every slug, with honest promises", () => {
    expect(MAGNET_LIST.map((m) => m.slug).sort()).toEqual([...MAGNET_SLUGS].sort());
    for (const m of MAGNET_LIST) {
      expect(m.bullets.length).toBeGreaterThan(2);
      expect(m.seo.description.length).toBeLessThanOrEqual(160);
      const copy = JSON.stringify(m).toLowerCase();
      expect(copy).not.toMatch(/bypass|undetectable ai text|guaranteed to pass|99%/);
    }
    expect(getMagnet("nope")).toBeNull();
    expect(getMagnet("ai-detection-field-guide")).toBe(MAGNETS["ai-detection-field-guide"]);
  });

  it("maps blog posts to a magnet with a field-guide default", () => {
    expect(magnetForPost("humanize-chatgpt-text")).toBe("linkedin-humanizer-checklist");
    expect(magnetForPost("unknown-post")).toBe("ai-detection-field-guide");
  });
});

describe("pattern fixes", () => {
  it("has a fix for every detector pattern, and a generic fallback", () => {
    for (const p of PATTERNS_CONFIG) expect(hasPatternFix(p.id)).toBe(true);
    expect(fixForPattern("made-up")).toBe(GENERIC_FIX);
  });
});
