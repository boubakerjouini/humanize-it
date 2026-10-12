// instrumentation-client.ts runs once per page load, before hydration. These
// tests load it in a fake browser and check what it hands to posthog.init.

const mockInit = jest.fn();
jest.mock("posthog-js", () => ({ __esModule: true, default: { init: (...args: unknown[]) => mockInit(...args) } }));

type BeforeSend = (event: Record<string, unknown> | null) => Record<string, unknown> | null;

function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    get length() {
      return map.size;
    },
    key: (i: number) => [...map.keys()][i] ?? null,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, String(value)),
    removeItem: (key: string) => void map.delete(key),
    keys: () => [...map.keys()].sort(),
  };
}

type Page = {
  hostname?: string;
  pathname?: string;
  timeZone?: string;
  gpc?: boolean;
  local?: Record<string, string>;
  session?: Record<string, string>;
};

async function loadPage(page: Page = {}) {
  mockInit.mockClear();
  const local = fakeStorage(page.local);
  const session = fakeStorage(page.session);
  const location = { hostname: page.hostname ?? "humanizeit.app", pathname: page.pathname ?? "/" };
  (globalThis as unknown as { window: unknown }).window = {
    location,
    localStorage: local,
    sessionStorage: session,
    navigator: { globalPrivacyControl: page.gpc },
  };
  jest
    .spyOn(Intl, "DateTimeFormat")
    .mockImplementation((() => ({ resolvedOptions: () => ({ timeZone: page.timeZone ?? "Africa/Tunis" }) })) as never);
  await jest.isolateModulesAsync(async () => {
    await import("@/instrumentation-client");
  });
  const options = mockInit.mock.calls[0]?.[1] as Record<string, unknown> | undefined;
  return { local, session, location, calls: mockInit.mock.calls.length, options };
}

const originalKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
beforeAll(() => {
  process.env.NEXT_PUBLIC_POSTHOG_KEY = "phc_test";
});
afterAll(() => {
  if (originalKey === undefined) delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
  else process.env.NEXT_PUBLIC_POSTHOG_KEY = originalKey;
});
afterEach(() => {
  jest.restoreAllMocks();
  delete (globalThis as unknown as { window?: unknown }).window;
});

describe("PostHog init", () => {
  it("keeps today's config outside consent regions", async () => {
    const { calls, options } = await loadPage({ timeZone: "Africa/Tunis" });
    expect(calls).toBe(1);
    expect(mockInit.mock.calls[0][0]).toBe("phc_test");
    expect(options).toMatchObject({ persistence: "localStorage", autocapture: false, capture_pageview: false });
    expect(options).not.toHaveProperty("cookieless_mode");
    expect(options).not.toHaveProperty("person_profiles");
  });

  it("goes cookieless, without person profiles, for restricted visitors", async () => {
    for (const page of [{ timeZone: "Europe/Paris" }, { gpc: true }]) {
      const { options } = await loadPage(page);
      expect(options).toMatchObject({ cookieless_mode: "always", person_profiles: "never" });
    }
  });

  it("doesn't start after a refusal on /cookies, wherever the device is, and deletes what PostHog stored", async () => {
    for (const timeZone of ["Africa/Tunis", "Europe/Paris"]) {
      const { calls, local, session } = await loadPage({
        timeZone,
        local: { hz_attr_optout: "1", ph_phc_test_posthog: '{"distinct_id":"old"}', __ph_opt_in_out_phc_test: "0", hz_lead: "1" },
        session: { ph_phc_test_posthog: "{}" },
      });
      expect(calls).toBe(0);
      expect(local.keys()).toEqual(["hz_attr_optout", "hz_lead"]);
      expect(session.keys()).toEqual([]);
    }
  });

  it("deletes what PostHog stored earlier before a cookieless start", async () => {
    const { local, session } = await loadPage({
      timeZone: "Europe/London",
      local: { ph_phc_test_posthog: '{"distinct_id":"old"}', __ph_opt_in_out_phc_test: "0", hz_lead: "1" },
      session: { ph_phc_test_posthog: "{}", ph_phc_test_window_id: "w" },
    });
    expect(local.keys()).toEqual(["hz_lead"]);
    expect(session.keys()).toEqual([]);
  });

  it("doesn't start on our own devices", async () => {
    const { calls } = await loadPage({ local: { hz_internal: "1" } });
    expect(calls).toBe(0);
  });

  it("doesn't start off the production host", async () => {
    for (const hostname of ["localhost", "humanize-it-git-x.vercel.app", "humanizeit.app.evil.com"]) {
      const { calls } = await loadPage({ hostname });
      expect(calls).toBe(0);
    }
    expect((await loadPage({ hostname: "www.humanizeit.app" })).calls).toBe(1);
  });
});

describe("PostHog before_send", () => {
  it("drops /admin events, using the page path when the event has none", async () => {
    const { options, location } = await loadPage();
    const beforeSend = options!.before_send as BeforeSend;
    expect(beforeSend({ event: "$pageview", properties: { $pathname: "/admin/funnel" } })).toBeNull();
    location.pathname = "/admin";
    expect(beforeSend({ event: "$snapshot", properties: {} })).toBeNull();
  });

  it("drops everything once the device is marked internal during the visit", async () => {
    const { options, local } = await loadPage();
    const beforeSend = options!.before_send as BeforeSend;
    const event = { event: "$pageview", properties: { $pathname: "/ai-detector" } };
    expect(beforeSend(event)).not.toBeNull();
    local.setItem("hz_internal", "1");
    expect(beforeSend(event)).toBeNull();
  });

  it("drops everything once this browser refuses on /cookies, in this tab or another", async () => {
    for (const timeZone of ["Africa/Tunis", "Europe/Paris"]) {
      const { options, local } = await loadPage({ timeZone });
      const beforeSend = options!.before_send as BeforeSend;
      const event = { event: "free_check_completed", properties: { $pathname: "/ai-detector" } };
      expect(beforeSend(event)).not.toBeNull();
      local.setItem("hz_attr_optout", "1");
      expect(beforeSend(event)).toBeNull();
    }
  });

  it("still strips the signed email-link token", async () => {
    const { options } = await loadPage({ timeZone: "Europe/Paris" });
    const beforeSend = options!.before_send as BeforeSend;
    const out = beforeSend({
      event: "$pageview",
      properties: { $pathname: "/email/preferences", $current_url: "https://humanizeit.app/email/preferences?t=secret" },
    });
    expect(JSON.stringify(out)).not.toContain("secret");
    expect(beforeSend(null)).toBeNull();
  });
});
