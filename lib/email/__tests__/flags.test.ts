import {
  appUrl,
  effectiveAllowlist,
  emailConfigStatus,
  emailDailyCap,
  emailSendingMode,
  isAllowlisted,
  isProductionRuntime,
  outreachDailyGoal,
  parseEmailList,
  postalAddress,
  referralsEnabled,
  trialPassesPerMonth,
  type Env,
} from "@/lib/growth/flags";

const CONFIGURED: Env = {
  EMAIL_SENDING_ENABLED: "true",
  RESEND_API_KEY: "re_test",
  EMAIL_FROM: "HumanizeIt <hello@mail.humanizeit.app>",
  EMAIL_TOKEN_SECRET: "x".repeat(40),
  VERCEL_ENV: "production",
  NODE_ENV: "production",
};

describe("emailSendingMode", () => {
  it("is live only for a configured Vercel production runtime without an allowlist", () => {
    expect(emailSendingMode(CONFIGURED)).toBe("live");
  });

  it("is off unless EMAIL_SENDING_ENABLED is exactly 'true'", () => {
    expect(emailSendingMode({ ...CONFIGURED, EMAIL_SENDING_ENABLED: undefined })).toBe("off");
    expect(emailSendingMode({ ...CONFIGURED, EMAIL_SENDING_ENABLED: "false" })).toBe("off");
    expect(emailSendingMode({ ...CONFIGURED, EMAIL_SENDING_ENABLED: "1" })).toBe("off");
    expect(emailSendingMode({})).toBe("off");
  });

  it("is off when the transport or token secret is missing or blank", () => {
    for (const key of ["RESEND_API_KEY", "EMAIL_FROM", "EMAIL_TOKEN_SECRET"]) {
      expect(emailSendingMode({ ...CONFIGURED, [key]: undefined })).toBe("off");
      expect(emailSendingMode({ ...CONFIGURED, [key]: "   " })).toBe("off");
    }
  });

  it("forces allowlist mode on previews and Vercel development", () => {
    expect(emailSendingMode({ ...CONFIGURED, VERCEL_ENV: "preview" })).toBe("allowlist");
    expect(emailSendingMode({ ...CONFIGURED, VERCEL_ENV: "development" })).toBe("allowlist");
  });

  it("forces allowlist mode for non-production builds, even on Vercel production", () => {
    expect(emailSendingMode({ ...CONFIGURED, NODE_ENV: "development" })).toBe("allowlist");
    expect(emailSendingMode({ ...CONFIGURED, NODE_ENV: "test" })).toBe("allowlist");
    expect(emailSendingMode({ ...CONFIGURED, NODE_ENV: undefined })).toBe("allowlist");
  });

  it("forces allowlist mode outside Vercel (a local `next start` with production secrets)", () => {
    expect(emailSendingMode({ ...CONFIGURED, VERCEL_ENV: undefined })).toBe("allowlist");
  });

  it("uses allowlist mode in production while EMAIL_ALLOWLIST is set", () => {
    expect(emailSendingMode({ ...CONFIGURED, EMAIL_ALLOWLIST: "me@example.com" })).toBe("allowlist");
    expect(emailSendingMode({ ...CONFIGURED, EMAIL_ALLOWLIST: " , ; " })).toBe("live");
  });

  it("reads process.env by default", () => {
    // jest runs with NODE_ENV=test, so even a configured env can never be live here.
    expect(["off", "allowlist"]).toContain(emailSendingMode());
    expect(isProductionRuntime()).toBe(false);
  });
});

describe("allowlist", () => {
  it("parses comma, semicolon and whitespace separated lists, lower-cased", () => {
    expect(parseEmailList(" A@x.com, b@y.com;c@z.com  d@w.com ,nope ")).toEqual(["a@x.com", "b@y.com", "c@z.com", "d@w.com"]);
    expect(parseEmailList(undefined)).toEqual([]);
  });

  it("merges EMAIL_ALLOWLIST with the admin emails the caller passes", () => {
    const env: Env = { EMAIL_ALLOWLIST: "tester@example.com" };
    const set = effectiveAllowlist(["Founder@Example.com"], env);
    expect([...set].sort()).toEqual(["founder@example.com", "tester@example.com"]);
    expect(isAllowlisted("TESTER@example.com", [], env)).toBe(true);
    expect(isAllowlisted("founder@example.com", new Set(["founder@example.com"]), {})).toBe(true);
    expect(isAllowlisted("stranger@example.com", ["founder@example.com"], env)).toBe(false);
    expect(isAllowlisted(null, ["founder@example.com"], env)).toBe(false);
  });
});

describe("other flags", () => {
  it("keeps referrals off unless explicitly enabled", () => {
    expect(referralsEnabled({})).toBe(false);
    expect(referralsEnabled({ REFERRALS_ENABLED: "yes" })).toBe(false);
    expect(referralsEnabled({ REFERRALS_ENABLED: "true" })).toBe(true);
  });

  it("falls back to defaults for missing or invalid numbers", () => {
    expect(trialPassesPerMonth({})).toBe(20);
    expect(trialPassesPerMonth({ TRIAL_PASSES_PER_MONTH: "5" })).toBe(5);
    expect(trialPassesPerMonth({ TRIAL_PASSES_PER_MONTH: "-3" })).toBe(20);
    expect(trialPassesPerMonth({ TRIAL_PASSES_PER_MONTH: "2.5" })).toBe(20);
    expect(outreachDailyGoal({})).toBe(30);
    expect(outreachDailyGoal({ OUTREACH_DAILY_GOAL: "abc" })).toBe(30);
    expect(emailDailyCap({})).toBe(90);
    expect(emailDailyCap({ EMAIL_DAILY_CAP: "50" })).toBe(50);
  });

  it("returns the postal address only when set", () => {
    expect(postalAddress({})).toBeNull();
    expect(postalAddress({ COMPANY_POSTAL_ADDRESS: "   " })).toBeNull();
    expect(postalAddress({ COMPANY_POSTAL_ADDRESS: " PO Box 1, Tunis " })).toBe("PO Box 1, Tunis");
  });

  it("normalizes the app URL to an origin", () => {
    expect(appUrl({})).toBe("https://humanizeit.app");
    expect(appUrl({ NEXT_PUBLIC_APP_URL: "https://humanizeit.app/" })).toBe("https://humanizeit.app");
    expect(appUrl({ NEXT_PUBLIC_APP_URL: "http://localhost:3458" })).toBe("http://localhost:3458");
    expect(appUrl({ NEXT_PUBLIC_APP_URL: "not a url" })).toBe("https://humanizeit.app");
    expect(appUrl({ NEXT_PUBLIC_APP_URL: "javascript:alert(1)" })).toBe("https://humanizeit.app");
  });

  it("reports configuration as booleans, never values", () => {
    const status = emailConfigStatus({ ...CONFIGURED, COMPANY_POSTAL_ADDRESS: "PO Box 1" });
    expect(status).toEqual({
      resendKey: true,
      from: true,
      replyTo: false,
      webhookSecret: false,
      tokenSecret: true,
      postalAddress: true,
      cronSecret: false,
    });
    expect(JSON.stringify(status)).not.toContain("re_test");
  });
});
