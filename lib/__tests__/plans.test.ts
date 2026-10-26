import {
  FOUNDING,
  FOUNDER_SERVICES,
  PLANS,
  foundingExpiry,
  isFounderService,
  isToneAllowed,
  monthStartUtc,
  oneTimeOfferForProduct,
  voiceProfileLimit,
  wordPackConfig,
} from "@/lib/plans";

const DAY = 86_400_000;

describe("tones", () => {
  it("gives Free the Standard tone only", () => {
    expect(isToneAllowed("FREE", "standard")).toBe(true);
    for (const tone of ["formal", "casual", "academic", "professional", "storytelling"]) {
      expect(isToneAllowed("FREE", tone)).toBe(false);
    }
  });

  it("gives Pro and Team all five", () => {
    expect(PLANS.PRO.toneOptions).toBe(5);
    expect(PLANS.TEAM.toneOptions).toBe(5);
    for (const tone of ["standard", "formal", "casual", "academic", "professional"]) {
      expect(isToneAllowed("PRO", tone)).toBe(true);
      expect(isToneAllowed("TEAM", tone)).toBe(true);
    }
  });
});

describe("voiceProfileLimit", () => {
  it("is Free 0, Pro 1, Pro annual 3, Founding 3, Team 10", () => {
    expect(voiceProfileLimit("FREE")).toBe(0);
    expect(voiceProfileLimit("FREE", { annual: true, founding: true })).toBe(0);
    expect(voiceProfileLimit("PRO")).toBe(1);
    expect(voiceProfileLimit("PRO", { annual: true })).toBe(3);
    expect(voiceProfileLimit("PRO", { founding: true })).toBe(3);
    expect(voiceProfileLimit("TEAM")).toBe(10);
    expect(voiceProfileLimit("TEAM", { annual: true })).toBe(10);
  });
});

describe("foundingExpiry", () => {
  const now = new Date("2026-10-07T12:00:00Z");

  it("is 730 days from now for a Free user", () => {
    expect(foundingExpiry({ plan: "FREE", planExpiresAt: null }, now).getTime()).toBe(now.getTime() + 730 * DAY);
  });

  it("stacks on a live Pro grant instead of shortening it", () => {
    const grantEnd = new Date(now.getTime() + 20 * DAY);
    expect(foundingExpiry({ plan: "PRO", planExpiresAt: grantEnd }, now).getTime()).toBe(grantEnd.getTime() + FOUNDING.grantDays * DAY);
  });

  it("ignores a lapsed grant and a non-Pro grant", () => {
    const lapsed = new Date(now.getTime() - DAY);
    expect(foundingExpiry({ plan: "PRO", planExpiresAt: lapsed }, now).getTime()).toBe(now.getTime() + 730 * DAY);
    const team = new Date(now.getTime() + 20 * DAY);
    expect(foundingExpiry({ plan: "TEAM", planExpiresAt: team }, now).getTime()).toBe(now.getTime() + 730 * DAY);
  });
});

describe("one-time offers", () => {
  it("hides the word pack while its product is unset", () => {
    expect(wordPackConfig({})).toBeNull();
    expect(wordPackConfig({ POLAR_WORDPACK_PRODUCT_ID: "  " })).toBeNull();
  });

  it("defaults to 20,000 words for 60 days and reads overrides", () => {
    expect(wordPackConfig({ POLAR_WORDPACK_PRODUCT_ID: "42" })).toEqual({ productId: "42", priceUsd: 5, words: 20_000, days: 60 });
    expect(wordPackConfig({ POLAR_WORDPACK_PRODUCT_ID: "42", WORDPACK_WORDS: "30000", WORDPACK_DAYS: "90" })).toMatchObject({ words: 30_000, days: 90 });
    expect(wordPackConfig({ POLAR_WORDPACK_PRODUCT_ID: "42", WORDPACK_WORDS: "-1", WORDPACK_DAYS: "abc" })).toMatchObject({ words: 20_000, days: 60 });
  });

  it("maps products to offers and leaves subscription products alone", () => {
    const env = { POLAR_FOUNDING_PRODUCT_ID: "100", POLAR_WORDPACK_PRODUCT_ID: "200" };
    expect(oneTimeOfferForProduct("100", env)).toBe("founding");
    expect(oneTimeOfferForProduct("200", env)).toBe("wordpack");
    expect(oneTimeOfferForProduct("prod_pro_monthly", env)).toBeNull();
    expect(oneTimeOfferForProduct("", env)).toBeNull();
    expect(oneTimeOfferForProduct("100", {})).toBeNull();
  });
});

describe("founder services", () => {
  it("caps each service at 10 a month for the right plan", () => {
    expect(FOUNDER_SERVICES.founder_review).toMatchObject({ plans: ["PRO"], monthlyCap: 10 });
    expect(FOUNDER_SERVICES.team_setup).toMatchObject({ plans: ["TEAM"], monthlyCap: 10 });
    expect(isFounderService("founder_review")).toBe(true);
    expect(isFounderService("toString")).toBe(false);
  });

  it("counts from the first instant of the UTC month", () => {
    expect(monthStartUtc(new Date("2026-10-31T23:59:59Z")).toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(monthStartUtc(new Date("2026-11-01T00:00:00Z")).toISOString()).toBe("2026-11-01T00:00:00.000Z");
  });
});
