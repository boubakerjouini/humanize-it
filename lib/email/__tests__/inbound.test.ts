// The support inbox end to end with Resend, the database, the limiter and the
// send budget mocked: the task is opened before the send, the limits are
// claimed once per email (a fallback task from a failed read doesn't count as
// claimed), machine mail never uses a send, the sender check comes from the
// raw message's topmost Authentication-Results with the pinned authserv-id, a
// DMARC fail is never forwarded, permanent Resend errors don't retry, and only
// a retryable one makes the webhook answer 500.

const mockState = {
  tasks: new Map<string, Record<string, unknown>>(),
  order: [] as string[],
};

jest.mock("@/lib/db", () => {
  const unique = () => Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
  return {
    db: {
      crmTask: {
        findUnique: jest.fn(async ({ where }: { where: { dedupeKey: string } }) => mockState.tasks.get(where.dedupeKey) ?? null),
        create: jest.fn(async ({ data }: { data: Record<string, unknown> & { dedupeKey: string } }) => {
          mockState.order.push(`task.create:${data.dedupeKey}`);
          if (mockState.tasks.has(data.dedupeKey)) throw unique();
          mockState.tasks.set(data.dedupeKey, { ...data });
          return data;
        }),
        update: jest.fn(async ({ where, data }: { where: { dedupeKey: string }; data: Record<string, unknown> }) => {
          const task = mockState.tasks.get(where.dedupeKey);
          if (!task) throw new Error("not found");
          return Object.assign(task, data);
        }),
      },
    },
  };
});

const mockResend = { emails: { send: jest.fn(), receiving: { get: jest.fn() } } };
jest.mock("@/lib/email/resend-client", () => {
  const actual = jest.requireActual("@/lib/email/resend-client");
  return { ...actual, getResend: jest.fn(() => mockResend) };
});
jest.mock("@/lib/rate-limit", () => ({ checkDailyLimit: jest.fn(async () => ({ ok: true })) }));
jest.mock("@/lib/email/budget", () => ({ forwardsToday: jest.fn(async () => 0), remainingBudget: jest.fn(async () => 50) }));
jest.mock("@/lib/growth/daily-metrics", () => ({
  bumpDailyMetric: jest.fn(async () => {}),
  utcDay: () => new Date("2026-10-07T00:00:00.000Z"),
}));
jest.mock("@/lib/growth/flags", () => ({ appUrl: () => "https://humanizeit.app" }));
jest.mock("@/lib/admin", () => ({ founderEmail: () => "founder@gmail.com" }));
jest.mock("@/lib/user", () => ({ PLACEHOLDER_EMAIL_DOMAIN: "@placeholder.humanize-it.app" }));

import { forwardInbound, noteForwardNotDelivered } from "@/lib/email/inbound";
import { getResend } from "@/lib/email/resend-client";
import { checkDailyLimit } from "@/lib/rate-limit";
import { forwardsToday, remainingBudget } from "@/lib/email/budget";
import { bumpDailyMetric } from "@/lib/growth/daily-metrics";
import { canonicalHash } from "@/lib/email/address";
import { UNVERIFIED_WARNING } from "@/lib/email/inbound-rules";

const PIN = "mx.resend.com";
const AUTH_PASS = `Authentication-Results: ${PIN}; spf=pass smtp.mailfrom=example.com; dkim=pass header.i=@example.com; dmarc=pass header.from=example.com`;
const AUTH_FAIL = `Authentication-Results: ${PIN}; spf=fail smtp.mailfrom=example.com; dkim=none; dmarc=fail header.from=example.com`;
const rawMessage = (authHeader: string = AUTH_PASS, ...extra: string[]) =>
  [authHeader, ...extra, "From: Jane <jane@example.com>", "Subject: Refund please", "", "Hello"].join("\r\n");
const RAW = rawMessage();
const envelope = { emailId: "in_1", from: "Jane <jane@example.com>", subject: "Refund please" };
const savedEnv = { ...process.env };
const savedFetch = global.fetch;

function received(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      object: "email",
      id: "in_1",
      from: "Jane <jane@example.com>",
      to: ["support@humanizeit.app", "boss@thirdparty.com"],
      received_for: ["support@humanizeit.app"],
      subject: "Refund please",
      text: "Hello,\nplease refund my order.",
      html: "<p>Hello</p>",
      message_id: "<orig-1@mail.example.com>",
      headers: { "Message-ID": "<orig-1@mail.example.com>" },
      attachments: [],
      raw: { download_url: "https://inbound.resend.test/raw/in_1", expires_at: "2026-10-08T00:00:00.000Z" },
      ...overrides,
    },
    error: null,
  };
}

const serveRaw = (raw: string) => {
  global.fetch = jest.fn(async () => new Response(raw, { status: 200 })) as unknown as typeof fetch;
};
const task = (key = "inbound:in_1") => mockState.tasks.get(key) as Record<string, unknown> | undefined;
const sendCall = () => mockResend.emails.send.mock.calls[0] as [Record<string, unknown>, Record<string, unknown>];
const failSend = (name: string, statusCode: number) =>
  mockResend.emails.send.mockResolvedValueOnce({ data: null, error: { name, message: name, statusCode } });
const failRead = (name: string, statusCode: number) =>
  mockResend.emails.receiving.get.mockResolvedValueOnce({ data: null, error: { name, message: name, statusCode } });

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "info").mockImplementation(() => {});
  process.env = { ...savedEnv, EMAIL_FROM: "HumanizeIt <hello@mail.humanizeit.app>", INBOUND_AUTHSERV_ID: PIN };
  delete process.env.INBOUND_FORWARD_TO;
  delete process.env.INBOUND_FORWARD_FROM;
  mockState.tasks.clear();
  mockState.order.length = 0;
  (getResend as jest.Mock).mockReturnValue(mockResend);
  (checkDailyLimit as jest.Mock).mockResolvedValue({ ok: true });
  (forwardsToday as jest.Mock).mockResolvedValue(0);
  (remainingBudget as jest.Mock).mockResolvedValue(50);
  mockResend.emails.receiving.get.mockResolvedValue(received());
  mockResend.emails.send.mockImplementation(async () => {
    mockState.order.push("send");
    return { data: { id: "fwd_1" }, error: null };
  });
  serveRaw(RAW);
});

afterAll(() => {
  process.env = savedEnv;
  global.fetch = savedFetch;
});

describe("forwardInbound: the forward", () => {
  it("opens the task first, then sends a banner + quoted text + original.eml with Reply-To the real sender", async () => {
    const res = await forwardInbound(envelope);
    expect(res).toEqual({ status: "forwarded", forwardId: "fwd_1" });
    expect(mockState.order).toEqual(["task.create:inbound:in_1", "send"]);
    expect(mockResend.emails.receiving.get).toHaveBeenCalledWith("in_1", { html_format: "cid" });

    const [payload, options] = sendCall();
    expect(options).toEqual({ idempotencyKey: "inbound-forward/in_1" });
    expect(payload).toMatchObject({
      from: "HumanizeIt Inbox <inbox@mail.humanizeit.app>",
      to: ["founder@gmail.com"],
      replyTo: "jane@example.com",
      subject: "Refund please",
      headers: {
        "Auto-Submitted": "auto-generated",
        "X-HumanizeIt-Inbound-Id": "in_1",
        "In-Reply-To": "<orig-1@mail.example.com>",
        References: "<orig-1@mail.example.com>",
      },
      tags: [
        { name: "stream", value: "inbound_forward" },
        { name: "inbound", value: "in_1" },
      ],
    });
    expect(payload.html).toBeUndefined();
    expect(payload.attachments).toEqual([{ filename: "original.eml", content: Buffer.from(RAW).toString("base64"), contentType: "message/rfc822" }]);
    expect(payload.text).toContain("Sender check: SPF pass, DKIM pass, DMARC pass");
    expect(payload.text).toContain("https://humanizeit.app/admin/tasks");
    expect(payload.text).toContain("--- Original message (plain text, untrusted) ---\n> Hello,\n> please refund my order.");
    expect(payload.text).not.toContain("<p>");

    expect(bumpDailyMetric).toHaveBeenCalledWith("inbound.forwarded", 1);
    expect(task()).toMatchObject({ source: "rule", ruleKey: "inbound_email", kind: "email", createdBy: "inbound-email" });
    expect(task()!.body).toContain("Received at support@humanizeit.app.");
    expect(task()!.body).not.toContain("thirdparty");
    expect(task()!.body).toContain("Forwarded to your inbox.");
  });

  it("uses INBOUND_FORWARD_FROM and INBOUND_FORWARD_TO when set, and counts every recipient", async () => {
    process.env.INBOUND_FORWARD_FROM = "Support <help@mail.humanizeit.app>";
    process.env.INBOUND_FORWARD_TO = "a@x.com, b@y.com";
    await forwardInbound(envelope);
    expect(sendCall()[0]).toMatchObject({ from: "Support <help@mail.humanizeit.app>", to: ["a@x.com", "b@y.com"] });
    expect(bumpDailyMetric).toHaveBeenCalledWith("inbound.forwarded", 2);
  });

  it("doesn't attach an original declared over 10 MB, and still reads its headers", async () => {
    global.fetch = jest.fn(
      async () => new Response(RAW, { status: 200, headers: { "content-length": String(11 * 1024 * 1024) } })
    ) as unknown as typeof fetch;
    await forwardInbound(envelope);
    expect(sendCall()[0].attachments).toBeUndefined();
    expect(sendCall()[0].text).toContain("over 10 MB");
    expect(sendCall()[0].text).toContain("DMARC pass");
  });

  it("stops reading a stream over 10 MB that has no content-length", async () => {
    const chunk = new Uint8Array(1024 * 1024).fill(120);
    let pulls = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls += 1;
        controller.enqueue(pulls === 1 ? new TextEncoder().encode(`${RAW}\r\n`) : chunk);
        if (pulls > 50) controller.close();
      },
    });
    global.fetch = jest.fn(async () => new Response(body, { status: 200 })) as unknown as typeof fetch;
    await forwardInbound(envelope);
    expect(pulls).toBeLessThan(15);
    expect(sendCall()[0].attachments).toBeUndefined();
    expect(sendCall()[0].text).toContain("over 10 MB");
    expect(sendCall()[0].text).toContain("DMARC pass");
  });

  it("withholds the original when an attachment looks unsafe", async () => {
    mockResend.emails.receiving.get.mockResolvedValueOnce(
      received({ attachments: [{ id: "a1", filename: "invoice.zip", size: 10, content_type: "application/zip", content_id: null, content_disposition: "attachment" }] })
    );
    await forwardInbound(envelope);
    expect(sendCall()[0].attachments).toBeUndefined();
    expect(sendCall()[0].text).toContain("attachments could be unsafe");
  });

  it("adds no threading headers for a malformed Message-ID", async () => {
    mockResend.emails.receiving.get.mockResolvedValueOnce(received({ message_id: "<a@x>\r\nBcc: evil@x.com" }));
    await forwardInbound(envelope);
    expect(sendCall()[0].headers).toEqual({ "Auto-Submitted": "auto-generated", "X-HumanizeIt-Inbound-Id": "in_1" });
  });

  it("still forwards when the original can't be downloaded, marked unchecked", async () => {
    global.fetch = jest.fn(async () => new Response("gone", { status: 404 })) as unknown as typeof fetch;
    await forwardInbound(envelope);
    expect(sendCall()[0].attachments).toBeUndefined();
    expect(sendCall()[0].text).toContain("couldn't be attached");
    expect(sendCall()[0].text).toContain("Sender check: not checked");
    expect(sendCall()[0].text).toContain(UNVERIFIED_WARNING);
  });
});

describe("forwardInbound: caps", () => {
  it("checks the sender's limit (canonical address) before the global caps", async () => {
    const plus = { ...envelope, from: "J.ane+promo@gmail.com" };
    mockResend.emails.receiving.get.mockResolvedValueOnce(received({ from: "J.ane+promo@gmail.com" }));
    (checkDailyLimit as jest.Mock).mockResolvedValueOnce({ ok: false });
    const res = await forwardInbound(plus);
    expect(res).toEqual({ status: "skipped", reason: "sender_cap" });
    const key = canonicalHash("jane@gmail.com");
    expect(checkDailyLimit).toHaveBeenCalledWith(`inbound:${key}`, 5);
    expect(forwardsToday).not.toHaveBeenCalled();
    expect(mockResend.emails.send).not.toHaveBeenCalled();
    expect(task()).toBeUndefined();
    expect([...mockState.tasks.keys()]).toEqual([`inbound_sender_capped:${key.slice(0, 16)}:2026-10-07`]);
  });

  it("forwards at 39 of 40, and opens one task per day once the cap is reached", async () => {
    (forwardsToday as jest.Mock).mockResolvedValueOnce(39);
    expect((await forwardInbound(envelope)).status).toBe("forwarded");

    mockState.tasks.clear();
    (forwardsToday as jest.Mock).mockResolvedValue(40);
    expect(await forwardInbound({ ...envelope, emailId: "in_2" })).toEqual({ status: "skipped", reason: "daily_cap" });
    expect(await forwardInbound({ ...envelope, emailId: "in_3" })).toEqual({ status: "skipped", reason: "daily_cap" });
    // The second capped email hits the same dedupe key: still one task, no throw.
    expect([...mockState.tasks.keys()]).toEqual(["inbound_capped:2026-10-07"]);
    expect(task("inbound_capped:2026-10-07")).toMatchObject({ priority: "high" });
  });

  it("caps the tasks a day can open even when nothing is forwarded", async () => {
    (checkDailyLimit as jest.Mock).mockImplementation(async (key: string) => ({ ok: key !== "inbound:tasks" }));
    expect(await forwardInbound(envelope)).toEqual({ status: "skipped", reason: "task_cap" });
    expect(checkDailyLimit).toHaveBeenCalledWith("inbound:tasks", 60);
    expect([...mockState.tasks.keys()]).toEqual(["inbound_capped:2026-10-07"]);
    expect(mockResend.emails.send).not.toHaveBeenCalled();
  });

  it("does not re-claim the limits on a retry once the task is marked claimed", async () => {
    mockState.tasks.set("inbound:in_1", { dedupeKey: "inbound:in_1", body: "earlier", createdBy: "inbound-email" });
    const res = await forwardInbound(envelope);
    expect(res.status).toBe("forwarded");
    expect(checkDailyLimit).not.toHaveBeenCalled();
    expect(forwardsToday).not.toHaveBeenCalled();
    expect(mockResend.emails.send).toHaveBeenCalledTimes(1);
    expect(task()!.body).toContain("Forwarded to your inbox.");
  });

  it("claims on the retry after a failed first read, then never again", async () => {
    failRead("internal_server_error", 500);
    await expect(forwardInbound(envelope)).rejects.toThrow("inbound read failed");
    expect(task()).toMatchObject({ createdBy: "inbound-email:unclaimed" });
    expect(checkDailyLimit).not.toHaveBeenCalled();

    failSend("internal_server_error", 500);
    await expect(forwardInbound(envelope)).rejects.toThrow("inbound forward failed");
    expect(checkDailyLimit).toHaveBeenCalledTimes(2); // sender + tasks, once
    expect(task()).toMatchObject({ createdBy: "inbound-email" });

    expect((await forwardInbound(envelope)).status).toBe("forwarded");
    expect(checkDailyLimit).toHaveBeenCalledTimes(2);
  });

  it("keeps the inline reserve for welcome and magnet emails", async () => {
    (remainingBudget as jest.Mock).mockResolvedValueOnce(10);
    expect(await forwardInbound(envelope)).toEqual({ status: "skipped", reason: "no_budget" });
    expect(remainingBudget).toHaveBeenCalledWith("inline");
    expect(mockResend.emails.send).not.toHaveBeenCalled();
    expect(task()!.body).toContain("send budget is used up");

    mockState.tasks.clear();
    (remainingBudget as jest.Mock).mockResolvedValueOnce(11);
    expect((await forwardInbound(envelope)).status).toBe("forwarded");
  });
});

describe("forwardInbound: Resend failures", () => {
  it("does not throw on a payload refusal and writes it on the task", async () => {
    failSend("validation_error", 422);
    expect(await forwardInbound(envelope)).toEqual({ status: "skipped", reason: "rejected" });
    expect(task()!.body).toContain("Resend refused it (validation_error)");
    expect(bumpDailyMetric).not.toHaveBeenCalled();
    expect(task("inbound_misconfigured:2026-10-07")).toBeUndefined();
  });

  it("does not retry an unverified from address, and flags the misconfiguration", async () => {
    failSend("invalid_from_address", 403);
    expect(await forwardInbound(envelope)).toEqual({ status: "skipped", reason: "rejected" });
    expect(task()!.body).toContain("Resend refused it (invalid_from_address). Read it in Resend > Emails > Receiving.");
    expect(task("inbound_misconfigured:2026-10-07")).toMatchObject({ priority: "high" });
  });

  it("does not retry a restricted (sending-only) key on the read, and flags it", async () => {
    failRead("restricted_api_key", 401);
    expect(await forwardInbound(envelope)).toEqual({ status: "skipped", reason: "unreadable" });
    expect(task()!.body).toContain("Resend refused it (restricted_api_key)");
    expect(task()!.body).not.toContain("will retry");
    expect(task("inbound_misconfigured:2026-10-07")!.body).toContain("full access");
  });

  it("does not retry an unknown email id, without flagging the setup", async () => {
    failRead("not_found", 404);
    expect(await forwardInbound(envelope)).toEqual({ status: "skipped", reason: "unreadable" });
    expect(task("inbound_misconfigured:2026-10-07")).toBeUndefined();
  });

  it("treats a 409 on our idempotency key as already forwarded", async () => {
    failSend("invalid_idempotent_request", 409);
    expect(await forwardInbound(envelope)).toEqual({ status: "forwarded", forwardId: null });
    expect(bumpDailyMetric).toHaveBeenCalledWith("inbound.forwarded", 1);
  });

  it("does not retry when Resend's quota is used up", async () => {
    failSend("daily_quota_exceeded", 429);
    expect(await forwardInbound(envelope)).toEqual({ status: "skipped", reason: "quota" });
  });

  it("throws on a retryable failure, with the task already open", async () => {
    failSend("rate_limit_exceeded", 429);
    await expect(forwardInbound(envelope)).rejects.toThrow("inbound forward failed: rate_limit_exceeded");
    expect(task()!.body).toContain("Resend will retry");
  });

  it("opens a task when the message can't be read, and throws only if that's retryable", async () => {
    failRead("internal_server_error", 500);
    await expect(forwardInbound(envelope)).rejects.toThrow("inbound read failed");
    expect(task()).toMatchObject({ title: "Reply to jane@example.com: Refund please", contactId: null });

    mockState.tasks.clear();
    failRead("validation_error", 422);
    expect(await forwardInbound(envelope)).toEqual({ status: "skipped", reason: "unreadable" });
    expect(task()!.body).toContain("Resend refused it (validation_error)");
  });

  it("opens a task when Resend isn't configured", async () => {
    (getResend as jest.Mock).mockReturnValueOnce(null);
    expect(await forwardInbound(envelope)).toEqual({ status: "skipped", reason: "not_configured" });
    expect(task()!.body).toContain("Resend isn't configured");
  });
});

describe("forwardInbound: what isn't forwarded", () => {
  it("skips our own domains before reading anything (loop guard)", async () => {
    expect(await forwardInbound({ ...envelope, from: "HumanizeIt <hello@mail.humanizeit.app>" })).toEqual({ status: "skipped", reason: "own_domain" });
    expect(mockResend.emails.receiving.get).not.toHaveBeenCalled();
  });

  it("drops auto-replies, list mail and role senders before any claim or send, leaving one low task a day", async () => {
    mockResend.emails.receiving.get.mockResolvedValueOnce(received({ headers: { "Auto-Submitted": "auto-replied" } }));
    expect(await forwardInbound(envelope)).toEqual({ status: "skipped", reason: "automated" });
    mockResend.emails.receiving.get.mockResolvedValueOnce(received({ headers: { "List-Unsubscribe": "<https://x.com/u>" } }));
    expect(await forwardInbound({ ...envelope, emailId: "in_2" })).toEqual({ status: "skipped", reason: "automated" });
    mockResend.emails.receiving.get.mockResolvedValueOnce(received({ from: "MAILER-DAEMON@example.com" }));
    expect(await forwardInbound({ ...envelope, emailId: "in_3", from: "MAILER-DAEMON@example.com" })).toEqual({ status: "skipped", reason: "automated" });
    expect(checkDailyLimit).not.toHaveBeenCalled();
    expect(mockResend.emails.send).not.toHaveBeenCalled();
    expect([...mockState.tasks.keys()]).toEqual(["inbound_automated:2026-10-07"]);
    expect(task("inbound_automated:2026-10-07")).toMatchObject({ priority: "low" });
  });

  it("notes machine-sent mail on the task that a failed first read left behind", async () => {
    mockState.tasks.set("inbound:in_1", { dedupeKey: "inbound:in_1", body: "earlier", createdBy: "inbound-email:unclaimed" });
    mockResend.emails.receiving.get.mockResolvedValueOnce(received({ headers: { "Auto-Submitted": "auto-replied" } }));
    expect(await forwardInbound(envelope)).toEqual({ status: "skipped", reason: "automated" });
    expect(task()!.body).toContain("Not forwarded: machine-sent mail (auto_submitted).");
  });

  it("never forwards a DMARC fail from our receiving server, but keeps the task", async () => {
    serveRaw(rawMessage(AUTH_FAIL));
    expect(await forwardInbound(envelope)).toEqual({ status: "skipped", reason: "dmarc_fail" });
    expect(mockResend.emails.send).not.toHaveBeenCalled();
    expect(task()!.body).toContain("Not forwarded: the sender failed DMARC");
    expect(task()!.body).toContain(UNVERIFIED_WARNING);
  });
});

describe("forwardInbound: sender trust", () => {
  it("drops the warning on a trusted DMARC pass, but links no contact yet", async () => {
    await forwardInbound(envelope);
    expect(task()).toMatchObject({ contactId: null });
    expect(task()!.body).not.toContain(UNVERIFIED_WARNING);
  });

  it("ignores a forged pass from another authserv-id", async () => {
    serveRaw(rawMessage("Authentication-Results: attacker.example; dmarc=pass header.from=example.com"));
    await forwardInbound(envelope);
    expect(task()!.body).toContain("Sender check: not checked");
    expect(task()!.body).toContain(UNVERIFIED_WARNING);
    expect(sendCall()[0].text).toContain(UNVERIFIED_WARNING);
  });

  it("ignores a forged pass placed below our server's header", async () => {
    serveRaw(rawMessage(`Authentication-Results: ${PIN}; spf=pass smtp.mailfrom=example.com`, `Authentication-Results: ${PIN}; dmarc=pass header.from=example.com`));
    await forwardInbound(envelope);
    expect(task()!.body).toContain("DMARC none");
    expect(task()!.body).toContain(UNVERIFIED_WARNING);
  });

  it("checks nothing until INBOUND_AUTHSERV_ID is pinned", async () => {
    delete process.env.INBOUND_AUTHSERV_ID;
    await forwardInbound(envelope);
    expect(task()!.body).toContain("Sender check: not checked");
    expect(task()!.body).toContain(UNVERIFIED_WARNING);
  });
});

describe("noteForwardNotDelivered", () => {
  it("writes a bounce on the email's task once and raises one alert a day", async () => {
    await forwardInbound(envelope);
    await noteForwardNotDelivered("in_1", "bounced");
    await noteForwardNotDelivered("in_1", "bounced");
    const body = task()!.body as string;
    expect(body).toContain("Forwarded to your inbox.\nForward did NOT arrive (bounced): read it in Resend > Emails > Receiving.");
    expect(body.match(/did NOT arrive/g)).toHaveLength(1);
    expect(task("inbound_forward_bouncing:2026-10-07")).toMatchObject({ priority: "high" });
  });

  it("still raises the alert without a usable email id", async () => {
    await noteForwardNotDelivered(null, "suppressed");
    expect([...mockState.tasks.keys()]).toEqual(["inbound_forward_bouncing:2026-10-07"]);
  });
});
