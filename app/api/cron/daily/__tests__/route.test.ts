// The daily cron path is public in middleware.ts, so the handler itself must
// refuse anything but Vercel's `Authorization: Bearer $CRON_SECRET`, and must
// not start the job for an unauthorized request.

jest.mock("@/lib/growth/daily-job", () => ({
  runDailyJob: jest.fn(async () => ({ status: "ok", runId: "run_1", stats: { sendingMode: "off" } })),
}));

import { GET } from "@/app/api/cron/daily/route";
import { runDailyJob } from "@/lib/growth/daily-job";

const SECRET = "cron-secret-for-tests-0123456789";
const savedEnv = { ...process.env };
const runMock = runDailyJob as jest.MockedFunction<typeof runDailyJob>;

function call(authorization?: string) {
  return GET(new Request("http://localhost/api/cron/daily", { headers: authorization ? { authorization } : {} }));
}

afterEach(() => {
  process.env = { ...savedEnv };
  runMock.mockClear();
});

describe("GET /api/cron/daily", () => {
  it("accepts Vercel's bearer secret and runs the job as a cron trigger", async () => {
    process.env.CRON_SECRET = SECRET;
    const res = await call(`Bearer ${SECRET}`);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ ok: true, ran: true, runId: "run_1" });
    expect(runMock).toHaveBeenCalledWith({ trigger: "cron" });
  });

  it("reports a run skipped by the lock", async () => {
    process.env.CRON_SECRET = SECRET;
    runMock.mockResolvedValueOnce({ status: "locked" });
    const res = await call(`Bearer ${SECRET}`);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, ran: false, status: "locked" });
  });

  it("refuses a missing or wrong secret without running anything", async () => {
    process.env.CRON_SECRET = SECRET;
    for (const header of [undefined, "", SECRET, `Bearer ${SECRET}x`, "Bearer ", `bearer ${SECRET}`]) {
      const res = await call(header);
      expect(res.status).toBe(401);
      await expect(res.json()).resolves.toEqual({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
    }
    expect(runMock).not.toHaveBeenCalled();
  });

  it("fails closed when CRON_SECRET isn't configured", async () => {
    delete process.env.CRON_SECRET;
    expect((await call("Bearer ")).status).toBe(401);
    expect((await call("Bearer undefined")).status).toBe(401);
    expect(runMock).not.toHaveBeenCalled();
  });
});
