import { test, expect, type ConsoleMessage } from "@playwright/test";

// Smoke checks for the public pages (CI job "smoke", .github/workflows/ci.yml).
// Each page answers 200, has exactly one h1 and logs no console error. The
// detector's instant check runs in the browser, so it is exercised for real.
// Nothing here calls a model or signs anyone up; the instant check records one
// anonymous ToolRun row in whatever database the server uses.

const PAGES = ["/", "/ai-detector", "/free-ai-humanizer", "/pricing", "/compare", "/sign-up"];

// Noise that is not the app's: Clerk's development-instance notice, and
// network failures for third-party hosts a CI runner can't reach.
const IGNORED = [/development keys/i, /net::ERR_/];

function collectErrors(page: import("@playwright/test").Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg: ConsoleMessage) => {
    if (msg.type() === "error" && !IGNORED.some((re) => re.test(msg.text()))) errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(err.message));
  return errors;
}

for (const path of PAGES) {
  test(`${path} loads with one h1 and no console errors`, async ({ page }) => {
    const errors = collectErrors(page);
    const res = await page.goto(path, { waitUntil: "domcontentloaded" });
    expect(res?.status()).toBe(200);
    // Clerk renders its own heading on /sign-up after it loads.
    await expect(page.locator("h1").first()).toBeVisible({ timeout: 15_000 });
    await page.waitForLoadState("load");
    await expect(page.locator("h1")).toHaveCount(1);
    expect(errors).toEqual([]);
  });
}

test("the AI detector's instant check scores pasted text", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/ai-detector", { waitUntil: "domcontentloaded" });
  const sample =
    "Artificial intelligence represents a transformative paradigm shift in technological advancement. " +
    "Furthermore, it is important to note that these sophisticated systems leverage vast amounts of training data " +
    "to optimize performance metrics and achieve superior outcomes across diverse application domains. " +
    "In conclusion, the implementation of AI solutions facilitates streamlined workflows and enhanced productivity.";
  await page.getByLabel("Text to analyze for AI patterns").fill(sample);
  await page.getByRole("button", { name: "Check for AI" }).click();
  await expect(page.getByText(/Instant check · AI-likelihood \d+\/100/)).toBeVisible({ timeout: 10_000 });
  expect(errors).toEqual([]);
});
