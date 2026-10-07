import {
  checkEligibility,
  usesOneClickUnsubscribe,
  type EligibilityContact,
  type EligibilityInput,
  type SuppressionScope,
} from "@/lib/email/eligibility";

const NOW = new Date("2026-10-06T12:00:00Z");

/** A verified account holder with tips consent and a clean status. */
function contact(over: Partial<EligibilityContact> = {}): EligibilityContact {
  return {
    email: "sam@example.com",
    userId: "user_1",
    lifecycleEmails: true,
    subscribedTopics: ["tips"],
    emailVerifiedAt: new Date("2026-09-01T00:00:00Z"),
    emailStatus: "ok",
    ...over,
  };
}

function check(stream: EligibilityInput["stream"], c: Partial<EligibilityContact> = {}, over: Partial<EligibilityInput> = {}) {
  return checkEligibility({
    contact: contact(c),
    stream,
    topic: stream === "marketing" ? "tips" : null,
    suppressions: [],
    now: NOW,
    postalAddressConfigured: true,
    ...over,
  });
}

const OK = { ok: true };
const no = (reason: string) => ({ ok: false, reason });

describe("transactional", () => {
  it("needs only an address that isn't hard-suppressed or bouncing", () => {
    expect(check("transactional", { userId: null, lifecycleEmails: false, subscribedTopics: [], emailVerifiedAt: null })).toEqual(OK);
    expect(check("transactional", { email: null })).toEqual(no("no_email"));
    expect(check("transactional", {}, { suppressions: ["all"] })).toEqual(no("suppressed"));
    expect(check("transactional", {}, { suppressions: ["nonessential", "marketing"] })).toEqual(OK);
    expect(check("transactional", { emailStatus: "bounced" })).toEqual(no("bad_status"));
    expect(check("transactional", { emailStatus: "invalid" })).toEqual(no("bad_status"));
    expect(check("transactional", { emailStatus: "complained" })).toEqual(OK);
  });
});

describe("lifecycle", () => {
  it("needs an account with lifecycle email on and a clean status", () => {
    expect(check("lifecycle", { subscribedTopics: [], emailVerifiedAt: null })).toEqual(OK);
    expect(check("lifecycle", { userId: null })).toEqual(no("not_user"));
    expect(check("lifecycle", { lifecycleEmails: false })).toEqual(no("lifecycle_off"));
    expect(check("lifecycle", { emailStatus: "complained" })).toEqual(no("bad_status"));
    expect(check("lifecycle", { emailStatus: "bounced" })).toEqual(no("bad_status"));
  });

  it("respects all and nonessential suppressions, not marketing-only ones", () => {
    expect(check("lifecycle", {}, { suppressions: ["all"] })).toEqual(no("suppressed"));
    expect(check("lifecycle", {}, { suppressions: ["nonessential"] })).toEqual(no("suppressed"));
    expect(check("lifecycle", {}, { suppressions: ["marketing"] })).toEqual(OK);
  });
});

describe("marketing", () => {
  it("needs the topic, a verified inbox, a clean status and a postal address", () => {
    expect(check("marketing", { userId: null })).toEqual(OK);
    expect(check("marketing", { subscribedTopics: [] })).toEqual(no("no_consent"));
    expect(check("marketing", { subscribedTopics: ["extension_launch"] })).toEqual(no("no_consent"));
    expect(check("marketing", {}, { topic: null })).toEqual(no("no_consent"));
    expect(check("marketing", { emailVerifiedAt: null })).toEqual(no("unverified"));
    expect(check("marketing", { emailStatus: "complained" })).toEqual(no("bad_status"));
    expect(check("marketing", {}, { postalAddressConfigured: false })).toEqual(no("no_postal_address"));
  });

  it("is blocked by any suppression scope", () => {
    for (const scope of ["all", "nonessential", "marketing"] as SuppressionScope[]) {
      expect(check("marketing", {}, { suppressions: [scope] })).toEqual(no("suppressed"));
    }
  });

  it("checks the topic the email is for", () => {
    expect(check("marketing", { subscribedTopics: ["extension_launch"] }, { topic: "extension_launch" })).toEqual(OK);
  });

  it("ignores lifecycleEmails (a separate switch)", () => {
    expect(check("marketing", { lifecycleEmails: false })).toEqual(OK);
  });
});

describe("personal", () => {
  it("respects every opt-out except topics", () => {
    expect(check("personal", { subscribedTopics: [], userId: null, emailVerifiedAt: null })).toEqual(OK);
    expect(check("personal", { lifecycleEmails: false })).toEqual(no("lifecycle_off"));
    expect(check("personal", { emailStatus: "complained" })).toEqual(no("bad_status"));
    expect(check("personal", { emailStatus: "bounced" })).toEqual(no("bad_status"));
    expect(check("personal", {}, { suppressions: ["nonessential"] })).toEqual(no("suppressed"));
    expect(check("personal", {}, { suppressions: ["marketing"] })).toEqual(OK);
  });
});

describe("reason order", () => {
  it("reports no_email before anything else, then suppression, then status", () => {
    expect(check("marketing", { email: null, emailStatus: "bounced", subscribedTopics: [] }, { suppressions: ["all"] })).toEqual(no("no_email"));
    expect(check("marketing", { emailStatus: "bounced", subscribedTopics: [] }, { suppressions: ["all"] })).toEqual(no("suppressed"));
    expect(check("marketing", { emailStatus: "bounced", subscribedTopics: [] })).toEqual(no("bad_status"));
    expect(check("marketing", { subscribedTopics: [], emailVerifiedAt: null }, { postalAddressConfigured: false })).toEqual(no("no_consent"));
    expect(check("marketing", { emailVerifiedAt: null }, { postalAddressConfigured: false })).toEqual(no("unverified"));
  });
});

describe("test sends", () => {
  const STREAMS = ["transactional", "lifecycle", "marketing", "personal"] as const;

  it("skip the consent, verification, account, lifecycle and postal-address rules", () => {
    const unconsented = { userId: null, lifecycleEmails: false, subscribedTopics: [], emailVerifiedAt: null };
    for (const stream of STREAMS) {
      expect(check(stream, unconsented, { topic: null, postalAddressConfigured: false, isTest: true })).toEqual(OK);
    }
  });

  it("still respect suppressions, a bad status and a missing address", () => {
    for (const stream of STREAMS) {
      expect(check(stream, {}, { suppressions: ["all"], isTest: true })).toEqual(no("suppressed"));
      expect(check(stream, { emailStatus: "bounced" }, { isTest: true })).toEqual(no("bad_status"));
    }
    expect(check("marketing", {}, { suppressions: ["marketing"], isTest: true })).toEqual(no("suppressed"));
    expect(check("lifecycle", { emailStatus: "complained" }, { isTest: true })).toEqual(no("bad_status"));
    expect(check("marketing", { email: null }, { isTest: true })).toEqual(no("no_email"));
  });
});

describe("one-click unsubscribe", () => {
  it("applies to lifecycle and marketing only", () => {
    expect(usesOneClickUnsubscribe("lifecycle")).toBe(true);
    expect(usesOneClickUnsubscribe("marketing")).toBe(true);
    expect(usesOneClickUnsubscribe("transactional")).toBe(false);
    expect(usesOneClickUnsubscribe("personal")).toBe(false);
  });
});
