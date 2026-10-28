// The daily ops step: each failed check opens exactly one high-priority task a
// day, keyed ops:<check>:<day>, with counts and names only.

const mockState = {
  tasks: new Map<string, Record<string, unknown>>(),
  users: 0,
  clerkDeliveries: 0,
  metrics: [] as { day: Date; key: string; count: number }[],
  failedEmails: 0,
  lastRun: null as { status: string; startedAt: Date } | null,
};

jest.mock("@/lib/db", () => {
  const unique = () => Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
  return {
    db: {
      crmTask: {
        create: jest.fn(async ({ data }: { data: Record<string, unknown> & { dedupeKey: string } }) => {
          if (mockState.tasks.has(data.dedupeKey)) throw unique();
          mockState.tasks.set(data.dedupeKey, { ...data });
          return data;
        }),
      },
      user: { count: jest.fn(async () => mockState.users) },
      webhookEvent: { count: jest.fn(async () => mockState.clerkDeliveries) },
      dailyMetric: {
        findMany: jest.fn(async ({ where }: { where: { day: { gte: Date } } }) => mockState.metrics.filter((m) => m.day >= where.day.gte)),
      },
      emailMessage: { count: jest.fn(async () => mockState.failedEmails) },
      jobRun: { findFirst: jest.fn(async () => mockState.lastRun) },
    },
  };
});
jest.mock("@/lib/growth/safe", () => ({ ...jest.requireActual("@/lib/growth/safe"), logGrowthError: jest.fn() }));

import { db } from "@/lib/db";
import { runOpsChecks } from "@/lib/ops/checks";

const NOW = new Date(Date.UTC(2026, 9, 28, 6, 0, 0));
const TODAY = new Date(Date.UTC(2026, 9, 28));
const YESTERDAY = new Date(Date.UTC(2026, 9, 27));
const ALL_SET = { CLERK_WEBHOOK_SECRET: "s1", POLAR_WEBHOOK_SECRET: "s2", RESEND_WEBHOOK_SECRET: "s3", CRON_SECRET: "s4" } as unknown as NodeJS.ProcessEnv;
const JOB = { name: "growth-daily", runId: "run_now" };

beforeEach(() => {
  jest.clearAllMocks();
  mockState.tasks.clear();
  mockState.users = 0;
  mockState.clerkDeliveries = 0;
  mockState.metrics = [];
  mockState.failedEmails = 0;
  mockState.lastRun = { status: "ok", startedAt: new Date(NOW.getTime() - 24 * 3_600_000) };
});

it("raises nothing when everything is healthy", async () => {
  expect(await runOpsChecks(NOW, JOB, ALL_SET)).toEqual({ alerts: [] });
  expect(mockState.tasks.size).toBe(0);
});

it("opens one high-priority task for an empty Clerk secret, even when run twice the same day", async () => {
  const env = { ...ALL_SET, CLERK_WEBHOOK_SECRET: "" } as NodeJS.ProcessEnv;
  await runOpsChecks(NOW, JOB, env);
  await runOpsChecks(new Date(NOW.getTime() + 3_600_000), JOB, env);
  expect([...mockState.tasks.keys()]).toEqual(["ops:clerk_webhook_secret:2026-10-28"]);
  const task = mockState.tasks.get("ops:clerk_webhook_secret:2026-10-28")!;
  expect(task).toMatchObject({ priority: "high", contactId: null, ruleKey: "ops", source: "rule" });
  // Names only: no secret value lands in a task.
  expect(JSON.stringify(task)).not.toMatch(/"s[1-4]"|\bs[1-4]\b/);
});

it("flags signups without any Clerk webhook in 48 hours", async () => {
  mockState.users = 3;
  expect((await runOpsChecks(NOW, JOB, ALL_SET)).alerts).toEqual(["clerk_webhook_silent"]);
  mockState.tasks.clear();
  mockState.clerkDeliveries = 1;
  expect((await runOpsChecks(NOW, JOB, ALL_SET)).alerts).toEqual([]);
  expect((db.webhookEvent.count as jest.Mock).mock.calls[0][0].where.source).toBe("clerk");
});

it("opens a server-error task at the threshold, not below it", async () => {
  mockState.metrics = [{ day: YESTERDAY, key: "ops.5xx.api/public", count: 3 }];
  expect((await runOpsChecks(NOW, JOB, ALL_SET)).alerts).toEqual([]);
  mockState.metrics = [
    { day: YESTERDAY, key: "ops.5xx.api/public", count: 12 },
    { day: TODAY, key: "ops.5xx.app", count: 40 },
  ];
  expect((await runOpsChecks(NOW, JOB, ALL_SET)).alerts).toEqual(["server_errors"]);
  expect(mockState.tasks.size).toBe(1);
  const task = mockState.tasks.get("ops:server_errors:2026-10-28")!;
  expect(task).toMatchObject({ priority: "high" });
  expect(String(task.body)).toContain("api/public: 12");
  expect(String(task.body)).not.toContain("app: 40");
});

it("flags any webhook failure since yesterday", async () => {
  mockState.metrics = [{ day: TODAY, key: "ops.webhook_fail.polar", count: 1 }];
  expect((await runOpsChecks(NOW, JOB, ALL_SET)).alerts).toEqual(["webhook_fail"]);
});

it("opens one email_failed task for emails that ran out of attempts", async () => {
  mockState.failedEmails = 1;
  await runOpsChecks(NOW, JOB, ALL_SET);
  expect([...mockState.tasks.keys()]).toEqual(["ops:email_failed:2026-10-28"]);
  const where = (db.emailMessage.count as jest.Mock).mock.calls[0][0].where;
  expect(where).toMatchObject({ status: "failed", attempts: { gte: 3 } });
  expect(where.updatedAt.gte.getTime()).toBe(NOW.getTime() - 24 * 3_600_000);
});

it("flags the daily job when the run before this one errored or was more than 26 hours ago", async () => {
  mockState.lastRun = { status: "error", startedAt: new Date(NOW.getTime() - 24 * 3_600_000) };
  expect((await runOpsChecks(NOW, JOB, ALL_SET)).alerts).toEqual(["daily_job"]);
  mockState.tasks.clear();
  mockState.lastRun = { status: "ok", startedAt: new Date(NOW.getTime() - 30 * 3_600_000) };
  expect((await runOpsChecks(NOW, JOB, ALL_SET)).alerts).toEqual(["daily_job"]);
  expect((db.jobRun.findFirst as jest.Mock).mock.calls[0][0].where.id).toEqual({ not: "run_now" });
});

it("keeps going when one check's query fails", async () => {
  (db.user.count as jest.Mock).mockRejectedValueOnce(new Error("db down"));
  mockState.failedEmails = 2;
  expect((await runOpsChecks(NOW, JOB, ALL_SET)).alerts).toEqual(["email_failed"]);
});
