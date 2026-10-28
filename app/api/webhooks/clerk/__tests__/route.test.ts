// POST /api/webhooks/clerk: a verified delivery is recorded as a WebhookEvent
// (source "clerk") for the ops freshness check, a retry of it is not an error,
// and a 500 is counted in DailyMetric.

const mockHeaders = new Map<string, string>();
jest.mock("next/headers", () => ({ headers: jest.fn(async () => ({ get: (k: string) => mockHeaders.get(k) ?? null })) }));
const mockVerify = jest.fn();
jest.mock("svix", () => ({ Webhook: jest.fn().mockImplementation(() => ({ verify: mockVerify })) }));
jest.mock("@clerk/nextjs/server", () => ({}));
jest.mock("@/lib/db", () => ({
  db: {
    webhookEvent: { create: jest.fn(async () => ({})) },
    user: { upsert: jest.fn(async () => ({ id: "u_1" })) },
  },
}));
jest.mock("@/lib/polar", () => ({ deleteCustomerOf: jest.fn() }));
jest.mock("@/lib/growth/daily-metrics", () => ({ bumpDailyMetric: jest.fn(async () => {}) }));
jest.mock("@/lib/growth/safe", () => ({ ...jest.requireActual("@/lib/growth/safe"), runAfter: jest.fn(), logGrowthError: jest.fn() }));

import { POST } from "@/app/api/webhooks/clerk/route";
import { db } from "@/lib/db";
import { bumpDailyMetric } from "@/lib/growth/daily-metrics";
import { logGrowthError } from "@/lib/growth/safe";

const SECRET = process.env.CLERK_WEBHOOK_SECRET;
const created = { type: "user.created", data: { id: "user_1", first_name: null, last_name: null, primary_email_address_id: "e1", email_addresses: [{ id: "e1", email_address: "someone@example.com" }] } };

function deliver() {
  return POST(new Request("http://localhost/api/webhooks/clerk", { method: "POST", body: JSON.stringify(created) }));
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.CLERK_WEBHOOK_SECRET = "whsec_test";
  mockHeaders.clear();
  mockHeaders.set("svix-id", "msg_1").set("svix-timestamp", "1").set("svix-signature", "v1,x");
  mockVerify.mockReturnValue(created);
});
afterAll(() => {
  process.env.CLERK_WEBHOOK_SECRET = SECRET;
});

it("records a verified delivery as a clerk WebhookEvent", async () => {
  expect((await deliver()).status).toBe(200);
  expect(db.webhookEvent.create).toHaveBeenCalledWith({ data: { eventId: "clerk:msg_1", source: "clerk" } });
});

it("treats a retried delivery (same svix id) as already recorded", async () => {
  (db.webhookEvent.create as jest.Mock).mockRejectedValueOnce(Object.assign(new Error("Unique"), { code: "P2002" }));
  expect((await deliver()).status).toBe(200);
  expect(logGrowthError).not.toHaveBeenCalled();
});

it("records nothing for an unsigned or forged request", async () => {
  mockHeaders.clear();
  expect((await deliver()).status).toBe(400);
  mockHeaders.set("svix-id", "msg_1").set("svix-timestamp", "1").set("svix-signature", "v1,x");
  mockVerify.mockImplementationOnce(() => {
    throw new Error("bad signature");
  });
  jest.spyOn(console, "error").mockImplementationOnce(() => {});
  expect((await deliver()).status).toBe(400);
  expect(db.webhookEvent.create).not.toHaveBeenCalled();
  expect(bumpDailyMetric).not.toHaveBeenCalled();
});

it("counts a failure (500) and still throws so Clerk retries", async () => {
  (db.user.upsert as jest.Mock).mockRejectedValueOnce(new Error("db down"));
  await expect(deliver()).rejects.toThrow("db down");
  expect(bumpDailyMetric).toHaveBeenCalledWith("ops.webhook_fail.clerk");
  process.env.CLERK_WEBHOOK_SECRET = "";
  await expect(deliver()).rejects.toThrow("Missing CLERK_WEBHOOK_SECRET");
  expect(bumpDailyMetric).toHaveBeenCalledTimes(2);
});
