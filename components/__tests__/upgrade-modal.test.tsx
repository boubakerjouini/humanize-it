import { renderToStaticMarkup } from "react-dom/server";
import { UpgradeModal } from "@/components/ui/upgrade-modal";
import type { CheckoutIntent } from "@/lib/checkout-intent";

jest.mock("posthog-js/react", () => ({ usePostHog: () => undefined }));
jest.mock("@vercel/analytics", () => ({ track: () => {} }));

function render(intent: CheckoutIntent | null = null): string {
  return renderToStaticMarkup(<UpgradeModal isOpen onClose={() => {}} currentPlan="FREE" intent={intent} />);
}

/** The plan card a badge sits on: the first plan name after it. */
function cardWith(html: string, badge: string): string | undefined {
  const at = html.indexOf(`>${badge}</div>`);
  if (at < 0) return undefined;
  return /<div[^>]*>(Free|Pro|Team)<\/div>/.exec(html.slice(at))?.[1];
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
});
