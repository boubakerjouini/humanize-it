// The founder digest: a pure builder with counts only, a real send locked
// behind FOUNDER_DIGEST_ENABLED and live sending, one per UTC day, and the
// daily job's last step. Sending is mocked; nothing here reaches Resend.

const mockDb = {
  contact: { findUnique: jest.fn() },
  crmTask: { count: jest.fn() },
  // The job's retry and stuck-reset steps.
  emailMessage: { findMany: jest.fn(async () => []), updateMany: jest.fn(async () => ({ count: 0 })) },
};

jest.mock("@/lib/db", () => ({ db: mockDb }));
jest.mock("@/lib/admin", () => ({ founderEmail: () => "founder@example.com" }));
jest.mock("@/lib/admin-metrics", () => ({ getLast24hMetrics: jest.fn() }));
jest.mock("@/lib/rate-limit", () => ({ checkDailyLimit: jest.fn(async () => ({ ok: true })) }));
jest.mock("@/lib/email/send", () => ({ sendEmail: jest.fn() }));
jest.mock("@/lib/growth/flags", () => ({ ...jest.requireActual("@/lib/growth/flags"), emailSendingMode: jest.fn(() => "live") }));
jest.mock("@/lib/growth/safe", () => ({ logGrowthError: jest.fn() }));
// The daily job's other steps, so runDailyJob can run end to end here.
jest.mock("@/lib/growth/locks", () => ({
  withJobLock: async (_n: string, _t: number, fn: () => Promise<unknown>) => ({ locked: false, result: await fn() }),
  startJobRun: jest.fn(async () => "run_1"),
  finishJobRun: jest.fn(async () => {}),
  recordLockedRun: jest.fn(),
}));
jest.mock("@/lib/crm/recompute", () => ({ recomputeAll: jest.fn(async () => ({ contacts: 0 })) }));
jest.mock("@/lib/email/sweeps", () => ({ runSweeps: jest.fn(async () => ({})) }));
jest.mock("@/lib/crm/task-rules", () => ({ runAutoTaskRules: jest.fn(async () => ({})) }));
jest.mock("@/lib/email/circuit-breaker", () => ({ runCircuitBreaker: jest.fn(async () => ({ tripped: false })) }));
jest.mock("@/lib/email/engine", () => ({ processDueEnrollments: jest.fn(async () => ({ sent: 2, failed: 1 })) }));
jest.mock("@/lib/email/campaigns", () => ({ drainCampaigns: jest.fn(async () => ({})) }));
jest.mock("@/lib/email/budget", () => ({ remainingBudget: jest.fn(async () => 50) }));
jest.mock("@/lib/ops/checks", () => ({ runOpsChecks: jest.fn(async () => ({ failed: 0 })) }));

import { getLast24hMetrics } from "@/lib/admin-metrics";
import { sendEmail } from "@/lib/email/send";
import { checkDailyLimit } from "@/lib/rate-limit";
import { runDailyJob } from "@/lib/growth/daily-job";
import { buildFounderDigest, sendFounderDigest, sendFounderDigestTest, type DigestCounts } from "@/lib/growth/founder-digest";

const mockSend = sendEmail as jest.Mock;
const NOW = new Date("2026-10-28T08:00:00Z");
const COUNTS: DigestCounts = {
  signups: 3,
  toolRuns: 41,
  documents: 5,
  upgradeAttempts: 2,
  pausedAttempts: 1,
  emailsSent: 12,
  openSupportEmails: 1,
  openHighTasks: 2,
  openTasks: 4,
};
const JOB = { sequenceSent: 2, sequenceFailed: 1, breakerTripped: false, failedSteps: ["sweeps"] };
const savedEnv = process.env.FOUNDER_DIGEST_ENABLED;

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.FOUNDER_DIGEST_ENABLED;
  (getLast24hMetrics as jest.Mock).mockResolvedValue(COUNTS);
  mockDb.crmTask.count.mockResolvedValue(4);
  mockDb.contact.findUnique.mockResolvedValue({ id: "contact_founder" });
  mockSend.mockResolvedValue({ status: "sent", messageId: "m1", resendId: "r1" });
});
afterAll(() => {
  if (savedEnv === undefined) delete process.env.FOUNDER_DIGEST_ENABLED;
  else process.env.FOUNDER_DIGEST_ENABLED = savedEnv;
});

describe("buildFounderDigest", () => {
  it("lists every count and the job's results, with no address or id", () => {
    const digest = buildFounderDigest(NOW, COUNTS, JOB);
    expect(digest).toMatchSnapshot();
    const all = `${digest.subject}\n${digest.bodyMd}`;
    for (const label of ["Signups: 3", "Free-tool runs: 41", "Documents created: 5", "Checkout attempts: 2 (1 hit the paused checkout)", "Emails sent: 12", "Open support emails: 1", "Open tasks: 4", "Errors: 1 (sweeps)"]) {
      expect(all).toContain(label);
    }
    expect(all).not.toContain("@");
  });

  it("leaves the job section out of a test copy", () => {
    expect(buildFounderDigest(NOW, COUNTS, null).bodyMd).not.toContain("This morning's job");
  });
});

describe("sendFounderDigest", () => {
  it("is off without FOUNDER_DIGEST_ENABLED and writes nothing", async () => {
    expect(await sendFounderDigest(NOW, JOB)).toBe("off");
    expect(mockSend).not.toHaveBeenCalled();
    expect(mockDb.contact.findUnique).not.toHaveBeenCalled();
  });

  it("sends one digest to the founder's contact under a per-day dedupe key", async () => {
    process.env.FOUNDER_DIGEST_ENABLED = "true";
    expect(await sendFounderDigest(NOW, JOB)).toBe("sent");
    expect(mockDb.contact.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { email: "founder@example.com" } }));
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend.mock.calls[0][0]).toMatchObject({ contactId: "contact_founder", template: "founder_digest", dedupeKey: "digest:2026-10-28", pool: "bulk" });
    expect(mockSend.mock.calls[0][0].isTest).toBeUndefined();
  });

  it("uses the same key for a second run that day, so the send claims it as a duplicate", async () => {
    process.env.FOUNDER_DIGEST_ENABLED = "true";
    await sendFounderDigest(NOW, JOB);
    mockSend.mockResolvedValueOnce({ status: "duplicate", messageId: "m1" });
    expect(await sendFounderDigest(new Date("2026-10-28T15:00:00Z"), JOB)).toBe("duplicate");
    expect(mockSend.mock.calls[1][0].dedupeKey).toBe("digest:2026-10-28");
  });
});

describe("sendFounderDigestTest", () => {
  it("sends a [TEST] copy to the admin's own contact, within the shared test cap", async () => {
    await sendFounderDigestTest("contact_admin", NOW);
    expect(checkDailyLimit).toHaveBeenCalledWith("admin:personal-test", 40);
    expect(mockSend.mock.calls[0][0]).toMatchObject({ contactId: "contact_admin", template: "founder_digest", isTest: true });
    expect(mockSend.mock.calls[0][0].dedupeKey).toMatch(/^test:digest:\d+$/);
  });

  it("sends nothing once the cap is used up", async () => {
    (checkDailyLimit as jest.Mock).mockResolvedValueOnce({ ok: false });
    expect(await sendFounderDigestTest("contact_admin", NOW)).toBeNull();
    expect(mockSend).not.toHaveBeenCalled();
  });
});

describe("daily job digest step", () => {
  it("reports digest: off when the switch is unset", async () => {
    const res = await runDailyJob({ trigger: "cron" });
    expect(res).toMatchObject({ status: "ok", stats: { digest: "off" } });
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("runs last and passes this run's sequence stats", async () => {
    process.env.FOUNDER_DIGEST_ENABLED = "true";
    const res = await runDailyJob({ trigger: "cron" });
    expect(res).toMatchObject({ stats: { digest: "sent" } });
    expect(mockSend.mock.calls[0][0].props.bodyMd).toContain("Sequence steps sent: 2, failed: 1");
  });
});
