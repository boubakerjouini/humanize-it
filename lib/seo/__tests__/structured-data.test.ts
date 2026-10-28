// Structured data on the free tool pages. They must carry a BreadcrumbList
// (through the page-kit Breadcrumbs) and never a rating or review we cannot
// back with real data: Google treats invented ratings as spam markup.
import fs from "fs";
import path from "path";

const ROOT = path.join(__dirname, "..", "..", "..");
const TOOLS = ["ai-detector", "free-ai-humanizer", "gptzero-checker"];

function sources(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "generated" && entry.name !== "__tests__" && !entry.name.startsWith(".")) out.push(...sources(full));
    } else if (/\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

describe("tool page structured data", () => {
  it.each(TOOLS)("renders the page-kit Breadcrumbs on /%s", (tool) => {
    const src = fs.readFileSync(path.join(ROOT, "app", "(tools)", tool, "page.tsx"), "utf8");
    expect(src).toMatch(/<Breadcrumbs\s+items=/);
    expect(src).not.toMatch(/<nav aria-label="Breadcrumb"/);
  });

  it("gives every tool page its own share card", () => {
    for (const tool of TOOLS) {
      expect(fs.existsSync(path.join(ROOT, "app", "(tools)", tool, "opengraph-image.tsx"))).toBe(true);
    }
  });

  it("never emits AggregateRating or Review markup", () => {
    const files = ["app", "components", path.join("lib", "seo")].flatMap((d) => sources(path.join(ROOT, d)));
    // Matches markup keys and types, not prose (app/compare mentions the type in a comment).
    const markup = /"@type":\s*"(AggregateRating|Review)"|(aggregateRating|ratingValue|reviewRating)\s*:/;
    const hits = files.filter((f) => markup.test(fs.readFileSync(f, "utf8")));
    expect(hits.map((f) => path.relative(ROOT, f))).toEqual([]);
  });
});
