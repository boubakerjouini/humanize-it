// Campaign test sends go only to allowlisted inboxes: the admin's own address
// when it is on the list, otherwise a test inbox such as delivered@resend.dev.

jest.mock("@/lib/db", () => ({ db: {} }));
jest.mock("@/lib/admin", () => ({ adminEmails: () => new Set(["founder@example.com"]) }));

import { testRecipients } from "@/lib/email/campaigns";

const savedEnv = { ...process.env };

beforeEach(() => {
  process.env = { ...savedEnv, EMAIL_ALLOWLIST: "delivered@resend.dev,bounced@resend.dev" };
});

afterAll(() => {
  process.env = savedEnv;
});

it("puts an allowlisted admin first", () => {
  expect(testRecipients("Founder@Example.com")).toEqual({
    own: "founder@example.com",
    ownAllowed: true,
    choices: ["founder@example.com", "bounced@resend.dev", "delivered@resend.dev"],
  });
});

it("offers only the allowlist to an admin who isn't on it", () => {
  const r = testRecipients("claude-admin+clerk_test@example.com");
  expect(r.ownAllowed).toBe(false);
  expect(r.choices).toEqual(["bounced@resend.dev", "delivered@resend.dev", "founder@example.com"]);
});
