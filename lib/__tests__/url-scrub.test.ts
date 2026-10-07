import { scrubEvent, scrubUrl } from "@/lib/url-scrub";

describe("scrubUrl", () => {
  it("drops the signed token from absolute and relative URLs", () => {
    expect(scrubUrl("https://humanizeit.app/email/preferences?t=abc.def&u=1")).toBe("https://humanizeit.app/email/preferences?u=1");
    expect(scrubUrl("/free/confirmed?t=abc")).toBe("/free/confirmed");
    expect(scrubUrl("/free/guide/thanks?x=1&t=abc#top")).toBe("/free/guide/thanks?x=1#top");
  });

  it("leaves URLs without a token alone", () => {
    expect(scrubUrl("https://humanizeit.app/pricing?utm_source=x")).toBe("https://humanizeit.app/pricing?utm_source=x");
    expect(scrubUrl("/blog?tag=ai")).toBe("/blog?tag=ai");
  });
});

describe("scrubEvent", () => {
  it("scrubs event and person properties", () => {
    const out = scrubEvent({
      event: "$pageview",
      properties: { $current_url: "https://humanizeit.app/email/preferences?t=secret", $referrer: "https://humanizeit.app/free/confirmed?t=s2", n: 1 },
      $set_once: { $initial_current_url: "https://humanizeit.app/extension/confirmed?t=s3" },
    });
    expect(JSON.stringify(out)).not.toContain("secret");
    expect(JSON.stringify(out)).not.toContain("s2");
    expect(JSON.stringify(out)).not.toContain("s3");
    expect(out.properties?.n).toBe(1);
  });
});
