import {
  INTERNAL_DEVICE_KEY,
  TRACKING_OPT_OUT_KEY,
  analyticsMode,
  expireCookieEverywhere,
  googleAnalyticsCookieNames,
  isAdminPath,
  isPostHogStorageKey,
  isReportable,
  urlPathname,
  type AnalyticsSignals,
} from "@/lib/analytics/consent";

const visitor = (over: Partial<AnalyticsSignals> = {}): AnalyticsSignals => ({
  timeZone: "Africa/Tunis",
  globalPrivacyControl: false,
  refused: false,
  internal: false,
  ...over,
});

describe("analyticsMode", () => {
  it("is full outside consent regions with no signal or refusal", () => {
    for (const timeZone of ["Africa/Tunis", "America/New_York", "Asia/Kolkata"]) {
      expect(analyticsMode(visitor({ timeZone }))).toBe("full");
    }
  });

  it("is restricted in EU, EEA, UK and CH time zones, and when the zone is unknown", () => {
    for (const timeZone of ["Europe/Paris", "Europe/London", "Europe/Zurich", "Atlantic/Reykjavik", "Indian/Reunion", null]) {
      expect(analyticsMode(visitor({ timeZone }))).toBe("restricted");
    }
  });

  it("is restricted with Global Privacy Control, wherever the device is", () => {
    expect(analyticsMode(visitor({ globalPrivacyControl: true }))).toBe("restricted");
  });

  it("is off after a refusal on /cookies, wherever the device is", () => {
    expect(analyticsMode(visitor({ refused: true }))).toBe("off");
    expect(analyticsMode(visitor({ refused: true, timeZone: "Europe/Paris", globalPrivacyControl: true }))).toBe("off");
  });

  it("is off on our own devices, whatever else applies", () => {
    expect(analyticsMode(visitor({ internal: true }))).toBe("off");
    expect(analyticsMode(visitor({ internal: true, timeZone: "Europe/Paris", refused: true }))).toBe("off");
  });
});

describe("storage keys", () => {
  it("reuses the attribution refusal, so earlier refusals still count", () => {
    expect(TRACKING_OPT_OUT_KEY).toBe("hz_attr_optout");
    expect(INTERNAL_DEVICE_KEY).toBe("hz_internal");
  });
});

describe("isAdminPath", () => {
  it("matches /admin and everything under it", () => {
    expect(isAdminPath("/admin")).toBe(true);
    expect(isAdminPath("/admin/")).toBe(true);
    expect(isAdminPath("/admin/contacts/abc")).toBe(true);
  });

  it("leaves other pages alone", () => {
    for (const path of ["/", "/dashboard", "/administrator", "/blog/admin", "", null, undefined]) {
      expect(isAdminPath(path)).toBe(false);
    }
  });
});

describe("urlPathname", () => {
  it("reads absolute and root-relative URLs", () => {
    expect(urlPathname("https://humanizeit.app/admin/users?x=1#top")).toBe("/admin/users");
    expect(urlPathname("/free/guide?t=abc")).toBe("/free/guide");
  });

  it("returns null for nothing", () => {
    expect(urlPathname("")).toBeNull();
    expect(urlPathname(null)).toBeNull();
  });
});

describe("isReportable", () => {
  it("drops /admin pages and internal devices only", () => {
    expect(isReportable({ pathname: "/ai-detector", internal: false })).toBe(true);
    expect(isReportable({ pathname: "/dashboard", internal: false })).toBe(true);
    expect(isReportable({ pathname: "/admin/funnel", internal: false })).toBe(false);
    expect(isReportable({ pathname: "/ai-detector", internal: true })).toBe(false);
  });
});

describe("googleAnalyticsCookieNames", () => {
  it("finds _ga and _ga_<container> and nothing else", () => {
    const header = "__session=x; _ga=GA1.1.1.2; hz_ft=abc; _ga_L4X3P2W5FL=GS1.1; _gac=1; my_ga=2";
    expect(googleAnalyticsCookieNames(header).sort()).toEqual(["_ga", "_ga_L4X3P2W5FL"]);
  });

  it("handles empty input", () => {
    expect(googleAnalyticsCookieNames("")).toEqual([]);
    expect(googleAnalyticsCookieNames(undefined)).toEqual([]);
  });
});

describe("expireCookieEverywhere", () => {
  it("deletes on the host and each parent domain, never a bare public suffix", () => {
    expect(expireCookieEverywhere("_ga", "humanizeit.app")).toEqual([
      "_ga=; Max-Age=0; Path=/",
      "_ga=; Max-Age=0; Path=/; Domain=humanizeit.app",
    ]);
    expect(expireCookieEverywhere("_ga", "www.humanizeit.app")).toEqual([
      "_ga=; Max-Age=0; Path=/",
      "_ga=; Max-Age=0; Path=/; Domain=www.humanizeit.app",
      "_ga=; Max-Age=0; Path=/; Domain=humanizeit.app",
    ]);
  });

  it("uses the host only for localhost and IP addresses", () => {
    expect(expireCookieEverywhere("_ga", "localhost")).toEqual(["_ga=; Max-Age=0; Path=/"]);
    expect(expireCookieEverywhere("_ga", "127.0.0.1")).toEqual(["_ga=; Max-Age=0; Path=/"]);
  });
});

describe("isPostHogStorageKey", () => {
  it("matches PostHog's keys only", () => {
    expect(isPostHogStorageKey("ph_phc_abc_posthog")).toBe(true);
    expect(isPostHogStorageKey("ph_phc_abc_window_id")).toBe(true);
    expect(isPostHogStorageKey("__ph_opt_in_out_phc_abc")).toBe(true);
    for (const key of ["hz_lead", "hz_attr_optout", "hz_internal", "humanizeit_onboarded", "prefill-text"]) {
      expect(isPostHogStorageKey(key)).toBe(false);
    }
  });
});
