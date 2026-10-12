import {
  clearGoogleAnalyticsCookies,
  clearPostHogStorage,
  currentAnalyticsMode,
  isInternalDevice,
  isTrackingRefused,
  markInternalDevice,
  readAnalyticsSignals,
  setGoogleAnalyticsDisabled,
  setTrackingRefused,
} from "@/lib/analytics/browser";
import { ANALYTICS_CHOICE_EVENT } from "@/lib/analytics/consent";

// jest runs in node: a minimal fake window, enough for lib/analytics/browser.ts.
class FakeStorage {
  private map: Map<string, string>;
  constructor(initial: Record<string, string> = {}, private readonly broken = false) {
    this.map = new Map(Object.entries(initial));
  }
  private check() {
    if (this.broken) throw new Error("SecurityError");
  }
  get length() {
    this.check();
    return this.map.size;
  }
  key(i: number) {
    this.check();
    return [...this.map.keys()][i] ?? null;
  }
  getItem(key: string) {
    this.check();
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.check();
    this.map.set(key, String(value));
  }
  removeItem(key: string) {
    this.check();
    this.map.delete(key);
  }
  keys() {
    return [...this.map.keys()].sort();
  }
}

type Setup = {
  local?: Record<string, string>;
  session?: Record<string, string>;
  gpc?: boolean;
  timeZone?: string;
  cookie?: string;
  hostname?: string;
  brokenStorage?: boolean;
};

function setup(opts: Setup = {}) {
  const written: string[] = [];
  const events: string[] = [];
  const win = {
    localStorage: new FakeStorage(opts.local, opts.brokenStorage),
    sessionStorage: new FakeStorage(opts.session, opts.brokenStorage),
    navigator: { globalPrivacyControl: opts.gpc },
    location: { hostname: opts.hostname ?? "humanizeit.app" },
    document: {
      get cookie() {
        return opts.cookie ?? "";
      },
      set cookie(value: string) {
        written.push(value);
      },
    },
    dispatchEvent: (event: Event) => {
      events.push(event.type);
      return true;
    },
  };
  (globalThis as unknown as { window: unknown }).window = win;
  jest
    .spyOn(Intl, "DateTimeFormat")
    .mockImplementation((() => ({ resolvedOptions: () => ({ timeZone: opts.timeZone ?? "Africa/Tunis" }) })) as never);
  return { win, written, events };
}

afterEach(() => {
  jest.restoreAllMocks();
  delete (globalThis as unknown as { window?: unknown }).window;
});

describe("readAnalyticsSignals / currentAnalyticsMode", () => {
  it("reads the time zone, GPC, the refusal and the internal mark", () => {
    setup({ timeZone: "Europe/Berlin", gpc: true, local: { hz_attr_optout: "1", hz_internal: "1" } });
    expect(readAnalyticsSignals()).toEqual({
      timeZone: "Europe/Berlin",
      globalPrivacyControl: true,
      refused: true,
      internal: true,
    });
  });

  it("is full for a visitor outside consent regions", () => {
    setup({ timeZone: "Africa/Tunis" });
    expect(currentAnalyticsMode()).toBe("full");
  });

  it("is restricted in a consent region or with GPC", () => {
    setup({ timeZone: "Europe/Paris" });
    expect(currentAnalyticsMode()).toBe("restricted");
    setup({ gpc: true });
    expect(currentAnalyticsMode()).toBe("restricted");
  });

  it("is off after a refusal on /cookies", () => {
    setup({ local: { hz_attr_optout: "1" } });
    expect(isTrackingRefused()).toBe(true);
    expect(currentAnalyticsMode()).toBe("off");
    setup();
    expect(isTrackingRefused()).toBe(false);
  });

  it("is off on a device marked internal", () => {
    setup({ local: { hz_internal: "1" } });
    expect(isInternalDevice()).toBe(true);
    expect(currentAnalyticsMode()).toBe("off");
  });

  it("falls back to the time zone when storage is blocked", () => {
    setup({ brokenStorage: true, timeZone: "America/Chicago" });
    expect(currentAnalyticsMode()).toBe("full");
    setup({ brokenStorage: true, timeZone: "Europe/Madrid" });
    expect(currentAnalyticsMode()).toBe("restricted");
  });
});

describe("setTrackingRefused / markInternalDevice", () => {
  it("saves and clears the refusal and tells the page", () => {
    const { win, events } = setup();
    expect(setTrackingRefused(true)).toBe(true);
    expect(win.localStorage.getItem("hz_attr_optout")).toBe("1");
    expect(setTrackingRefused(false)).toBe(true);
    expect(win.localStorage.getItem("hz_attr_optout")).toBeNull();
    expect(events).toEqual([ANALYTICS_CHOICE_EVENT, ANALYTICS_CHOICE_EVENT]);
  });

  it("reports failure when the browser won't store the refusal", () => {
    const { events } = setup({ brokenStorage: true });
    expect(setTrackingRefused(true)).toBe(false);
    expect(events).toEqual([]);
  });

  it("marks the device as internal", () => {
    const { win, events } = setup();
    markInternalDevice();
    expect(win.localStorage.getItem("hz_internal")).toBe("1");
    expect(events).toEqual([ANALYTICS_CHOICE_EVENT]);
  });
});

describe("clearGoogleAnalyticsCookies", () => {
  it("expires every _ga cookie on the host and the top domain, and nothing else", () => {
    const { written } = setup({ cookie: "_ga=GA1.1.1.2; hz_ft=abc; _ga_L4X3P2W5FL=GS1; __session=s", hostname: "humanizeit.app" });
    clearGoogleAnalyticsCookies();
    expect(written.sort()).toEqual(
      [
        "_ga=; Max-Age=0; Path=/",
        "_ga=; Max-Age=0; Path=/; Domain=humanizeit.app",
        "_ga_L4X3P2W5FL=; Max-Age=0; Path=/",
        "_ga_L4X3P2W5FL=; Max-Age=0; Path=/; Domain=humanizeit.app",
      ].sort()
    );
  });

  it("writes nothing when there is no GA cookie", () => {
    const { written } = setup({ cookie: "hz_ft=abc" });
    clearGoogleAnalyticsCookies();
    expect(written).toEqual([]);
  });
});

describe("clearPostHogStorage", () => {
  it("removes PostHog's keys from local and session storage only", () => {
    const { win } = setup({
      local: { ph_phc_x_posthog: "{}", __ph_opt_in_out_phc_x: "0", hz_lead: "1", hz_attr_optout: "1" },
      session: { ph_phc_x_posthog: "{}", ph_phc_x_window_id: "w", "prefill-text": "hi" },
    });
    clearPostHogStorage();
    expect(win.localStorage.keys()).toEqual(["hz_attr_optout", "hz_lead"]);
    expect(win.sessionStorage.keys()).toEqual(["prefill-text"]);
  });

  it("never throws when storage is blocked", () => {
    setup({ brokenStorage: true });
    expect(() => clearPostHogStorage()).not.toThrow();
  });
});

describe("setGoogleAnalyticsDisabled", () => {
  it("sets Google's opt-out flag for the measurement id", () => {
    const { win } = setup();
    setGoogleAnalyticsDisabled("G-TEST", true);
    expect((win as unknown as Record<string, unknown>)["ga-disable-G-TEST"]).toBe(true);
    setGoogleAnalyticsDisabled("G-TEST", false);
    expect((win as unknown as Record<string, unknown>)["ga-disable-G-TEST"]).toBe(false);
  });

  it("does nothing without an id", () => {
    const { win } = setup();
    setGoogleAnalyticsDisabled(undefined, true);
    expect(Object.keys(win).some((k) => k.startsWith("ga-disable-"))).toBe(false);
  });
});
