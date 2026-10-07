// The support inbox end to end with Resend, the database, the limiter and the
// send budget mocked: the task is opened before the send, the per-sender limit
// is checked before the global cap and never re-claimed on a retry, machine
// mail never uses a send, only a DMARC pass links a contact, and only a
// retryable Resend failure makes the webhook answer 500.

const mockState = {
  tasks: new Map<string, Record<string, unknown>>(),
  contacts: new Map<string, { id: string }>(),
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
      contact: {
        findUnique: jest.fn(async ({ where }: { where: { email: string } }) => mockState.contacts.get(where.email) ?? null),
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

import { forwardInbound } from "@/lib/email/inbound";
import { getResend } from "@/lib/email/resend-client";
import { checkDailyLimit } from "@/lib/rate-limit";
import { forwardsToday, remainingBudget } from "@/lib/email/budget";
import { bumpDailyMetric } from "@/lib/growth/daily-metrics";
import { emailHash } from "@/lib/email/address";
import { UNVERIFIED_WARNING } from "@/lib/email/inbound-rules";

const DMARC_PASS = "mx.resend.com; spf=pass smtp.mailfrom=example.com; dkim=pass header.i=@example.com; dmarc=pass header.from=example.com";
const RAW = "From: Jane <jane@example.com>\r\nSubject: Refund please\r\n\r\nHello";
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
      headers: { "Authentication-Results": DMARC_PASS },
      raw: { download_url: "https://inbound.resend.test/raw/in_1", expires_at: "2026-10-08T00:00:00.000Z" },
      ...overrides,
    },
    error: null,
  };
}

const task = () => mockState.tasks.get("inbound:in_1") as Record<string, unknown> | undefined;
const sendCall = () => mockResend.emails.send.mock.calls[0] as [Record<string, unknown>, Record<string, unknown>];

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "info").mockImplementation(() => {});
  process.env = { ...savedEnv, EMAIL_FROM: "HumanizeIt <hello@mail.humanizeit.app>" };
  delete process.env.INBOUND_FORWARD_TO;
  delete process.env.INBOUND_FORWARD_FROM;
  mockState.tasks.clear();
  mockState.contacts.clear();
  mockState.order.length = 0;
  (getResend as jest.Mock).mockReturnValue(mockResend);
  mockResend.emails.receiving.get.mockResolvedValue(received());
  mockResend.emails.send.mockImplementation(async () => {
    mockState.order.push("send");
    return { data: { id: "fwd_1" }, error: null };
  });
  global.fetch = jest.fn(async () => new Response(RAW, { status: 200 })) as unknown as typeof fetch;
});

afterAll(() => {
  process.env = savedEnv;
  global.fetch = savedFetch;
});

describe("forwardInbound: the forward", () => {
  it("opens the task first, then sends a banner + original.eml with Reply-To the real sender", async () => {
    const res = await forwardInbound(envelope);
    expect(res).toEqual({ status: "forwarded", forwardId: "fwd_1" });
    expect(mockState.order).toEqual(["task.create:inbound:in_1", "send"]);

    const [payload, options] = sendCall();
    expect(options).toEqual({ idempotencyKey: "inbound-forward/in_1" });
    expect(payload).toMatchObject({
      from: "HumanizeIt Inbox <inbox@mail.humanizeit.app>",
      to: ["founder@gmail.com"],
      replyTo: "jane@example.com",
      subject: "Refund please",
      headers: { "Auto-Submitted": "auto-generated", "X-HumanizeIt-Inbound-Id": "in_1" },
      tags: [{ name: "stream", value: "inbound_forward" }],
    });
    expect(payload.html).toBeUndefined();
    expect(payload.attachments).toEqual([{ filename: "original.eml", content: Buffer.from(RAW).toString("base64"), contentType: "message/rfc822" }]);
    expect(payload.text).toContain("Sender check: SPF pass, DKIM pass, DMARC pass");
    expect(payload.text).toContain("https://humanizeit.app/admin/tasks");

    expect(bumpDailyMetric).toHaveBeenCalledWith("inbound.forwarded");
    expect(task()).toMatchObject({ source: "rule", ruleKey: "inbound_email", kind: "email" });
    expect(task()!.body).toContain("Received at support@humanizeit.app.");
    expect(task()!.body).not.toContain("thirdparty");
    expect(task()!.body).toContain("Forwarded to your inbox.");
  });

  it("uses INBOUND_FORWARD_FROM and INBOUND_FORWARD_TO when set", async () => {
    process.env.INBOUND_FORWARD_FROM = "Support <help@mail.humanizeit.app>";
    process.env.INBOUND_FORWARD_TO = "a@x.com, b@y.com";
    await forwardInbound(envelope);
    expect(sendCall()[0]).toMatchObject({ from: "Support <help@mail.humanizeit.app>", to: ["a@x.com", "b@y.com"] });
  });

  it("doesn't attach an original over 10 MB and says so", async () => {
    global.fetch = jest.fn(
      async () => new Response("x", { status: 200, headers: { "content-length": String(11 * 1024 * 1024) } })
    ) as unknown as typeof fetch;
    await forwardInbound(envelope);
    expect(sendCall()[0].attachments).toBeUndefined();
    expect(sendCall()[0].text).toContain("over 10 MB");
  });
});

describe("forwardInbound: caps", () => {
  it("checks the sender's limit before the global cap", async () => {
    (checkDailyLimit as jest.Mock).mockResolvedValueOnce({ ok: false });
    const res = await forwardInbound(envelope);
    expect(res).toEqual({ status: "skipped", reason: "sender_cap" });
    expect(checkDailyLimit).toHaveBeenCalledWith(`inbound:${emailHash("jane@example.com")}`, 5);
    expect(forwardsToday).not.toHaveBeenCalled();
    expect(mockResend.emails.send).not.toHaveBeenCalled();
    expect(task()).toBeUndefined();
    expect([...mockState.tasks.keys()]).toEqual([`inbound_sender_capped:${emailHash("jane@example.com").slice(0, 16)}:2026-10-07`]);
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
    expect(mockState.tasks.get("inbound_capped:2026-10-07")).toMatchObject({ priority: "high" });
    (forwardsToday as jest.Mock).mockResolvedValue(0);
  });

  it("does not re-claim the limits on a retry (its task already exists)", async () => {
    mockState.tasks.set("inbound:in_1", { dedupeKey: "inbound:in_1", body: "earlier" });
    const res = await forwardInbound(envelope);
    expect(res.status).toBe("forwarded");
    expect(checkDailyLimit).not.toHaveBeenCalled();
    expect(forwardsToday).not.toHaveBeenCalled();
    expect(mockResend.emails.send).toHaveBeenCalledTimes(1);
    expect(task()!.body).toContain("Forwarded to your inbox.");
  });

  it("falls back to the task when the shared send budget is used up", async () => {
    (remainingBudget as jest.Mock).mockResolvedValueOnce(0);
    expect(await forwardInbound(envelope)).toEqual({ status: "skipped", reason: "no_budget" });
    expect(remainingBudget).toHaveBeenCalledWith("inline");
    expect(mockResend.emails.send).not.toHaveBeenCalled();
    expect(task()!.body).toContain("send budget is used up");
  });
});

describe("forwardInbound: Resend failures", () => {
  const failWith = (name: string, statusCode: number) =>
    mockResend.emails.send.mockResolvedValueOnce({ data: null, error: { name, message: name, statusCode } });

  it("does not throw on a non-retryable refusal and writes it on the task", async () => {
    failWith("validation_error", 422);
    expect(await forwardInbound(envelope)).toEqual({ status: "skipped", reason: "rejected" });
    expect(task()!.body).toContain("Resend refused it (validation_error)");
    expect(bumpDailyMetric).not.toHaveBeenCalled();
  });

  it("treats a 409 on our idempotency key as already forwarded", async () => {
    failWith("invalid_idempotent_request", 409);
    expect(await forwardInbound(envelope)).toEqual({ status: "forwarded", forwardId: null });
    expect(bumpDailyMetric).toHaveBeenCalledWith("inbound.forwarded");
  });

  it("does not retry when Resend's quota is used up", async () => {
    failWith("daily_quota_exceeded", 429);
    expect(await forwardInbound(envelope)).toEqual({ status: "skipped", reason: "quota" });
  });

  it("throws on a retryable failure, with the task already open", async () => {
    failWith("rate_limit_exceeded", 429);
    await expect(forwardInbound(envelope)).rejects.toThrow("inbound forward failed: rate_limit_exceeded");
    expect(task()!.body).toContain("Resend will retry");
  });

  it("opens a task when the message can't be read, and throws only if that's retryable", async () => {
    mockResend.emails.receiving.get.mockResolvedValueOnce({ data: null, error: { name: "internal_server_error", message: "x", statusCode: 500 } });
    await expect(forwardInbound(envelope)).rejects.toThrow("inbound read failed");
    expect(task()).toMatchObject({ title: "Reply to jane@example.com: Refund please", contactId: null });

    mockState.tasks.clear();
    mockResend.emails.receiving.get.mockResolvedValueOnce({ data: null, error: { name: "validation_error", message: "x", statusCode: 422 } });
    expect(await forwardInbound(envelope)).toEqual({ status: "skipped", reason: "unreadable" });
    expect(task()!.body).toContain("couldn't read the message");
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

  it("drops auto-replies and role senders before any claim, task or send", async () => {
    mockResend.emails.receiving.get.mockResolvedValueOnce(received({ headers: { "Auto-Submitted": "auto-replied" } }));
    expect(await forwardInbound(envelope)).toEqual({ status: "skipped", reason: "automated" });
    mockResend.emails.receiving.get.mockResolvedValueOnce(received({ from: "MAILER-DAEMON@example.com" }));
    expect(await forwardInbound({ ...envelope, from: "MAILER-DAEMON@example.com" })).toEqual({ status: "skipped", reason: "automated" });
    expect(checkDailyLimit).not.toHaveBeenCalled();
    expect(mockResend.emails.send).not.toHaveBeenCalled();
    expect(mockState.tasks.size).toBe(0);
  });
});

describe("forwardInbound: sender trust", () => {
  beforeEach(() => mockState.contacts.set("jane@example.com", { id: "c_jane" }));

  it("links the contact when DMARC passes", async () => {
    await forwardInbound(envelope);
    expect(task()).toMatchObject({ contactId: "c_jane" });
    expect(task()!.body).not.toContain(UNVERIFIED_WARNING);
  });

  it("leaves the contact unlinked and warns when DMARC fails", async () => {
    mockResend.emails.receiving.get.mockResolvedValueOnce(
      received({ headers: { "Authentication-Results": "mx; spf=fail; dkim=none; dmarc=fail header.from=example.com" } })
    );
    await forwardInbound(envelope);
    expect(task()).toMatchObject({ contactId: null });
    expect(task()!.body).toContain(UNVERIFIED_WARNING);
    expect(sendCall()[0].text).toContain(UNVERIFIED_WARNING);
  });
});
