import { renderToStaticMarkup } from "react-dom/server";
import { CheckoutPausedPanel, UpgradeModal } from "@/components/ui/upgrade-modal";
import { CHECKOUT_PAUSED_FALLBACK, checkoutOutcome, requestCheckout } from "@/components/checkout-outcome";
import type { CheckoutIntent } from "@/lib/checkout-intent";
import type { OffersInfo } from "@/components/growth/founding-offers";
import type { ReferralInfo } from "@/components/growth/referral-card";

jest.mock("posthog-js/react", () => ({ usePostHog: () => undefined }));
jest.mock("@vercel/analytics", () => ({ track: () => {} }));

// The menu's data hooks fetch in effects, which never run on the server: stub
// what they return so the quota extras can be rendered.
let mockOffers: OffersInfo | null = null;
let mockReferral: ReferralInfo | null = null;
jest.mock("@/components/growth/founding-offers", () => ({
  useOffers: () => mockOffers,
  startOfferCheckout: async () => null,
}));
jest.mock("@/components/growth/referral-card", () => ({ useReferralInfo: () => mockReferral }));

afterEach(() => {
  mockOffers = null;
  mockReferral = null;
});

function render(intent: CheckoutIntent | null = null): string {
  return renderToStaticMarkup(<UpgradeModal isOpen onClose={() => {}} currentPlan="FREE" intent={intent} />);
}

/** The plan card a badge sits on: the first plan name after it. */
function cardWith(html: string, badge: string): string | undefined {
  const at = html.indexOf(`>${badge}</div>`);
  if (at < 0) return undefined;
  return /<h3[^>]*>(Free|Pro|Team)<\/h3>/.exec(html.slice(at))?.[1];
}

/** Label of the checked billing option. */
function checkedBilling(html: string): string | undefined {
  return /role="radio" aria-checked="true"[^>]*>([^<]+)</.exec(html)?.[1];
}

describe("UpgradeModal", () => {
  it("recommends Pro without claiming it is the most popular", () => {
    const html = render();
    expect(cardWith(html, "Recommended")).toBe("Pro");
    expect(html).not.toContain("Most popular");
    expect(html).not.toContain("Your pick");
    expect(checkedBilling(html)).toMatch(/^Annual/);
  });

  it("marks the plan picked on the pricing page and its billing period", () => {
    const team = render({ plan: "TEAM", annual: false });
    expect(cardWith(team, "Your pick")).toBe("Team");
    expect(team).not.toContain("Recommended");
    expect(checkedBilling(team)).toBe("Monthly");

    const pro = render({ plan: "PRO", annual: true });
    expect(cardWith(pro, "Your pick")).toBe("Pro");
    expect(checkedBilling(pro)).toMatch(/^Annual/);
  });

  it("is a native dialog named by its title", () => {
    const html = render();
    const labelledBy = /<dialog[^>]* aria-labelledby="([^"]+)"/.exec(html)?.[1];
    expect(labelledBy).toBeTruthy();
    expect(html).toContain(`<h2 id="${labelledBy}"`);
    // showModal() supplies the dialog role and modality; ARIA copies of them would be redundant.
    expect(html).not.toContain('role="dialog"');
    expect(html).toMatch(/<button[^>]*aria-label="Close"/);
  });

  it("names each plan on its button, with no arrow", () => {
    const html = render();
    expect(html).toContain(">Upgrade to Pro</button>");
    expect(html).toContain(">Upgrade to Team</button>");
    expect(html).not.toMatch(/→|&rarr;|lucide-arrow/);
  });

  it("offers a step down from Team as a switch", () => {
    const html = renderToStaticMarkup(<UpgradeModal isOpen onClose={() => {}} currentPlan="TEAM" />);
    expect(html).toContain(">Switch to Pro</button>");
    expect(html).toContain(">Current plan</div>");
    expect(html).not.toContain("Upgrade to Team");
  });

  it("keeps the quota copy and the cheaper ways out on a quota hit", () => {
    mockOffers = {
      founding: { configured: false, open: false, left: null, member: false },
      wordPack: { available: true, priceUsd: 5, words: 20_000, days: 60 },
    };
    mockReferral = { enabled: true, code: "abc", link: "https://humanizeit.app/r/abc", rewardWords: 5_000, referred: 0, rewarded: 0, bonusWords: 0 };
    const quota = renderToStaticMarkup(<UpgradeModal isOpen onClose={() => {}} currentPlan="FREE" trigger="quota" />);
    expect(quota).toContain("Limit reached");
    expect(quota).toContain("Free words reset 24 hours after your last reset.");
    expect(quota).toContain("Word Pack: 20,000 words for $5");
    expect(quota).toContain("Invite a friend: you both get 5,000 words");

    // A plain upgrade never shows them, even when both are available.
    const plain = render();
    expect(plain).not.toContain("Word Pack");
    expect(plain).not.toContain("Invite a friend");
  });

  it("renders nothing inside the dialog while closed", () => {
    const html = renderToStaticMarkup(<UpgradeModal isOpen={false} onClose={() => {}} currentPlan="FREE" />);
    expect(html).toMatch(/^<dialog[^>]*><style>/);
    expect(html).not.toContain("Recommended");
  });
});

describe("CHECKOUT_PAUSED", () => {
  const paused = { error: { code: "CHECKOUT_PAUSED", message: "Checkout reopens on Monday." } };

  it("reads a paused answer as a notice with the server's message", () => {
    expect(checkoutOutcome(false, paused)).toEqual({ kind: "paused", message: "Checkout reopens on Monday." });
    expect(checkoutOutcome(false, { error: { code: "CHECKOUT_PAUSED" } })).toEqual({ kind: "paused", message: CHECKOUT_PAUSED_FALLBACK });
  });

  it("keeps every other answer on today's path", () => {
    expect(checkoutOutcome(true, { url: "https://polar.sh/checkout/x" })).toEqual({ kind: "redirect", url: "https://polar.sh/checkout/x" });
    const subscriptionPaused = { error: { code: "SUBSCRIPTION_PAUSED", message: "Your subscription is paused." } };
    expect(checkoutOutcome(false, subscriptionPaused)).toEqual({ kind: "error", message: "Your subscription is paused.", body: subscriptionPaused });
    expect(checkoutOutcome(false, null)).toEqual({ kind: "error", message: null, body: null });
    expect(checkoutOutcome(false, { url: "https://polar.sh/checkout/x" }).kind).toBe("error");
  });

  describe("requestCheckout", () => {
    const realFetch = global.fetch;
    afterEach(() => {
      global.fetch = realFetch;
    });

    it("posts the plan and resolves a 409 CHECKOUT_PAUSED as paused", async () => {
      const fetchMock = jest.fn(async () => new Response(JSON.stringify(paused), { status: 409, headers: { "Content-Type": "application/json" } }));
      global.fetch = fetchMock as unknown as typeof fetch;
      await expect(requestCheckout("PRO", true)).resolves.toEqual({ kind: "paused", message: "Checkout reopens on Monday." });
      expect(fetchMock).toHaveBeenCalledWith("/api/checkout", expect.objectContaining({ method: "POST", body: JSON.stringify({ plan: "PRO", annual: true }) }));
    });

    it("rejects on a network failure, so callers keep their own error", async () => {
      global.fetch = jest.fn(async () => {
        throw new TypeError("Failed to fetch");
      }) as unknown as typeof fetch;
      await expect(requestCheckout("TEAM", false)).rejects.toThrow("Failed to fetch");
    });
  });

  it("shows the message calmly with a Got it button, not a red error", () => {
    const html = renderToStaticMarkup(<CheckoutPausedPanel message="Checkout reopens on Monday." onDone={() => {}} />);
    expect(html).toContain("Checkout reopens on Monday.");
    const describedBy = /<button[^>]*aria-describedby="([^"]+)"[^>]*>Got it<\/button>/.exec(html)?.[1];
    expect(describedBy?.split(" ")).toHaveLength(2);
    for (const id of describedBy!.split(" ")) expect(html).toContain(`id="${id}"`);
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain("#e11d48"); // THEME.ai, the error red
  });
});
