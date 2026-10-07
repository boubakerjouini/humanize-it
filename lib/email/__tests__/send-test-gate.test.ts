// A test send skips consent, so prepareEmail may only deliver it to an
// allowlisted inbox, live mode included. Anyone else is deferred at the
// allowlist gate, before any suppression lookup, budget check or message row.

jest.mock("@/lib/db", () => {
  const state: { contact: Record<string, unknown> | null; calls: string[] } = { contact: null, calls: [] };
  const model = (name: string) =>
    new Proxy(
      {},
      {
        get(_target, method) {
          const call = `${name}.${String(method)}`;
          return async () => {
            state.calls.push(call);
            if (call === "contact.findUnique") return state.contact;
            throw new Error(`unexpected database call: ${call}`);
          };
        },
      }
    );
  return { db: new Proxy({}, { get: (_target, name) => model(String(name)) }), state };
});
jest.mock("@/lib/admin", () => ({ adminEmails: () => new Set(["founder@example.com"]) }));

import * as dbModule from "@/lib/db";
import { prepareEmail, sendEmail } from "@/lib/email/send";

const state = (dbModule as unknown as { state: { contact: Record<string, unknown> | null; calls: string[] } }).state;
const savedEnv = { ...process.env };

/** Vercel production with sending on and no EMAIL_ALLOWLIST: the mode that skips the allowlist for normal sends. */
function liveMode(): void {
  const env = process.env as Record<string, string | undefined>;
  env.EMAIL_SENDING_ENABLED = "true";
  env.RESEND_API_KEY = "re_test";
  env.EMAIL_FROM = "HumanizeIt <hello@mail.humanizeit.app>";
  env.EMAIL_TOKEN_SECRET = "x".repeat(40);
  env.VERCEL_ENV = "production";
  env.NODE_ENV = "production";
  delete env.EMAIL_ALLOWLIST;
}

function contactWith(email: string) {
  return {
    id: "contact_1",
    email,
    name: "Sam",
    userId: "user_1",
    lifecycleEmails: true,
    subscribedTopics: [],
    emailVerifiedAt: null,
    emailStatus: "ok",
  };
}

const testSend = {
  contactId: "contact_1",
  template: "welcome" as const,
  props: {},
  dedupeKey: "test:welcome:contact_1:1",
  pool: "inline" as const,
  isTest: true,
};

beforeEach(() => {
  liveMode();
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  process.env = { ...savedEnv };
  state.contact = null;
  state.calls.length = 0;
  jest.restoreAllMocks();
});

describe("test sends in live mode", () => {
  it("are deferred for an inbox outside the allowlist, before anything else is read or written", async () => {
    state.contact = contactWith("sam@example.com");

    await expect(prepareEmail(testSend)).resolves.toEqual({ ok: false, outcome: { status: "deferred", reason: "allowlist" } });
    expect(state.calls).toEqual(["contact.findUnique"]);
  });

  it("go past the gate for an admin inbox", async () => {
    state.contact = contactWith("Founder@Example.com");

    await sendEmail(testSend);
    expect(state.calls).toContain("emailSuppression.findMany");
  });

  it("(control) a normal send to the same inbox isn't held at the allowlist", async () => {
    state.contact = contactWith("sam@example.com");

    // The mocked flow lookup fails, which reads as OFF: the send got past the allowlist gate to the flow toggle.
    await expect(prepareEmail({ ...testSend, isTest: false })).resolves.toEqual({
      ok: false,
      outcome: { status: "deferred", reason: "flow_off" },
    });
  });
});
