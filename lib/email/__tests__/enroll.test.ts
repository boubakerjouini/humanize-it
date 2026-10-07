// enroll() starts an enrollment at its first step's due time (spec §4.8), so a
// grant_expiry enrollment anchored weeks ahead isn't due on the next run.

jest.mock("@/lib/db", () => {
  const state = { flowEnabled: true, created: [] as Record<string, unknown>[] };
  const db = {
    emailFlowSetting: { findUnique: async () => ({ enabled: state.flowEnabled }) },
    sequenceEnrollment: {
      findFirst: async () => null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        state.created.push(data);
        return { id: "enr_1", ...data };
      },
    },
  };
  return { db, state };
});

import * as dbModule from "@/lib/db";
import { enroll, invalidateFlowCache } from "@/lib/email/enroll";

const state = (dbModule as unknown as { state: { flowEnabled: boolean; created: Record<string, unknown>[] } }).state;
const DAY = 24 * 60 * 60 * 1000;
/** grant_expiry-shaped: 14 days before the anchor, 1 day before, at it, 3 days after. */
const GRANT_STEPS = [{ offsetHours: -14 * 24 }, { offsetHours: -24 }, { offsetHours: 0 }, { offsetHours: 72 }];

beforeEach(() => {
  invalidateFlowCache();
  state.flowEnabled = true;
  state.created.length = 0;
});

describe("enroll", () => {
  it("sets nextRunAt to the first step's due time, with the anchor weeks ahead", async () => {
    const anchorAt = new Date(Date.now() + 60 * DAY);
    await enroll("contact_1", "grant_expiry", { anchorAt, steps: GRANT_STEPS, cycle: anchorAt.toISOString() });
    expect(state.created).toHaveLength(1);
    expect(state.created[0].nextRunAt).toEqual(new Date(anchorAt.getTime() - 14 * DAY));
  });

  it("leaves a first step already past due for the next run to pick up", async () => {
    const anchorAt = new Date(Date.now() + 3 * DAY);
    await enroll("contact_1", "grant_expiry", { anchorAt, steps: GRANT_STEPS });
    const nextRunAt = state.created[0].nextRunAt as Date;
    expect(nextRunAt).toEqual(new Date(anchorAt.getTime() - 14 * DAY));
    expect(nextRunAt.getTime()).toBeLessThan(Date.now());
  });

  it("does nothing while the flow is off", async () => {
    state.flowEnabled = false;
    await expect(enroll("contact_1", "grant_expiry", { anchorAt: new Date(), steps: GRANT_STEPS })).resolves.toBeNull();
    expect(state.created).toEqual([]);
  });
});
