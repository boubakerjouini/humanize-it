// The kill switch must short-circuit before any database access: with
// EMAIL_SENDING_ENABLED unset, nothing is read, written, claimed or advanced.

jest.mock("@/lib/db", () => {
  const accessed: string[] = [];
  const db = new Proxy(
    {},
    {
      get(_target, prop) {
        accessed.push(String(prop));
        throw new Error(`database accessed: ${String(prop)}`);
      },
    }
  );
  return { db, accessed };
});
jest.mock("@/lib/admin", () => ({ adminEmails: () => new Set(["founder@example.com"]) }));

import * as dbModule from "@/lib/db";
import { canSendInline, prepareEmail, sendEmail } from "@/lib/email/send";

const accessed = (dbModule as unknown as { accessed: string[] }).accessed;
const savedEnv = { ...process.env };

const input = {
  contactId: "contact_1",
  template: "magnet_delivery" as const,
  props: {
    magnet: "ai-detection-field-guide" as const,
    confirmUrl: "https://humanizeit.app/free/ai-detection-field-guide/thanks?t=x",
    downloadUrl: "https://humanizeit.app/lead-magnets/ai-detection-field-guide.pdf",
    consentPending: false,
  },
  dedupeKey: "magnet:contact_1:ai-detection-field-guide:2026-10-06",
  pool: "inline" as const,
};

afterEach(() => {
  process.env = { ...savedEnv };
  accessed.length = 0;
});

describe("sending disabled", () => {
  it("defers with reason 'disabled' and never touches the database when EMAIL_SENDING_ENABLED is unset", async () => {
    delete process.env.EMAIL_SENDING_ENABLED;
    process.env.RESEND_API_KEY = "re_test";
    process.env.EMAIL_FROM = "HumanizeIt <hello@mail.humanizeit.app>";
    process.env.EMAIL_TOKEN_SECRET = "x".repeat(40);

    await expect(sendEmail(input)).resolves.toEqual({ status: "deferred", reason: "disabled" });
    await expect(prepareEmail(input)).resolves.toEqual({ ok: false, outcome: { status: "deferred", reason: "disabled" } });
    await expect(canSendInline("magnet_delivery", "sam@example.com")).resolves.toBe(false);
    expect(accessed).toEqual([]);
  });

  it("(control) does reach the database once sending is enabled and configured", async () => {
    process.env.EMAIL_SENDING_ENABLED = "true";
    process.env.RESEND_API_KEY = "re_test";
    process.env.EMAIL_FROM = "HumanizeIt <hello@mail.humanizeit.app>";
    process.env.EMAIL_TOKEN_SECRET = "x".repeat(40);

    // The mocked database throws, which sendEmail reports as a deferred error instead of throwing.
    await expect(sendEmail(input)).resolves.toEqual({ status: "deferred", reason: "error" });
    expect(accessed).toContain("contact");
  });

  it("stays off without the transport configuration, even when enabled", async () => {
    process.env.EMAIL_SENDING_ENABLED = "true";
    delete process.env.RESEND_API_KEY;

    await expect(sendEmail({ ...input, isTest: true })).resolves.toEqual({ status: "deferred", reason: "disabled" });
    expect(accessed).toEqual([]);
  });
});
