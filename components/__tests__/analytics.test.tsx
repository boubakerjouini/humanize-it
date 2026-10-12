import { renderToStaticMarkup } from "react-dom/server";
import { GoogleAnalytics } from "@/components/analytics/google-analytics";
import { AnalyticsOptOut } from "@/components/analytics/analytics-opt-out";

jest.mock("next/navigation", () => ({ usePathname: () => "/ai-detector" }));

// The analytics decision needs the browser (time zone, GPC, the /cookies
// choice), so nothing of it may reach the server-rendered HTML: a restricted
// visitor must never receive a gtag script tag.
describe("analytics components on the server", () => {
  it("renders no Google Analytics tag", () => {
    expect(renderToStaticMarkup(<GoogleAnalytics measurementId="G-TEST" />)).toBe("");
  });

  it("renders the /cookies control only after hydration", () => {
    expect(renderToStaticMarkup(<AnalyticsOptOut />)).toBe("");
  });
});
