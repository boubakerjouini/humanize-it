import { STAGES, STAGE_COLORS, STAGE_LABELS, computeStage, isStage, type StageInput } from "@/lib/crm/lifecycle";

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-10-06T12:00:00Z");
const daysAgo = (n: number, extraMs = 0) => new Date(NOW.getTime() - n * DAY - extraMs);

function input(over: Partial<StageInput> = {}): StageInput {
  return {
    now: NOW,
    override: null,
    hasEmail: true,
    isUser: false,
    userCreatedAt: null,
    effectivePlan: "FREE",
    subscriptionStatus: null,
    hadPaidSubscription: false,
    orgSeatActive: false,
    firstDocumentAt: null,
    lastActiveAt: null,
    docsLast14d: 0,
    emailVerified: false,
    magnetCount: 0,
    score: 0,
    ...over,
  };
}

/** A user who signed up 2 days ago and was active today. */
function user(over: Partial<StageInput> = {}): StageInput {
  return input({ isUser: true, userCreatedAt: daysAgo(2), lastActiveAt: NOW, emailVerified: true, ...over });
}

const stageOf = (i: StageInput) => computeStage(i).stage;

describe("computeStage rule table", () => {
  it("row 0: an admin override wins over everything", () => {
    expect(computeStage(input({ override: "customer", hasEmail: false }))).toEqual({ stage: "customer", reason: "admin override" });
    expect(stageOf(user({ override: "lead", subscriptionStatus: "past_due" }))).toBe("lead");
  });

  it("row 0: an unknown override is ignored", () => {
    expect(stageOf(input({ override: "vip" }))).toBe("lead");
  });

  it("row 1: payment issues are at risk, even over an active-looking customer", () => {
    for (const status of ["past_due", "unpaid", "paused"]) {
      expect(computeStage(user({ subscriptionStatus: status }))).toEqual({ stage: "at_risk", reason: "payment issue or paused" });
    }
  });

  it("row 2: a paying customer inactive for 14 days is at risk", () => {
    expect(computeStage(user({ subscriptionStatus: "active", lastActiveAt: daysAgo(15) }))).toEqual({
      stage: "at_risk",
      reason: "paying, inactive 14d",
    });
    expect(stageOf(user({ subscriptionStatus: "on_trial", lastActiveAt: daysAgo(20) }))).toBe("at_risk");
    expect(stageOf(user({ orgSeatActive: true, lastActiveAt: daysAgo(20) }))).toBe("at_risk");
  });

  it("row 2 boundary: exactly 14 days is not yet inactive", () => {
    expect(stageOf(user({ subscriptionStatus: "active", lastActiveAt: daysAgo(14) }))).toBe("customer");
    expect(stageOf(user({ subscriptionStatus: "active", lastActiveAt: daysAgo(14, 1) }))).toBe("at_risk");
  });

  it("row 2: falls back to the signup date when there was never any activity", () => {
    expect(stageOf(user({ subscriptionStatus: "active", lastActiveAt: null, userCreatedAt: daysAgo(20) }))).toBe("at_risk");
    expect(stageOf(user({ subscriptionStatus: "active", lastActiveAt: null, userCreatedAt: daysAgo(3) }))).toBe("customer");
  });

  it("row 3: an active subscription or a paid org seat is a customer", () => {
    expect(computeStage(user({ subscriptionStatus: "active" }))).toEqual({ stage: "customer", reason: "active subscription" });
    expect(stageOf(user({ subscriptionStatus: "on_trial" }))).toBe("customer");
    expect(stageOf(user({ orgSeatActive: true }))).toBe("customer");
  });

  it("row 4: a former subscriber back on Free has churned", () => {
    expect(computeStage(user({ hadPaidSubscription: true, subscriptionStatus: "cancelled" }))).toEqual({
      stage: "churned",
      reason: "subscription ended",
    });
    expect(stageOf(user({ hadPaidSubscription: true, subscriptionStatus: "expired", firstDocumentAt: daysAgo(40) }))).toBe("churned");
  });

  it("row 5: a comped plan inactive for 14 days is at risk", () => {
    expect(computeStage(user({ effectivePlan: "TEAM", lastActiveAt: daysAgo(15) }))).toEqual({
      stage: "at_risk",
      reason: "comped, inactive 14d",
    });
  });

  it("row 6: a non-FREE effective plan without a subscription is comped", () => {
    expect(computeStage(user({ effectivePlan: "PRO" }))).toEqual({ stage: "comped", reason: "plan via code or grant" });
    // A cancelled subscription whose plan is still PRO is not churned yet.
    expect(stageOf(user({ effectivePlan: "PRO", hadPaidSubscription: true, subscriptionStatus: "cancelled" }))).toBe("comped");
  });

  it("row 7: five or more documents in 14 days is a power user", () => {
    expect(computeStage(user({ firstDocumentAt: daysAgo(10), docsLast14d: 5 }))).toEqual({
      stage: "power_user",
      reason: "≥5 docs in 14d",
    });
  });

  it("row 8: a first document and activity within 30 days is activated", () => {
    expect(computeStage(user({ firstDocumentAt: daysAgo(10), docsLast14d: 4 }))).toEqual({ stage: "activated", reason: "active in 30d" });
  });

  it("rows 8/9 boundary: exactly 30 days inactive is still activated", () => {
    expect(stageOf(user({ firstDocumentAt: daysAgo(60), lastActiveAt: daysAgo(30) }))).toBe("activated");
    expect(stageOf(user({ firstDocumentAt: daysAgo(60), lastActiveAt: daysAgo(30, 1) }))).toBe("dormant");
  });

  it("row 9: dormant after 30 inactive days, or 30 days without a first document", () => {
    expect(computeStage(user({ firstDocumentAt: daysAgo(90), lastActiveAt: daysAgo(45) }))).toEqual({ stage: "dormant", reason: "inactive 30d" });
    expect(stageOf(user({ userCreatedAt: daysAgo(31), lastActiveAt: null }))).toBe("dormant");
    // Activity without a document does not keep an account out of dormant.
    expect(stageOf(user({ userCreatedAt: daysAgo(31), lastActiveAt: NOW }))).toBe("dormant");
  });

  it("row 10: a user without a first document yet is signed up", () => {
    expect(computeStage(user())).toEqual({ stage: "signed_up", reason: "no first document yet" });
    expect(stageOf(user({ userCreatedAt: daysAgo(30), lastActiveAt: null }))).toBe("signed_up");
  });

  it("row 11: a verified lead with two magnets or a score of 40 is engaged", () => {
    expect(computeStage(input({ emailVerified: true, magnetCount: 2 }))).toEqual({ stage: "engaged_lead", reason: "verified and engaged" });
    expect(stageOf(input({ emailVerified: true, score: 40 }))).toBe("engaged_lead");
    expect(stageOf(input({ emailVerified: true, magnetCount: 1, score: 39 }))).toBe("lead");
    expect(stageOf(input({ emailVerified: false, magnetCount: 3, score: 80 }))).toBe("lead");
  });

  it("row 12: anyone else with an email is a lead", () => {
    expect(computeStage(input())).toEqual({ stage: "lead", reason: "email captured" });
  });

  it("row 13: no email means prospect", () => {
    expect(computeStage(input({ hasEmail: false }))).toEqual({ stage: "prospect", reason: "no email yet" });
    expect(stageOf(input({ hasEmail: false, emailVerified: true, magnetCount: 3 }))).toBe("prospect");
  });
});

describe("stage metadata", () => {
  it("has a color and a label for every stage", () => {
    for (const stage of STAGES) {
      expect(STAGE_COLORS[stage]).toMatch(/^#[0-9a-f]{6}$/);
      expect(STAGE_LABELS[stage].length).toBeGreaterThan(0);
    }
  });

  it("recognizes stages", () => {
    expect(isStage("power_user")).toBe(true);
    expect(isStage("vip")).toBe(false);
    expect(isStage(null)).toBe(false);
  });
});
