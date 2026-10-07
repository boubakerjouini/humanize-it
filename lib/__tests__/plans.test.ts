import {
  FOUNDING,
  FOUNDER_SERVICES,
  PLANS,
  foundingExpiry,
  isFounderService,
  isToneAllowed,
  monthStartUtc,
  oneTimeOfferForVariant,
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
  it("hides the word pack while its variant is unset", () => {
    expect(wordPackConfig({})).toBeNull();
    expect(wordPackConfig({ LEMONSQUEEZY_WORDPACK_VARIANT_ID: "  " })).toBeNull();
  });

  it("defaults to 20,000 words for 60 days and reads overrides", () => {
    expect(wordPackConfig({ LEMONSQUEEZY_WORDPACK_VARIANT_ID: "42" })).toEqual({ variantId: "42", priceUsd: 5, words: 20_000, days: 60 });
    expect(wordPackConfig({ LEMONSQUEEZY_WORDPACK_VARIANT_ID: "42", WORDPACK_WORDS: "30000", WORDPACK_DAYS: "90" })).toMatchObject({ words: 30_000, days: 90 });
    expect(wordPackConfig({ LEMONSQUEEZY_WORDPACK_VARIANT_ID: "42", WORDPACK_WORDS: "-1", WORDPACK_DAYS: "abc" })).toMatchObject({ words: 20_000, days: 60 });
  });

  it("maps variants to offers and leaves subscription variants alone", () => {
    const env = { LEMONSQUEEZY_FOUNDING_VARIANT_ID: "100", LEMONSQUEEZY_WORDPACK_VARIANT_ID: "200" };
    expect(oneTimeOfferForVariant("100", env)).toBe("founding");
    expect(oneTimeOfferForVariant("200", env)).toBe("wordpack");
    expect(oneTimeOfferForVariant("1368282", env)).toBeNull();
    expect(oneTimeOfferForVariant("", env)).toBeNull();
    expect(oneTimeOfferForVariant("100", {})).toBeNull();
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
