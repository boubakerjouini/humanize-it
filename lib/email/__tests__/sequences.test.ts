// Registry integrity for the sequence definitions: every step points at a
// catalog template owned by the same flow, offsets ascend, no template is left
// without a step, and every props builder produces props for its template.

import { FLOW_META, SEQUENCE_KEYS, TEMPLATES, templatesOfFlow } from "@/lib/email/catalog";
import {
  DEFAULT_GRANT_DAYS,
  SEQUENCES,
  WINBACK_BONUS_WORDS,
  emailDate,
  findStep,
  getSequence,
  parseEnrollmentContext,
  sampleContext,
  type SequenceContext,
} from "@/lib/email/sequences";

describe("sequence registry", () => {
  it("defines exactly the catalog's sequences", () => {
    expect(Object.keys(SEQUENCES).sort()).toEqual([...SEQUENCE_KEYS].sort());
    for (const key of SEQUENCE_KEYS) {
      expect(SEQUENCES[key].key).toBe(key);
      expect(SEQUENCES[key].name).toBe(FLOW_META[key].name);
    }
  });

  it.each(SEQUENCE_KEYS)("%s: templates exist, belong to the flow, and offsets ascend", (key) => {
    const seq = SEQUENCES[key];
    expect(seq.steps.length).toBeGreaterThan(0);
    const stepKeys = new Set<string>();
    let previous = -Infinity;
    for (const step of seq.steps) {
      expect(TEMPLATES[step.template]).toBeDefined();
      expect(TEMPLATES[step.template].flow).toBe(key);
      expect(step.offsetHours).toBeGreaterThan(previous);
      previous = step.offsetHours;
      expect(stepKeys.has(step.key)).toBe(false);
      stepKeys.add(step.key);
    }
  });

  it.each(SEQUENCE_KEYS)("%s: every template of the flow has a step", (key) => {
    const used = new Set(SEQUENCES[key].steps.map((s) => s.template));
    expect(templatesOfFlow(key).filter((t) => !used.has(t))).toEqual([]);
  });

  it.each(SEQUENCE_KEYS)("%s: every step builds props from a sample context", (key) => {
    const ctx = sampleContext(key, new Date("2026-10-07T08:00:00Z"));
    for (const step of SEQUENCES[key].steps) {
      const props = step.props ? step.props(ctx) : {};
      expect(props).toEqual(expect.any(Object));
      expect(JSON.stringify(props)).not.toContain("undefined");
    }
  });

  it("looks up sequences and steps defensively", () => {
    expect(getSequence("churn_winback")).toBeNull();
    expect(getSequence("toString")).toBeNull();
    expect(findStep("onboarding", "welcome")?.template).toBe("welcome");
    expect(findStep("onboarding", "nope")).toBeNull();
  });
});

describe("step conditions and props", () => {
  const now = new Date("2026-10-07T08:00:00Z");
  const ctxFor = (key: (typeof SEQUENCE_KEYS)[number], patch: (c: SequenceContext) => void = () => {}) => {
    const c = sampleContext(key, now);
    patch(c);
    return c;
  };

  it("onboarding nudges only users without a first document, and pitches Pro only on Free", () => {
    const nudge = findStep("onboarding", "first_run_nudge")!;
    expect(nudge.when!(ctxFor("onboarding"))).toBe("send");
    expect(nudge.when!(ctxFor("onboarding", (c) => (c.contact.firstDocumentAt = now)))).toBe("skip");
    const pro = findStep("onboarding", "what_paid_users_do")!;
    expect(pro.when!(ctxFor("onboarding", (c) => (c.user = { ...c.user!, effectivePlan: "PRO" })))).toBe("skip");
  });

  it("grant_expiry picks the long or the short-pass path from grantDays", () => {
    const long = ctxFor("grant_expiry", (c) => (c.enrollment.context.grantDays = 365));
    const pass = ctxFor("grant_expiry", (c) => (c.enrollment.context.grantDays = 7));
    expect(findStep("grant_expiry", "grant_ending_notice")!.when!(long)).toBe("send");
    expect(findStep("grant_expiry", "grant_ending_notice")!.when!(pass)).toBe("skip");
    expect(findStep("grant_expiry", "trial_midpoint")!.when!(pass)).toBe("send");
    expect(findStep("grant_expiry", "trial_midpoint")!.when!(long)).toBe("skip");
    // Unknown grant length is treated as a long comp.
    const unknown = ctxFor("grant_expiry", (c) => (c.enrollment.context.grantDays = undefined));
    expect(DEFAULT_GRANT_DAYS).toBeGreaterThanOrEqual(30);
    expect(findStep("grant_expiry", "grant_ending_notice")!.when!(unknown)).toBe("send");
  });

  it("grant_expiry keeps the granted plan after the stored plan dropped to FREE", () => {
    const c = ctxFor("grant_expiry", (x) => {
      x.enrollment.context.plan = "TEAM";
      x.user = { plan: "FREE", effectivePlan: "FREE", planExpiresAt: null, createdAt: now };
    });
    expect(findStep("grant_expiry", "grant_ended")!.props!(c)).toEqual({ plan: "TEAM", expiresAt: c.enrollment.anchorAt.toISOString() });
    // Templates format dates themselves (in UTC), so they get ISO timestamps.
    expect(emailDate(new Date("2026-10-21T00:30:00Z"))).toBe("2026-10-21T00:30:00.000Z");
  });

  it("grant_keep_offer recommends Team only above Pro's monthly allowance", () => {
    const step = findStep("grant_expiry", "grant_keep_offer")!;
    expect(step.props!(ctxFor("grant_expiry", (c) => (c.wordsUsed30d = 12_000)))).toMatchObject({ recommended: "PRO", monthly: 9, annual: 79 });
    expect(step.props!(ctxFor("grant_expiry", (c) => (c.wordsUsed30d = 80_000)))).toMatchObject({ recommended: "TEAM", monthly: 29, annual: 249 });
  });

  it("the win-back bonus is announced only while bonus words are enabled", () => {
    const step = findStep("winback_inactive", "winback_bonus")!;
    const saved = process.env.REFERRALS_ENABLED;
    try {
      delete process.env.REFERRALS_ENABLED;
      expect(step.when!(ctxFor("winback_inactive"))).toBe("skip");
      process.env.REFERRALS_ENABLED = "true";
      expect(step.when!(ctxFor("winback_inactive"))).toBe("send");
      expect(step.effect).toBe("winback_bonus");
      expect(step.props!(ctxFor("winback_inactive"))).toEqual({ words: WINBACK_BONUS_WORDS });
    } finally {
      if (saved === undefined) delete process.env.REFERRALS_ENABLED;
      else process.env.REFERRALS_ENABLED = saved;
    }
  });

  it("the trial offer issues a pass first and skips once a checkout happened", () => {
    const step = findStep("quota_upgrade", "trial_offer")!;
    expect(step.effect).toBe("trial_pass");
    expect(step.when!(ctxFor("quota_upgrade"))).toBe("send");
    expect(step.when!(ctxFor("quota_upgrade", (c) => (c.checkoutSinceEnrollment = true)))).toBe("skip");
    expect(step.props!(ctxFor("quota_upgrade"))).toMatchObject({ code: "PASS-SAMPLE", days: 7 });
  });

  it("nurture_evidence knows whether the lead already has the Appeal Kit", () => {
    const step = findStep("lead_nurture", "nurture_evidence")!;
    expect(step.props!(ctxFor("lead_nurture"))).toMatchObject({ hasAppealKit: true });
    expect(step.props!(ctxFor("lead_nurture", (c) => (c.contact.magnets = [])))).toMatchObject({ hasAppealKit: false });
  });
});

describe("parseEnrollmentContext", () => {
  it("keeps known, well-typed fields only", () => {
    expect(
      parseEnrollmentContext({ magnet: "ai-detection-field-guide", grantDays: 30, plan: "TEAM", trialCode: "PASS-ABC123", bonusGranted: true, junk: 1 })
    ).toEqual({ magnet: "ai-detection-field-guide", grantDays: 30, plan: "TEAM", trialCode: "PASS-ABC123", bonusGranted: true });
    expect(parseEnrollmentContext({ magnet: "nope", plan: "FREE", grantDays: "30" })).toEqual({});
    expect(parseEnrollmentContext(null)).toEqual({});
    expect(parseEnrollmentContext([1, 2])).toEqual({});
  });
});
