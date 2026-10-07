// The daily cron path is public in middleware.ts, so the handler itself must
// refuse anything but Vercel's `Authorization: Bearer $CRON_SECRET`.

import { GET } from "@/app/api/cron/daily/route";

const SECRET = "cron-secret-for-tests-0123456789";
const savedEnv = { ...process.env };

function call(authorization?: string) {
  return GET(new Request("http://localhost/api/cron/daily", { headers: authorization ? { authorization } : {} }));
}

afterEach(() => {
  process.env = { ...savedEnv };
});

describe("GET /api/cron/daily", () => {
  it("accepts Vercel's bearer secret", async () => {
    process.env.CRON_SECRET = SECRET;
    const res = await call(`Bearer ${SECRET}`);
    expect(res.status).toBe(200);
  });

  it("refuses a missing or wrong secret", async () => {
    process.env.CRON_SECRET = SECRET;
    for (const header of [undefined, "", SECRET, `Bearer ${SECRET}x`, "Bearer ", `bearer ${SECRET}`]) {
      const res = await call(header);
      expect(res.status).toBe(401);
      await expect(res.json()).resolves.toEqual({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
    }
  });

  it("fails closed when CRON_SECRET isn't configured", async () => {
    delete process.env.CRON_SECRET;
    expect((await call("Bearer ")).status).toBe(401);
    expect((await call("Bearer undefined")).status).toBe(401);
  });
});
