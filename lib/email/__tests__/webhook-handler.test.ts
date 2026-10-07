// Resend webhook decisions: statuses only move forward, only permanent bounces
// suppress, complaints withdraw consent, and the message is found by our tag
// first and Resend's id second.

import {
  bounceKind,
  classifyEvent,
  contactEffect,
  eventTime,
  messageRef,
  nextContactStatus,
  nextMessageStatus,
} from "@/lib/email/webhook-handler";

describe("nextMessageStatus", () => {
  it("moves forward along sent → delivered → bounced → complained", () => {
    expect(nextMessageStatus("sent", "delivered")).toBe("delivered");
    expect(nextMessageStatus("delivered", "bounced")).toBe("bounced");
    expect(nextMessageStatus("bounced", "complained")).toBe("complained");
    expect(nextMessageStatus("sending", "delivered")).toBe("delivered");
  });

  it("never lets a late event overwrite a stronger status", () => {
    expect(nextMessageStatus("bounced", "delivered")).toBeNull();
    expect(nextMessageStatus("complained", "bounced")).toBeNull();
    expect(nextMessageStatus("delivered", "delivered")).toBeNull();
    expect(nextMessageStatus("delivered", "failed")).toBeNull();
  });

  it("lets a provider failure or suppression replace a plain 'sent'", () => {
    expect(nextMessageStatus("sent", "failed")).toBe("failed");
    expect(nextMessageStatus("sent", "suppressed")).toBe("suppressed");
  });

  it("leaves our own terminal statuses alone", () => {
    expect(nextMessageStatus("skipped", "delivered")).toBeNull();
    expect(nextMessageStatus("cancelled", "bounced")).toBeNull();
  });
});

describe("bounceKind", () => {
  it.each([
    ["Permanent", "permanent"],
    ["permanent", "permanent"],
    ["HardBounce", "permanent"],
    ["Transient", "transient"],
    ["Undetermined", "undetermined"],
    [undefined, "undetermined"],
  ])("%s → %s", (type, kind) => {
    expect(bounceKind(type === undefined ? undefined : { type })).toBe(kind);
  });
});

describe("classifyEvent + contactEffect", () => {
  it("suppresses everything after a permanent bounce", () => {
    const action = classifyEvent({ type: "email.bounced", data: { bounce: { type: "Permanent", subType: "General" } } });
    expect(action).toEqual({ kind: "bounced", permanent: true, detail: "Permanent: General" });
    expect(contactEffect(action)).toEqual({
      emailStatus: "bounced",
      suppression: { scope: "all", reason: "bounce" },
      withdrawTopics: false,
      exitSequences: true,
    });
  });

  it("only notes a transient bounce", () => {
    const action = classifyEvent({ type: "email.bounced", data: { bounce: { type: "Transient", subType: "MailboxFull" } } });
    expect(action).toMatchObject({ kind: "bounced", permanent: false });
    expect(contactEffect(action)).toEqual({ emailStatus: null, suppression: null, withdrawTopics: false, exitSequences: false });
  });

  it("treats a complaint as an opt-out from everything non-essential", () => {
    expect(contactEffect(classifyEvent({ type: "email.complained" }))).toEqual({
      emailStatus: "complained",
      suppression: { scope: "nonessential", reason: "complaint" },
      withdrawTopics: true,
      exitSequences: true,
    });
  });

  it("records provider suppressions and failures", () => {
    const suppressed = classifyEvent({ type: "email.suppressed", data: { suppressed: { type: "OnAccountSuppressionList" } } });
    expect(suppressed).toEqual({ kind: "suppressed", detail: "provider_suppressed: OnAccountSuppressionList" });
    expect(contactEffect(suppressed).suppression).toEqual({ scope: "all", reason: "provider" });
    expect(classifyEvent({ type: "email.failed", data: { failed: { reason: "reached_daily_quota" } } })).toEqual({
      kind: "failed",
      detail: "provider_failed: reached_daily_quota",
    });
  });

  it("ignores opens, clicks, contact and domain events", () => {
    for (const type of ["email.opened", "email.clicked", "email.sent", "email.delivery_delayed", "contact.created", "domain.updated"]) {
      expect(classifyEvent({ type })).toEqual({ kind: "ignore" });
    }
  });
});

describe("messageRef", () => {
  it("prefers our m tag, in object or array form", () => {
    expect(messageRef({ type: "email.delivered", data: { email_id: "re_1", tags: { m: "cm123", stream: "marketing" }, to: ["a@b.co"] } })).toEqual({
      messageId: "cm123",
      resendId: "re_1",
      to: "a@b.co",
    });
    expect(messageRef({ type: "email.delivered", data: { tags: [{ name: "m", value: "cm456" }] } }).messageId).toBe("cm456");
  });

  it("drops a malformed tag and falls back to Resend's id", () => {
    expect(messageRef({ type: "email.delivered", data: { email_id: "re_2", tags: { m: "x'; drop" } } })).toEqual({ messageId: null, resendId: "re_2", to: null });
  });
});

describe("contact status and event time", () => {
  it("a complaint outranks a bounce", () => {
    expect(nextContactStatus("ok", "bounced")).toBe("bounced");
    expect(nextContactStatus("bounced", "complained")).toBe("complained");
    expect(nextContactStatus("complained", "bounced")).toBeNull();
    expect(nextContactStatus("bounced", "bounced")).toBeNull();
  });

  it("uses the event's timestamp, or now when it is malformed", () => {
    const now = new Date("2026-10-07T08:00:00Z");
    expect(eventTime({ type: "email.delivered", created_at: "2026-10-06T10:00:00.000Z" }, now)).toEqual(new Date("2026-10-06T10:00:00.000Z"));
    expect(eventTime({ type: "email.delivered", created_at: "garbage" }, now)).toEqual(now);
  });
});
