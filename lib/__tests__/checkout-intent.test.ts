import {
  afterAuthPath,
  authPageUrl,
  checkoutIntentPath,
  readCheckoutIntent,
  safeRedirectPath,
  signUpUrlFor,
  withoutCheckoutIntent,
} from "@/lib/checkout-intent";

describe("checkout intent", () => {
  it("builds the dashboard path for a plan and billing period", () => {
    expect(checkoutIntentPath({ plan: "PRO", annual: true })).toBe("/dashboard?checkout=pro&billing=annual");
    expect(checkoutIntentPath({ plan: "TEAM", annual: false })).toBe("/dashboard?checkout=team&billing=monthly");
  });

  it("reads the plan and billing period back", () => {
    expect(readCheckoutIntent("?checkout=pro&billing=annual")).toEqual({ plan: "PRO", annual: true });
    expect(readCheckoutIntent("?checkout=TEAM&billing=monthly")).toEqual({ plan: "TEAM", annual: false });
    // Missing or unknown billing falls back to annual, the plan menu's default.
    expect(readCheckoutIntent("?checkout=pro")).toEqual({ plan: "PRO", annual: true });
    expect(readCheckoutIntent("?checkout=pro&billing=weekly")).toEqual({ plan: "PRO", annual: true });
  });

  it("ignores anything that is not a paid plan", () => {
    expect(readCheckoutIntent("")).toBeNull();
    expect(readCheckoutIntent("?checkout=free")).toBeNull();
    expect(readCheckoutIntent("?checkout=enterprise&billing=annual")).toBeNull();
    expect(readCheckoutIntent("?plan=pro")).toBeNull();
  });

  it("survives the trip through sign-up", () => {
    for (const intent of [{ plan: "PRO", annual: true }, { plan: "TEAM", annual: false }] as const) {
      const signUp = new URL(signUpUrlFor(intent), "https://humanizeit.app");
      expect(signUp.pathname).toBe("/sign-up");
      const target = afterAuthPath(signUp.searchParams.get("redirect_url") ?? undefined);
      expect(target).toBe(checkoutIntentPath(intent));
      expect(readCheckoutIntent(new URL(target, "https://humanizeit.app").search)).toEqual(intent);
    }
  });

  it("strips only the intent parameters from the address", () => {
    expect(withoutCheckoutIntent("/dashboard?checkout=pro&billing=annual")).toBe("/dashboard");
    expect(withoutCheckoutIntent("/dashboard?checkout=team&billing=monthly&doc=4#top")).toBe("/dashboard?doc=4#top");
    expect(withoutCheckoutIntent("https://humanizeit.app/dashboard?billing=annual&checkout=pro")).toBe("https://humanizeit.app/dashboard");
  });
});

describe("safeRedirectPath", () => {
  it("accepts paths on this site", () => {
    expect(safeRedirectPath("/dashboard")).toBe("/dashboard");
    expect(safeRedirectPath("/lifetime")).toBe("/lifetime");
    expect(safeRedirectPath("/dashboard?checkout=pro&billing=annual")).toBe("/dashboard?checkout=pro&billing=annual");
    expect(safeRedirectPath("/dashboard/editor")).toBe("/dashboard/editor");
    expect(safeRedirectPath("/sign-upgrade")).toBe("/sign-upgrade");
  });

  it("normalizes dot segments", () => {
    expect(safeRedirectPath("/free/../dashboard")).toBe("/dashboard");
  });

  it("rejects other sites, however they are spelled", () => {
    for (const raw of [
      "https://evil.example/x",
      "http:evil.example",
      "javascript:alert(1)",
      "//evil.example",
      "/\\evil.example",
      "/\t/evil.example",
      "/\n/evil.example",
      "/ /evil.example",
      "/.//evil.example",
      "/..//evil.example",
      "/a/..//evil.example",
      "evil.example",
      "dashboard",
    ]) {
      expect(safeRedirectPath(raw)).toBeNull();
    }
  });

  it("rejects the auth pages, empty and oversized values, and non-strings", () => {
    expect(safeRedirectPath("/sign-up")).toBeNull();
    expect(safeRedirectPath("/sign-in/sso-callback")).toBeNull();
    expect(safeRedirectPath("")).toBeNull();
    expect(safeRedirectPath(`/${"a".repeat(600)}`)).toBeNull();
    expect(safeRedirectPath(undefined)).toBeNull();
    expect(safeRedirectPath(["/dashboard"])).toBeNull();
  });
});

describe("afterAuthPath and authPageUrl", () => {
  it("falls back to the dashboard", () => {
    expect(afterAuthPath(undefined)).toBe("/dashboard");
    expect(afterAuthPath("https://evil.example")).toBe("/dashboard");
    expect(afterAuthPath(["/lifetime", "/dashboard?checkout=pro"])).toBe("/lifetime");
    expect(afterAuthPath("/lifetime")).toBe("/lifetime");
  });

  it("carries a non-default target between the auth pages", () => {
    expect(authPageUrl("/sign-in", "/dashboard")).toBe("/sign-in");
    expect(authPageUrl("/sign-in", "/dashboard?checkout=pro&billing=annual")).toBe(
      "/sign-in?redirect_url=%2Fdashboard%3Fcheckout%3Dpro%26billing%3Dannual"
    );
    expect(authPageUrl("/sign-up", "/lifetime")).toBe("/sign-up?redirect_url=%2Flifetime");
  });
});
