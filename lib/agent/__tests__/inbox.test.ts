// Pure helpers the agent uses to read and answer support mail.

jest.mock("@/lib/db", () => ({ db: {} }));

import { htmlToText, isEmailId, replySubject } from "@/lib/agent/inbox";

describe("replySubject", () => {
  it("prefixes Re: once", () => {
    expect(replySubject("Checkout broken")).toBe("Re: Checkout broken");
    expect(replySubject("RE: Checkout broken")).toBe("RE: Checkout broken");
  });

  it("cleans control characters and falls back for an empty subject", () => {
    expect(replySubject("Help\r\nBcc: x@y.z")).toBe("Re: Help Bcc: x@y.z");
    expect(replySubject(null)).toBe("Re: (no subject)");
  });
});

describe("htmlToText", () => {
  it("keeps the words and line breaks of an HTML-only email, without styles or tags", () => {
    const text = htmlToText("<style>p{color:red}</style><p>Hi&nbsp;there,</p><p>My card &amp; PayPal fail.<br>Thanks</p>");
    expect(text).toContain("Hi there,");
    expect(text).toContain("My card & PayPal fail.\nThanks");
    expect(text).not.toContain("color");
    expect(text).not.toContain("<");
  });
});

describe("isEmailId", () => {
  it("accepts only Resend's UUID ids, so nothing else reaches the Resend API path", () => {
    expect(isEmailId("4ef9a417-02e9-4d39-ad75-9611e0fcc33c")).toBe(true);
    expect(isEmailId("../../domains")).toBe(false);
    expect(isEmailId("4ef9a417")).toBe(false);
  });
});
