// Campaign safety rails as pure functions: the content hash a test send pins,
// the confirm guard (tested, unchanged, typed count, sending on, breaker
// closed), {{firstName}} personalization and the inline contacts filter ref.

jest.mock("@/lib/db", () => ({ db: {} }));
jest.mock("@/lib/admin", () => ({ adminEmails: () => new Set<string>() }));
jest.mock("@/lib/email/send", () => ({}));
jest.mock("@/lib/email/render", () => ({}));
jest.mock("@/lib/crm/segment-resolve", () => ({}));
jest.mock("@/lib/crm/contacts", () => ({}));
jest.mock("@/lib/growth/locks", () => ({}));

import {
  FILTER_REF_PREFIX,
  campaignContentHash,
  checkSendGuard,
  contentChanged,
  decodeFilterRef,
  encodeFilterRef,
  personalize,
  type SendGuardInput,
} from "@/lib/email/campaigns";

const content = { subject: "Hi {{firstName}}", preheader: "Short", bodyMd: "Body", topic: "tips", segmentRef: "sys:tips_subscribers" };

describe("campaignContentHash", () => {
  it("is stable and changes with every tested field", () => {
    const base = campaignContentHash(content);
    expect(campaignContentHash({ ...content })).toBe(base);
    for (const [key, value] of Object.entries({ subject: "x", preheader: "x", bodyMd: "x", topic: "extension_launch", segmentRef: "sys:churned" })) {
      expect(campaignContentHash({ ...content, [key]: value })).not.toBe(base);
    }
  });

  it("treats a missing preheader like an empty one", () => {
    expect(campaignContentHash({ ...content, preheader: null })).toBe(campaignContentHash({ ...content, preheader: "" }));
  });

  it("can't be fooled by moving text between fields", () => {
    expect(campaignContentHash({ ...content, subject: "ab", bodyMd: "c" })).not.toBe(campaignContentHash({ ...content, subject: "a", bodyMd: "bc" }));
  });

  it("contentChanged reports any edit", () => {
    expect(contentChanged(content, { ...content })).toBe(false);
    expect(contentChanged(content, { ...content, bodyMd: "Body!" })).toBe(true);
  });
});

describe("checkSendGuard", () => {
  const hash = campaignContentHash(content);
  const ok: SendGuardInput = {
    status: "tested",
    storedHash: hash,
    currentHash: hash,
    confirmCount: 12,
    eligible: 12,
    mode: "live",
    breakerTripped: false,
  };

  it("passes when every rule holds", () => {
    expect(checkSendGuard(ok)).toEqual({ ok: true });
    expect(checkSendGuard({ ...ok, mode: "allowlist" })).toEqual({ ok: true });
  });

  it.each([
    [{ mode: "off" as const }, "SENDING_OFF"],
    [{ breakerTripped: true }, "CIRCUIT_BREAKER"],
    [{ status: "draft" }, "NOT_TESTED"],
    [{ status: "sending" }, "NOT_TESTED"],
    [{ storedHash: null }, "CHANGED_SINCE_TEST"],
    [{ currentHash: "different" }, "CHANGED_SINCE_TEST"],
    [{ eligible: 0, confirmCount: 0 }, "NO_RECIPIENTS"],
    [{ confirmCount: 11 }, "COUNT_MISMATCH"],
    [{ confirmCount: 12.5 }, "COUNT_MISMATCH"],
  ])("%j → %s", (patch, code) => {
    const res = checkSendGuard({ ...ok, ...patch });
    expect(res.ok).toBe(false);
    expect(!res.ok && res.code).toBe(code);
  });

  it("tells the admin the current count on a mismatch", () => {
    const res = checkSendGuard({ ...ok, eligible: 9, confirmCount: 12 });
    expect(!res.ok && res.message).toContain("9");
  });
});

describe("personalize", () => {
  it("fills {{firstName}} and falls back to 'there'", () => {
    expect(personalize("Hi {{firstName}}, hi {{ firstName }}", "Amira")).toBe("Hi Amira, hi Amira");
    expect(personalize("Hi {{firstName}}", null)).toBe("Hi there");
    expect(personalize("Hi {{firstName}}", "  ")).toBe("Hi there");
    expect(personalize("No placeholders", "Amira")).toBe("No placeholders");
  });
});

describe("filter refs", () => {
  const filter = { match: "all" as const, rules: [{ field: "topic" as const, op: "has" as const, value: "tips" as const }] };

  it("round-trips a contacts filter", () => {
    const ref = encodeFilterRef(filter);
    expect(ref.startsWith(FILTER_REF_PREFIX)).toBe(true);
    expect(decodeFilterRef(ref)).toEqual(filter);
  });

  it("rejects malformed or invalid filters", () => {
    expect(decodeFilterRef("sys:tips_subscribers")).toBeNull();
    expect(decodeFilterRef(`${FILTER_REF_PREFIX}not-base64-json`)).toBeNull();
    const bad = FILTER_REF_PREFIX + Buffer.from(JSON.stringify({ match: "all", rules: [{ field: "nope" }] })).toString("base64url");
    expect(decodeFilterRef(bad)).toBeNull();
  });
});
