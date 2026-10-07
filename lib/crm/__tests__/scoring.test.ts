import { computeScore, gradeFor, sameBreakdown, type ScoreInput, type ScoreLine } from "@/lib/crm/scoring";

function input(over: Partial<ScoreInput> = {}): ScoreInput {
  return {
    hasEmail: false,
    emailVerified: false,
    magnetCount: 0,
    subscribedTopics: [],
    pendingTopics: [],
    channel: null,
    isUser: false,
    hasFirstDocument: false,
    docsLast14d: 0,
    humanizedLast30d: 0,
    quotaHitsLast30d: 0,
    checkoutsLast30d: 0,
    hasActiveSubscription: false,
    referrals: 0,
    userInactive30d: false,
    unsubscribed: false,
    emailStatus: "ok",
    ...over,
  };
}

/** Points a single rule contributes on top of an empty input. */
function pointsFor(over: Partial<ScoreInput>, key: string): number | undefined {
  return computeScore(input(over)).breakdown.find((l) => l.key === key)?.points;
}

describe("computeScore rules", () => {
  it("scores an empty contact 0 with no breakdown", () => {
    expect(computeScore(input())).toEqual({ score: 0, grade: "cold", breakdown: [] });
  });

  it.each([
    ["email_captured", { hasEmail: true }, 5],
    ["email_verified", { emailVerified: true }, 5],
    ["tips_subscribed", { subscribedTopics: ["tips"] }, 5],
    ["waitlist", { subscribedTopics: ["extension_launch"] }, 3],
    ["waitlist", { pendingTopics: ["extension_launch"] }, 3],
    ["warm_source", { channel: "referral_program" }, 10],
    ["warm_source", { channel: "outreach" }, 10],
    ["signed_up", { isUser: true }, 15],
    ["first_document", { hasFirstDocument: true }, 10],
    ["humanized", { humanizedLast30d: 4 }, 5],
    ["quota_hit", { quotaHitsLast30d: 2 }, 15],
    ["checkout_started", { checkoutsLast30d: 1 }, 20],
  ] as const)("%s adds its points", (key, over, points) => {
    expect(pointsFor(over, key)).toBe(points);
  });

  it("does not count organic or unknown channels as warm", () => {
    expect(pointsFor({ channel: "organic_search" }, "warm_source")).toBeUndefined();
  });

  it("ignores a started checkout when a subscription is active", () => {
    expect(pointsFor({ checkoutsLast30d: 1, hasActiveSubscription: true }, "checkout_started")).toBeUndefined();
  });

  it("caps per-item rules: magnets 15, recent docs 20, referrals 15", () => {
    expect(pointsFor({ magnetCount: 1 }, "magnet")).toBe(5);
    expect(pointsFor({ magnetCount: 3 }, "magnet")).toBe(15);
    expect(pointsFor({ magnetCount: 9 }, "magnet")).toBe(15);
    expect(pointsFor({ docsLast14d: 3 }, "recent_docs")).toBe(6);
    expect(pointsFor({ docsLast14d: 50 }, "recent_docs")).toBe(20);
    expect(pointsFor({ referrals: 2 }, "referrals")).toBe(10);
    expect(pointsFor({ referrals: 7 }, "referrals")).toBe(15);
  });

  it("applies the negative rules", () => {
    expect(pointsFor({ userInactive30d: true }, "inactive_30d")).toBe(-15);
    expect(pointsFor({ unsubscribed: true }, "unsubscribed")).toBe(-10);
    expect(pointsFor({ emailStatus: "bounced" }, "bounced")).toBe(-30);
    expect(pointsFor({ emailStatus: "complained" }, "complained")).toBe(-50);
  });

  it("only penalizes an unsubscribe when no topics are left", () => {
    expect(pointsFor({ unsubscribed: true, subscribedTopics: ["extension_launch"] }, "unsubscribed")).toBeUndefined();
  });

  it("clamps to 0..100", () => {
    expect(computeScore(input({ hasEmail: true, emailStatus: "complained" })).score).toBe(0);
    const maxed = computeScore(
      input({
        hasEmail: true,
        emailVerified: true,
        magnetCount: 3,
        subscribedTopics: ["tips", "extension_launch"],
        channel: "outreach",
        isUser: true,
        hasFirstDocument: true,
        docsLast14d: 10,
        humanizedLast30d: 1,
        quotaHitsLast30d: 1,
        checkoutsLast30d: 1,
        referrals: 3,
      })
    );
    expect(maxed.score).toBe(100);
    expect(maxed.breakdown.reduce((s, l) => s + l.points, 0)).toBeGreaterThan(100);
  });
});

describe("grades", () => {
  it("uses the 30 and 60 thresholds", () => {
    expect(gradeFor(0)).toBe("cold");
    expect(gradeFor(29)).toBe("cold");
    expect(gradeFor(30)).toBe("warm");
    expect(gradeFor(59)).toBe("warm");
    expect(gradeFor(60)).toBe("hot");
    expect(gradeFor(100)).toBe("hot");
  });

  it("grades the computed score", () => {
    // email 5 + verified 5 + signed up 15 + first doc 10 = 35
    expect(computeScore(input({ hasEmail: true, emailVerified: true, isUser: true, hasFirstDocument: true }))).toMatchObject({
      score: 35,
      grade: "warm",
    });
  });
});

describe("breakdown", () => {
  it("lists rules in table order, every time", () => {
    const keys = computeScore(
      input({
        emailStatus: "bounced",
        quotaHitsLast30d: 1,
        isUser: true,
        hasEmail: true,
        magnetCount: 1,
        userInactive30d: true,
        referrals: 1,
      })
    ).breakdown.map((l) => l.key);
    expect(keys).toEqual(["email_captured", "magnet", "signed_up", "quota_hit", "referrals", "inactive_30d", "bounced"]);
  });

  it("explains each line", () => {
    const line = computeScore(input({ docsLast14d: 1 })).breakdown[0];
    expect(line).toEqual({ key: "recent_docs", label: "Recent documents", points: 2, detail: "1 doc in 14d" });
  });
});

describe("sameBreakdown", () => {
  const breakdown = computeScore(input({ hasEmail: true, isUser: true, docsLast14d: 3 })).breakdown;
  /** What Postgres jsonb hands back: object keys shortest first, so detail before points. */
  const fromJsonb = (lines: ScoreLine[]) => lines.map(({ key, label, detail, points }) => ({ key, label, detail, points }));

  it("matches a breakdown read back from jsonb with its keys reordered", () => {
    expect(JSON.stringify(fromJsonb(breakdown))).not.toBe(JSON.stringify(breakdown));
    expect(sameBreakdown(fromJsonb(breakdown), breakdown)).toBe(true);
  });

  it("treats a contact never scored as an empty breakdown", () => {
    expect(sameBreakdown(null, [])).toBe(true);
    expect(sameBreakdown(null, breakdown)).toBe(false);
  });

  it("notices a changed, added or missing line", () => {
    const changed = fromJsonb(breakdown).map((l) => (l.key === "recent_docs" ? { ...l, detail: "4 docs in 14d", points: 8 } : l));
    expect(sameBreakdown(changed, breakdown)).toBe(false);
    expect(sameBreakdown(fromJsonb(breakdown).slice(1), breakdown)).toBe(false);
    expect(sameBreakdown([...fromJsonb(breakdown), { key: "x", label: "x", detail: "x", points: 1 }], breakdown)).toBe(false);
    expect(sameBreakdown("not a breakdown", breakdown)).toBe(false);
  });
});
