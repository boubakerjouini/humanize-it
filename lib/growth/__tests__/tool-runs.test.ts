// Free-tool runs: only our own plain page paths are stored, scores are
// clamped, and a write that fails never breaks the tool.

const mockCreate = jest.fn();
jest.mock("@/lib/db", () => ({ db: { toolRun: { create: (...args: unknown[]) => mockCreate(...args) } } }));
jest.mock("@/lib/growth/safe", () => ({ logGrowthError: jest.fn() }));

import { buildTouch } from "@/lib/growth/attribution";
import { cleanToolPage, recordToolRun, refererPage, toolRunSource } from "@/lib/growth/tool-runs";

beforeEach(() => mockCreate.mockReset());

describe("cleanToolPage", () => {
  it("keeps a lower-cased path without query, hash or trailing slash", () => {
    expect(cleanToolPage("/AI-Detector/")).toBe("/ai-detector");
    expect(cleanToolPage("/bypass/turnitin?utm_source=x#top")).toBe("/bypass/turnitin");
    expect(cleanToolPage("/blog/best-ai-humanizer-tools")).toBe("/blog/best-ai-humanizer-tools");
    // The homepage hero has its own demo detector.
    expect(cleanToolPage("/")).toBe("/");
    expect(cleanToolPage("/?utm_source=x")).toBe("/");
  });

  it("refuses anything that isn't one of our plain paths", () => {
    for (const bad of ["https://evil.example/ai-detector", "ai-detector", "", "/a b", "/<script>", `/${"x".repeat(130)}`, 42, null]) {
      expect(cleanToolPage(bad)).toBeNull();
    }
  });
});

describe("refererPage", () => {
  const req = (referer?: string) => new Request("https://humanizeit.app/api/detect", { method: "POST", headers: referer ? { referer } : {} });

  it("reads our own Referer only", () => {
    expect(refererPage(req("https://humanizeit.app/gptzero-checker?x=1"))).toBe("/gptzero-checker");
    expect(refererPage(req("https://evil.example/gptzero-checker"))).toBeNull();
    expect(refererPage(req("not a url"))).toBeNull();
    expect(refererPage(req())).toBeNull();
  });
});

describe("toolRunSource", () => {
  it("prefers utm_source, then the channel", () => {
    expect(toolRunSource(buildTouch({ href: "https://humanizeit.app/ai-detector?utm_source=chatgpt.com", now: Date.now() }))).toBe("chatgpt.com");
    expect(toolRunSource(buildTouch({ href: "https://humanizeit.app/ai-detector", referrer: "https://www.bing.com/", now: Date.now() }))).toBe("organic_search");
    expect(toolRunSource(null)).toBeNull();
  });
});

describe("recordToolRun", () => {
  it("clamps the numbers and drops an unknown band", async () => {
    await recordToolRun({ tool: "detector_instant", page: "/ai-detector", wordCount: 812.6, score: 104, band: "bogus" });
    expect(mockCreate).toHaveBeenCalledWith({
      data: { tool: "detector_instant", page: "/ai-detector", wordCount: 813, score: 100, scoreAfter: null, band: null, userId: null, source: null },
    });
  });

  it("never throws when the write fails", async () => {
    mockCreate.mockRejectedValue(new Error("db down"));
    await expect(recordToolRun({ tool: "detector_deep", page: "/ai-detector", wordCount: 300, score: 55, band: "medium" })).resolves.toBeUndefined();
  });
});
