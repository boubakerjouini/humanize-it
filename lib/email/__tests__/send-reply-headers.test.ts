// A personal note that answers a support email carries In-Reply-To and
// References, taken from its stored props so a retry threads the same way.

const mockDb = {
  contact: {
    findUnique: jest.fn(async () => ({
      id: "contact_1",
      email: "sereen@example.org",
      name: "Sereen",
      userId: null,
      lifecycleEmails: true,
      subscribedTopics: [],
      emailVerifiedAt: null,
      emailStatus: "ok",
    })),
  },
  emailSuppression: { findMany: jest.fn(async () => []) },
  emailMessage: { create: jest.fn(async (_args: { data: Record<string, unknown> }) => ({ id: "m1", queuedAt: new Date("2026-10-27T18:00:00Z") })) },
};

jest.mock("@/lib/db", () => ({ db: mockDb }));
jest.mock("@/lib/admin", () => ({ adminEmails: () => new Set(["founder@example.com"]) }));
jest.mock("@/lib/email/budget", () => ({ remainingBudget: jest.fn(async () => 50) }));
jest.mock("@/lib/email/resend-client", () => ({ ...jest.requireActual("@/lib/email/resend-client"), getResend: () => ({}) }));
jest.mock("@/lib/growth/flags", () => ({
  ...jest.requireActual("@/lib/growth/flags"),
  emailSendingMode: () => "live",
  postalAddress: () => null,
}));
jest.mock("@/lib/email/render", () => ({
  ...jest.requireActual("@/lib/email/render"),
  buildRenderCtx: () => ({}),
  renderEmail: async (_template: string, props: { subject: string }) => ({ subject: props.subject, html: "<p>Hi</p>", text: "Hi" }),
}));

import { prepareEmail } from "@/lib/email/send";

const NOTE = { subject: "Re: Checkout not working", bodyMd: "Hi Sereen" };

async function payloadFor(props: Record<string, unknown>) {
  const out = await prepareEmail({ contactId: "contact_1", template: "personal_note", props: props as typeof NOTE, dedupeKey: "personal:contact_1:abc", pool: "inline" });
  if (!out.ok) throw new Error(`not prepared: ${JSON.stringify(out.outcome)}`);
  return out.prepared.payload;
}

beforeEach(() => jest.clearAllMocks());

it("threads a reply with the Message-ID it answers", async () => {
  const payload = await payloadFor({ ...NOTE, inReplyTo: "<abc123@mail.example.org>" });
  expect(payload.headers).toEqual({ "In-Reply-To": "<abc123@mail.example.org>", References: "<abc123@mail.example.org>" });
  // Stored with the row, so a retry rebuilds the same headers.
  expect(mockDb.emailMessage.create.mock.calls[0][0].data.props).toMatchObject({ inReplyTo: "<abc123@mail.example.org>" });
});

it("adds no headers to a plain personal note, and ignores a malformed Message-ID", async () => {
  expect((await payloadFor(NOTE)).headers).toBeUndefined();
  expect((await payloadFor({ ...NOTE, inReplyTo: "abc\r\nBcc: x@y.z" })).headers).toBeUndefined();
});
