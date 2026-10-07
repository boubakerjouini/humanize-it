// Pure rules of the support inbox: address parsing that a display name can't
// fool, forward targets, machine-mail detection, the DMARC verdict that decides
// whether a sender is trusted (read from raw headers a sender can't forge past),
// unsafe attachments, threading and the quoted body.

import {
  automatedReason,
  bareAddress,
  cleanSubject,
  forwardBanner,
  forwardFrom,
  forwardTargets,
  hasRiskyAttachment,
  headerValue,
  inboundTaskBody,
  inboundTaskTitle,
  isOwnAddress,
  ownRecipients,
  quotedText,
  rawHeaderBlock,
  senderAuth,
  threadingHeaders,
  topHeader,
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
    expect(automatedReason({ "List-Id": "<news.example.com>" }, "jane@example.com")).toBe("list");
    expect(automatedReason({ "list-unsubscribe": "<https://example.com/u>" }, "jane@example.com")).toBe("list");
    expect(automatedReason(null, "Mail Delivery <MAILER-DAEMON@example.com>")).toBe("role_sender");
    expect(automatedReason(null, "noreply@example.com")).toBe("role_sender");
  });

  it("reads headers case-insensitively", () => {
    expect(headerValue({ "AUTHENTICATION-RESULTS": "x" }, "Authentication-Results")).toBe("x");
    expect(headerValue(null, "x")).toBeNull();
  });
});

describe("senderAuth (raw header block, pinned authserv-id)", () => {
  const PIN = "mx.resend.com";
  const UNCHECKED = { spf: "none", dkim: "none", dmarc: "none", checked: false, verified: false };
  const FORGED_PASS = "Authentication-Results: mx.resend.com; dmarc=pass header.from=example.com";
  // Raw messages as the receiving MX hands them on: its own header on top, then what the sender wrote.
  const raw = (...headers: string[]) => rawHeaderBlock([...headers, "From: Jane <jane@example.com>", "Subject: Hi", "", "Body"].join("\r\n"));

  it("verifies a DMARC pass aligned with the From domain, from the topmost header with the pinned id", () => {
    const auth = senderAuth(raw(`Authentication-Results: ${DMARC_PASS}`), "Jane <jane@example.com>", PIN);
    expect(auth).toEqual({ spf: "pass", dkim: "pass", dmarc: "pass", checked: true, verified: true });
  });

  it("unfolds a header continued on several lines", () => {
    const folded = "Authentication-Results: mx.resend.com;\r\n\tspf=pass smtp.mailfrom=example.com;\r\n dmarc=pass (p=NONE) header.from=example.com";
    expect(senderAuth(raw(folded), "jane@example.com", PIN)).toMatchObject({ spf: "pass", dmarc: "pass", verified: true });
  });

  it("ignores a forged pass placed below the real header", () => {
    const real = "Authentication-Results: mx.resend.com; spf=fail smtp.mailfrom=example.com; dmarc=fail header.from=example.com";
    expect(senderAuth(raw(real, FORGED_PASS), "jane@example.com", PIN)).toMatchObject({ dmarc: "fail", checked: true, verified: false });
  });

  it("ignores a forged pass below a real header that has no dmarc= clause", () => {
    const real = "Authentication-Results: mx.resend.com; spf=pass smtp.mailfrom=example.com";
    expect(senderAuth(raw(real, FORGED_PASS), "jane@example.com", PIN)).toMatchObject({ spf: "pass", dmarc: "none", verified: false });
  });

  it("refuses a forged header when it is the only one and names another authserv-id", () => {
    const forged = "Authentication-Results: attacker.example; dmarc=pass header.from=example.com";
    expect(senderAuth(raw(forged), "jane@example.com", PIN)).toEqual(UNCHECKED);
  });

  it("checks nothing without a pin, a header or a header block", () => {
    expect(senderAuth(raw(`Authentication-Results: ${DMARC_PASS}`), "jane@example.com", undefined)).toEqual(UNCHECKED);
    expect(senderAuth(raw(`Authentication-Results: ${DMARC_PASS}`), "jane@example.com", "  ")).toEqual(UNCHECKED);
    expect(senderAuth(raw(), "jane@example.com", PIN)).toEqual(UNCHECKED);
    expect(senderAuth(null, "jane@example.com", PIN)).toEqual(UNCHECKED);
  });

  it("reads only the header block: an Authentication-Results line in the body doesn't count", () => {
    const block = rawHeaderBlock(`From: jane@example.com\r\n\r\nAuthentication-Results: ${DMARC_PASS}`);
    expect(senderAuth(block, "jane@example.com", PIN)).toEqual(UNCHECKED);
  });

  it("refuses a pass for another domain, or one that doesn't name header.from", () => {
    expect(senderAuth(raw("Authentication-Results: mx.resend.com; dmarc=pass header.from=attacker.com"), "jane@example.com", PIN).verified).toBe(false);
    expect(senderAuth(raw("Authentication-Results: mx.resend.com; dmarc=pass"), "jane@example.com", PIN).verified).toBe(false);
  });

  it("finds the topmost instance of a header", () => {
    expect(topHeader("X-A: 1\r\nx-a: 2", "X-A")).toBe("1");
    expect(topHeader("X-B: 1", "X-A")).toBeNull();
  });
});

describe("senderAuth on Resend's receiving server (Amazon SES)", () => {
  const PIN = "amazonses.com";
  const SPF = (from: string) =>
    ` spf=pass (spfCheck: domain of ${from} designates 54.240.3.27 as permitted sender) client-ip=54.240.3.27;` +
    ` envelope-from=0102-abc@${from}; helo=a3-27.smtp-out.eu-west-1.amazonses.com;`;
  // Shape of a real message received on humanizeit.app (a probe sent 2026-10-07):
  // SES prepends its own Authentication-Results and keeps a forged one, even one
  // that claims its authserv-id, further down.
  const ses = (results: string[], spf = SPF("send.example.com")) =>
    rawHeaderBlock(
      [
        "Return-Path: <0102-abc@send.example.com>",
        "Received: from a3-27.smtp-out.eu-west-1.amazonses.com (a3-27.smtp-out.eu-west-1.amazonses.com [54.240.3.27])",
        " by inbound-smtp.eu-west-1.amazonaws.com with SMTP id abc123",
        " for support@humanizeit.app;",
        " Wed, 07 Oct 2026 09:09:15 +0000 (UTC)",
        "X-SES-Spam-Verdict: PASS",
        "X-SES-Virus-Verdict: PASS",
        `Received-SPF: pass (spfCheck: domain of send.example.com designates 54.240.3.27 as permitted sender) client-ip=54.240.3.27;`,
        "Authentication-Results: amazonses.com;",
        spf,
        ...results.map((r) => ` ${r};`),
        "X-SES-RECEIPT: AEFBQUFB",
        "Authentication-Results: amazonses.com; spf=pass; dkim=pass;",
        " dmarc=pass header.from=paypal.com",
        "From: Probe <probe@example.com>",
        "Subject: Hi",
        "",
        "Body",
      ].join("\r\n")
    );
  const PASS = ["dkim=pass header.i=@amazonses.com", "dkim=pass header.i=@example.com", "dmarc=pass header.from=example.com"];

  it("verifies from the header SES stamps on top, not the forged one below it", () => {
    expect(senderAuth(ses(PASS), "Probe <probe@example.com>", PIN)).toEqual({
      spf: "pass",
      dkim: "pass",
      dmarc: "pass",
      checked: true,
      verified: true,
    });
    // The forged header claims a pass for paypal.com; SES's own says example.com.
    expect(senderAuth(ses(PASS), "billing@paypal.com", PIN).verified).toBe(false);
  });

  it("treats no DMARC record, errors and missing signatures as unknown, not as a fail", () => {
    const none = senderAuth(ses(["dkim=none", "dmarc=none header.from=example.com"]), "probe@example.com", PIN);
    expect(none).toMatchObject({ dkim: "none", dmarc: "none", checked: true, verified: false });
    expect(senderAuth(ses(["dmarc=temperror header.from=example.com"]), "probe@example.com", PIN).dmarc).toBe("none");
    const softfail = SPF("send.example.com").replace("spf=pass", "spf=softfail");
    expect(senderAuth(ses(PASS, softfail), "probe@example.com", PIN)).toMatchObject({ spf: "fail", dmarc: "pass", verified: true });
  });

  it("keeps a quoted envelope-from from adding a dmarc clause", () => {
    const quoted = ` spf=pass client-ip=54.240.3.27; envelope-from="x;dmarc=pass header.from=paypal.com;"@evil.example; helo=evil.example;`;
    expect(senderAuth(ses(["dmarc=none header.from=paypal.com"], quoted), "billing@paypal.com", PIN)).toMatchObject({ dmarc: "none", verified: false });
    expect(senderAuth(ses(["dmarc=fail header.from=paypal.com"], quoted), "billing@paypal.com", PIN)).toMatchObject({ dmarc: "fail", verified: false });
  });

  it("lets any explicit DMARC fail win, and never verifies two dmarc clauses", () => {
    const twice = ["dmarc=pass header.from=example.com", "dmarc=pass header.from=example.com"];
    expect(senderAuth(ses(twice), "probe@example.com", PIN)).toMatchObject({ dmarc: "pass", verified: false });
    const split = ["dmarc=pass header.from=example.com", "dmarc=fail header.from=example.com"];
    expect(senderAuth(ses(split), "probe@example.com", PIN)).toMatchObject({ dmarc: "fail", verified: false });
  });
});

describe("hasRiskyAttachment", () => {
  it("flags programs, scripts, archives and HTML by name or type", () => {
    expect(hasRiskyAttachment([{ filename: "invoice.pdf.exe", content_type: "application/octet-stream" }])).toBe(true);
    expect(hasRiskyAttachment([{ filename: "files.ZIP", content_type: "application/octet-stream" }])).toBe(true);
    expect(hasRiskyAttachment([{ filename: "page.html", content_type: "text/plain" }])).toBe(true);
    expect(hasRiskyAttachment([{ filename: null, content_type: "application/x-msdownload" }])).toBe(true);
    expect(hasRiskyAttachment([{ filename: "x", content_type: "text/html; charset=utf-8" }])).toBe(true);
  });

  it("lets ordinary attachments through", () => {
    expect(hasRiskyAttachment([{ filename: "receipt.pdf", content_type: "application/pdf" }, { filename: "shot.png", content_type: "image/png" }])).toBe(false);
    expect(hasRiskyAttachment([])).toBe(false);
    expect(hasRiskyAttachment(undefined)).toBe(false);
  });
});

describe("threadingHeaders and quotedText", () => {
  it("threads only on a well-formed Message-ID", () => {
    expect(threadingHeaders("<abc.123@mail.example.com>")).toEqual({ "In-Reply-To": "<abc.123@mail.example.com>", References: "<abc.123@mail.example.com>" });
    expect(threadingHeaders("abc@x")).toEqual({});
    expect(threadingHeaders("<a b@x>")).toEqual({});
    expect(threadingHeaders("<a@x>\r\nBcc: evil@x.com")).toEqual({});
    expect(threadingHeaders(null)).toEqual({});
  });

  it("quotes the plain text, strips control and bidi characters, and caps it", () => {
    expect(quotedText("Hi\r\nthere\u0000‮")).toBe("> Hi\n> there");
    expect(quotedText("  ")).toBeNull();
    expect(quotedText(null)).toBeNull();
    const long = quotedText("x".repeat(20), 10)!;
    expect(long).toBe("> xxxxxxxxxx\n> [cut here: read the rest in Resend > Emails > Receiving]");
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
    const failed = senderAuth(null, "jane@example.com", "mx.resend.com");
    expect(inboundTaskBody({ receivedFor: ["support@humanizeit.app"], auth: failed })).toContain(UNVERIFIED_WARNING);
    expect(inboundTaskBody({ receivedFor: ["support@humanizeit.app"], auth: failed })).toContain("Sender check: not checked");
    const passed = senderAuth(`Authentication-Results: ${DMARC_PASS}`, "jane@example.com", "mx.resend.com");
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
    expect(banner).not.toContain("--- Original message");
  });

  it("says when attachments were withheld, and quotes the plain text under a marker", () => {
    const banner = forwardBanner({
      sender: "jane@example.com",
      subject: "Refund",
      auth: senderAuth(null, "jane@example.com", undefined),
      receivedFor: [],
      tasksUrl: "https://humanizeit.app/admin/tasks",
      attachment: "withheld",
      text: "Hello\nPlease refund",
    });
    expect(banner).toContain("attachments could be unsafe");
    expect(banner).toContain("--- Original message (plain text, untrusted) ---\n> Hello\n> Please refund");
  });
});
