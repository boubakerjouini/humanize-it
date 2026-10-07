// The Resend webhook end to end with a real svix signature: missing headers and
// bad signatures are refused before any database work, a permanent bounce
// suppresses the address and stops sequences, and a replayed delivery is a
// no-op thanks to the WebhookEvent ledger.

jest.mock("@/lib/db", () => {
  const state = {
    ledger: new Set<string>(),
    messages: new Map<string, Record<string, unknown>>(),
    contacts: new Map<string, Record<string, unknown>>(),
    suppressions: [] as Record<string, unknown>[],
    calls: [] as string[],
    failApply: false,
  };
  const unique = () => Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
  const db = {
    webhookEvent: {
      create: jest.fn(async ({ data }: { data: { eventId: string } }) => {
        state.calls.push("webhookEvent.create");
        if (state.ledger.has(data.eventId)) throw unique();
        state.ledger.add(data.eventId);
        return data;
      }),
      deleteMany: jest.fn(async ({ where }: { where: { eventId: string } }) => {
        state.ledger.delete(where.eventId);
        return { count: 1 };
      }),
    },
    emailMessage: {
      findUnique: jest.fn(async ({ where }: { where: { id?: string; resendId?: string } }) => {
        state.calls.push("emailMessage.findUnique");
        if (state.failApply) throw new Error("db down");
        if (where.id) return state.messages.get(where.id) ?? null;
        return [...state.messages.values()].find((m) => m.resendId === where.resendId) ?? null;
      }),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const m = state.messages.get(where.id)!;
        Object.assign(m, data);
        return m;
      }),
    },
    contact: {
      findUnique: jest.fn(async ({ where }: { where: { id?: string; email?: string } }) =>
        where.id ? (state.contacts.get(where.id) ?? null) : ([...state.contacts.values()].find((c) => c.email === where.email) ?? null)
      ),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => Object.assign(state.contacts.get(where.id)!, data)),
    },
    emailSuppression: {
      upsert: jest.fn(async ({ create }: { create: Record<string, unknown> }) => {
        state.suppressions.push(create);
        return create;
      }),
    },
  };
  return { db, state };
});
jest.mock("@/lib/crm/consent", () => ({ withdrawTopics: jest.fn(async () => ({ withdrawn: [] })) }));
jest.mock("@/lib/crm/recompute", () => ({ recomputeContact: jest.fn(async () => null) }));
jest.mock("@/lib/growth/triggers", () => ({ onEmailBounced: jest.fn(async () => {}) }));
jest.mock("@/lib/email/inbound", () => ({ forwardInbound: jest.fn(async () => ({ status: "forwarded", forwardId: "fwd_1" })) }));

import { Webhook } from "svix";
import * as dbModule from "@/lib/db";
import { POST } from "@/app/api/webhooks/resend/route";
import { onEmailBounced } from "@/lib/growth/triggers";
import { withdrawTopics } from "@/lib/crm/consent";
import { forwardInbound } from "@/lib/email/inbound";

type State = {
  ledger: Set<string>;
  messages: Map<string, Record<string, unknown>>;
  contacts: Map<string, Record<string, unknown>>;
  suppressions: Record<string, unknown>[];
  calls: string[];
  failApply: boolean;
};
const state = (dbModule as unknown as { state: State }).state;
const SECRET = `whsec_${Buffer.from("resend-webhook-test-secret-0123456789").toString("base64")}`;
const savedEnv = { ...process.env };

function signed(id: string, event: unknown, opts: { secret?: string; drop?: string } = {}) {
  const payload = JSON.stringify(event);
  const at = new Date();
  const headers: Record<string, string> = {
    "svix-id": id,
    "svix-timestamp": String(Math.floor(at.getTime() / 1000)),
    "svix-signature": new Webhook(opts.secret ?? SECRET).sign(id, at, payload),
  };
  if (opts.drop) delete headers[opts.drop];
  return POST(new Request("http://localhost/api/webhooks/resend", { method: "POST", headers, body: payload }));
}

const bounce = {
  type: "email.bounced",
  created_at: "2026-10-07T08:00:00.000Z",
  data: {
    email_id: "re_1",
    created_at: "2026-10-07T08:00:00.000Z",
    to: ["bounced@resend.dev"],
    tags: { m: "msg_1" },
    bounce: { type: "Permanent", subType: "General", message: "Mailbox does not exist" },
  },
};

beforeEach(() => {
  process.env = { ...savedEnv, RESEND_WEBHOOK_SECRET: SECRET };
  state.ledger.clear();
  state.calls.length = 0;
  state.suppressions.length = 0;
  state.failApply = false;
  state.messages.clear();
  state.contacts.clear();
  state.messages.set("msg_1", { id: "msg_1", status: "sent", contactId: "c1", toEmailHash: "hash_1", resendId: "re_1", deliveredAt: null, bouncedAt: null, complainedAt: null });
  state.contacts.set("c1", { id: "c1", email: "bounced@resend.dev", emailStatus: "ok" });
  jest.clearAllMocks();
});

afterAll(() => {
  process.env = savedEnv;
});

describe("POST /api/webhooks/resend: email.received (support inbox)", () => {
  const received = {
    type: "email.received",
    created_at: "2026-10-07T09:00:00.000Z",
    data: { email_id: "in_1", from: "Jane <jane@example.com>", to: ["support@humanizeit.app"], subject: "Refund please" },
  };

  it("forwards the email and never touches delivery state", async () => {
    const res = await signed("msg_in1", received);
    expect(res.status).toBe(200);
    expect(forwardInbound).toHaveBeenCalledWith({
      emailId: "in_1",
      from: "Jane <jane@example.com>",
      to: ["support@humanizeit.app"],
      subject: "Refund please",
    });
    expect(state.calls).not.toContain("emailMessage.findUnique");
  });

  it("answers 500 and releases the ledger when the forward fails, so Resend retries", async () => {
    (forwardInbound as jest.Mock).mockRejectedValueOnce(new Error("resend down"));
    const res = await signed("msg_in2", received);
    expect(res.status).toBe(500);
    expect(state.ledger.has("resend:msg_in2")).toBe(false);
  });

  it("a replayed delivery of the same event forwards once", async () => {
    await signed("msg_in3", received);
    const replay = await signed("msg_in3", received);
    expect(replay.status).toBe(200);
    expect(forwardInbound).toHaveBeenCalledTimes(1);
  });
});

describe("POST /api/webhooks/resend", () => {
  it.each(["svix-id", "svix-timestamp", "svix-signature"])("returns 400 without %s, before touching the database", async (header) => {
    const res = await signed("msg_a", bounce, { drop: header });
    expect(res.status).toBe(400);
    expect(state.calls).toEqual([]);
  });

  it("returns 400 on a signature made with another secret", async () => {
    const other = `whsec_${Buffer.from("some-other-secret-abcdefghijklmnop").toString("base64")}`;
    const res = await signed("msg_b", bounce, { secret: other });
    expect(res.status).toBe(400);
    expect(state.calls).toEqual([]);
  });

  it("a permanent bounce marks the message and contact, suppresses the address and exits sequences", async () => {
    const res = await signed("msg_c", bounce);
    expect(res.status).toBe(200);
    expect(state.ledger.has("resend:msg_c")).toBe(true);
    expect(state.messages.get("msg_1")).toMatchObject({ status: "bounced", bouncedAt: new Date("2026-10-07T08:00:00.000Z") });
    expect(state.contacts.get("c1")).toMatchObject({ emailStatus: "bounced" });
    expect(state.suppressions).toEqual([{ emailHash: "hash_1", scope: "all", reason: "bounce", source: "resend_webhook" }]);
    expect(onEmailBounced).toHaveBeenCalledWith("c1");
    expect(withdrawTopics).not.toHaveBeenCalled();
  });

  it("is idempotent on a replay of the same delivery", async () => {
    await signed("msg_d", bounce);
    jest.clearAllMocks();
    const res = await signed("msg_d", bounce);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, duplicate: true });
    expect(onEmailBounced).not.toHaveBeenCalled();
  });

  it("a complaint withdraws every topic", async () => {
    const res = await signed("msg_e", { ...bounce, type: "email.complained", data: { ...bounce.data, bounce: undefined } });
    expect(res.status).toBe(200);
    expect(state.messages.get("msg_1")).toMatchObject({ status: "complained" });
    expect(state.suppressions[0]).toMatchObject({ scope: "nonessential", reason: "complaint" });
    expect(withdrawTopics).toHaveBeenCalledWith("c1", "all", expect.objectContaining({ method: "webhook" }));
  });

  it("frees the ledger entry when processing fails, so Resend's retry runs again", async () => {
    state.failApply = true;
    const res = await signed("msg_f", bounce);
    expect(res.status).toBe(500);
    expect(state.ledger.has("resend:msg_f")).toBe(false);
  });

  it("acknowledges events it doesn't track", async () => {
    const res = await signed("msg_g", { type: "email.opened", data: { email_id: "re_1" } });
    expect(res.status).toBe(200);
    expect(state.messages.get("msg_1")).toMatchObject({ status: "sent" });
  });
});
