// Pure rules of the support inbox: address parsing that a display name can't
// fool, forward targets, machine-mail detection, and the DMARC verdict that
// decides whether a sender is trusted.

import {
  automatedReason,
  bareAddress,
  cleanSubject,
  forwardBanner,
  forwardFrom,
  forwardTargets,
  headerValue,
  inboundTaskBody,
  inboundTaskTitle,
  isOwnAddress,
  ownRecipients,
  senderAuth,
  UNVERIFIED_WARNING,
} from "@/lib/email/inbound-rules";

const PLACEHOLDER = "@placeholder.humanize-it.app";
const DMARC_PASS = "mx.resend.com; spf=pass smtp.mailfrom=example.com; dkim=pass header.i=@example.com; dmarc=pass header.from=example.com";

describe("bareAddress", () => {
  it("extracts the bare, lower-cased address", () => {
    expect(bareAddress("Jane Doe <Jane@Example.com>")).toBe("jane@example.com");
    expect(bareAddress("  jane@example.com ")).toBe("jane@example.com");
  });

  it("takes the last angle group, so a display name containing <...> can't spoof it", () => {
    expect(bareAddress('"<ceo@humanizeit.app>" <evil@example.com>')).toBe("evil@example.com");
    expect(bareAddress("<support@humanizeit.app> <evil@example.com>")).toBe("evil@example.com");
    // The loop guard sees the real address, not the injected one.
    expect(isOwnAddress('"<ceo@humanizeit.app>" <evil@example.com>')).toBe(false);
  });

  it("drops control characters", () => {
    expect(bareAddress("Jane <ja\u0000ne@x.com>")).toBe("ja ne@x.com");
  });
});

describe("isOwnAddress", () => {
  it("recognises our own domains and their subdomains (loop guard)", () => {
    expect(isOwnAddress("HumanizeIt <hello@mail.humanizeit.app>")).toBe(true);
    expect(isOwnAddress("support@humanizeit.app")).toBe(true);
    expect(isOwnAddress("x@bounces.mail.humanizeit.app")).toBe(true);
    expect(isOwnAddress("jane@example.com")).toBe(false);
    // A look-alike domain is not ours.
    expect(isOwnAddress("evil@humanizeit.app.example.com")).toBe(false);
    expect(isOwnAddress("evil@nothumanizeit.app")).toBe(false);
  });
});

describe("forwardTargets", () => {
  it("defaults to the founder, and INBOUND_FORWARD_TO overrides it", () => {
    expect(forwardTargets(undefined, "Founder@Gmail.com", PLACEHOLDER)).toEqual(["founder@gmail.com"]);
    expect(forwardTargets("  ", "founder@gmail.com", PLACEHOLDER)).toEqual(["founder@gmail.com"]);
    expect(forwardTargets("a@x.com, A@X.com, Bob <b@y.com>", "founder@gmail.com", PLACEHOLDER)).toEqual(["a@x.com", "b@y.com"]);
  });

  it("drops our own domains, placeholders, role inboxes and junk", () => {
    expect(forwardTargets("support@humanizeit.app", "founder@gmail.com", PLACEHOLDER)).toEqual([]);
    expect(forwardTargets(`user_123${PLACEHOLDER}, ok@x.com`, "founder@gmail.com", PLACEHOLDER)).toEqual(["ok@x.com"]);
    expect(forwardTargets("noreply@x.com, postmaster@y.com", "founder@gmail.com", PLACEHOLDER)).toEqual([]);
    expect(forwardTargets("not-an-address, ok@x.com", "founder@gmail.com", PLACEHOLDER)).toEqual(["ok@x.com"]);
  });
});

describe("forwardFrom", () => {
  it("uses INBOUND_FORWARD_FROM, else inbox@ on EMAIL_FROM's domain", () => {
    expect(forwardFrom("Support <help@mail.humanizeit.app>", "HumanizeIt <hello@mail.humanizeit.app>")).toBe("Support <help@mail.humanizeit.app>");
    expect(forwardFrom(undefined, "HumanizeIt <hello@mail.humanizeit.app>")).toBe("HumanizeIt Inbox <inbox@mail.humanizeit.app>");
    expect(forwardFrom("", "hello@mail.humanizeit.app")).toBe("HumanizeIt Inbox <inbox@mail.humanizeit.app>");
    expect(forwardFrom(undefined, undefined)).toBeNull();
    expect(forwardFrom("garbage", "hello@mail.humanizeit.app")).toBeNull();
  });
});

describe("automatedReason", () => {
  it("lets a person's mail through", () => {
    expect(automatedReason({ "Auto-Submitted": "no", Precedence: "first-class" }, "jane@example.com")).toBeNull();
    expect(automatedReason(null, "Jane <jane@example.com>")).toBeNull();
  });

  it("flags auto-replies, list mail, delivery reports and role senders", () => {
    expect(automatedReason({ "auto-submitted": "auto-replied" }, "jane@example.com")).toBe("auto_submitted");
    expect(automatedReason({ Precedence: "Bulk" }, "jane@example.com")).toBe("precedence");
    expect(automatedReason({ Precedence: "auto_reply" }, "jane@example.com")).toBe("precedence");
    expect(automatedReason({ "X-Autoreply": "yes" }, "jane@example.com")).toBe("autoreply_header");
    expect(automatedReason({ "X-Autorespond": "" }, "jane@example.com")).toBe("autoreply_header");
    expect(automatedReason({ "Content-Type": 'multipart/report; report-type="delivery-status"' }, "jane@example.com")).toBe("delivery_report");
    expect(automatedReason(null, "Mail Delivery <MAILER-DAEMON@example.com>")).toBe("role_sender");
    expect(automatedReason(null, "noreply@example.com")).toBe("role_sender");
  });

  it("reads headers case-insensitively", () => {
    expect(headerValue({ "AUTHENTICATION-RESULTS": "x" }, "Authentication-Results")).toBe("x");
    expect(headerValue(null, "x")).toBeNull();
  });
});

describe("senderAuth", () => {
  it("verifies a DMARC pass aligned with the From domain", () => {
    const auth = senderAuth({ "Authentication-Results": DMARC_PASS }, "Jane <jane@example.com>");
    expect(auth).toEqual({ spf: "pass", dkim: "pass", dmarc: "pass", verified: true });
  });

  it("does not verify a DMARC fail or a missing header", () => {
    expect(senderAuth({ "Authentication-Results": "mx; spf=softfail; dkim=none; dmarc=fail header.from=example.com" }, "jane@example.com")).toMatchObject({
      spf: "fail",
      dmarc: "fail",
      verified: false,
    });
    expect(senderAuth(null, "jane@example.com")).toEqual({ spf: "none", dkim: "none", dmarc: "none", verified: false });
  });

  it("refuses a forged pass: mixed results or a pass for another domain", () => {
    const forged = `${DMARC_PASS}\nmx.resend.com; dmarc=fail header.from=example.com`;
    expect(senderAuth({ "Authentication-Results": forged }, "jane@example.com")).toMatchObject({ dmarc: "mixed", verified: false });
    expect(senderAuth({ "Authentication-Results": "mx; dmarc=pass header.from=attacker.com" }, "jane@example.com").verified).toBe(false);
  });
});

describe("task and banner text", () => {
  it("builds a single-line, capped, control-free task title", () => {
    expect(inboundTaskTitle("Jane <jane@x.com>", "Refund\n please")).toBe("Reply to jane@x.com: Refund please");
    expect(inboundTaskTitle("jane@x.com", null)).toBe("Reply to jane@x.com: (no subject)");
    expect(inboundTaskTitle("jane@x.com", "x".repeat(500)).length).toBe(180);
    expect(inboundTaskTitle("jane@x.com", "Refund\u0000please")).not.toContain("\u0000");
    expect(cleanSubject("a\u0007b")).toBe("a b");
  });

  it("keeps only our own addresses from received_for", () => {
    expect(ownRecipients(["support@humanizeit.app", "boss@thirdparty.com", "Hello <HELLO@humanizeit.app>"])).toEqual([
      "support@humanizeit.app",
      "hello@humanizeit.app",
    ]);
    expect(ownRecipients(undefined)).toEqual([]);
  });

  it("warns in the task and the banner when the sender isn't verified", () => {
    const failed = senderAuth(null, "jane@example.com");
    expect(inboundTaskBody({ receivedFor: ["support@humanizeit.app"], auth: failed })).toContain(UNVERIFIED_WARNING);
    const passed = senderAuth({ "Authentication-Results": DMARC_PASS }, "jane@example.com");
    expect(inboundTaskBody({ receivedFor: ["support@humanizeit.app"], auth: passed })).not.toContain(UNVERIFIED_WARNING);

    const banner = forwardBanner({
      sender: "jane@example.com",
      subject: "Refund",
      auth: failed,
      receivedFor: ["support@humanizeit.app"],
      tasksUrl: "https://humanizeit.app/admin/tasks",
      attachment: "too_large",
    });
    expect(banner).toContain(UNVERIFIED_WARNING);
    expect(banner).toContain("Hit Reply to answer jane@example.com");
    expect(banner).toContain("over 10 MB");
  });
});
