// Share images. A page-level openGraph replaces the root one whole, so a page
// that sets openGraph without images ships no og:image and its LinkedIn,
// WhatsApp and Facebook previews lose the picture. Every such page must list
// OG_IMAGES or have an opengraph-image.tsx beside it.
import fs from "fs";
import path from "path";
import { OG_IMAGES } from "@/lib/seo/og";
import { ogTitleSize } from "@/lib/seo/og-card";
import { MAGNET_LIST } from "@/lib/growth/magnets";

const APP = path.join(__dirname, "..", "..", "..", "app");
// Signed-in, admin and API areas are never shared as links.
const SKIP = new Set(["generated", "api", "(admin)", "(dashboard)"]);

function metadataFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP.has(entry.name) && !entry.name.startsWith(".")) files.push(...metadataFiles(full));
    } else if (/^(page|layout)\.tsx$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

describe("share images", () => {
  it("points pages without their own card at the root 1200x630 card", () => {
    expect(OG_IMAGES).toEqual([expect.objectContaining({ url: "/opengraph-image", width: 1200, height: 630 })]);
    expect(fs.existsSync(path.join(APP, "opengraph-image.tsx"))).toBe(true);
  });

  it("gives every page-level openGraph an image", () => {
    const files = metadataFiles(APP);
    expect(files.length).toBeGreaterThan(40);
    const missing = files.filter((file) => {
      const src = fs.readFileSync(file, "utf8");
      if (!/\bopenGraph\s*:/.test(src)) return false;
      const hasCardBeside = fs.existsSync(path.join(path.dirname(file), "opengraph-image.tsx"));
      return !hasCardBeside && !src.includes("OG_IMAGES");
    });
    expect(missing.map((f) => path.relative(APP, f))).toEqual([]);
  });

  it("keeps every guide title within the card's two-line headline", () => {
    for (const m of MAGNET_LIST) expect(m.title.length).toBeLessThanOrEqual(50);
    expect(ogTitleSize("Free AI Detector")).toBe(76);
    expect(ogTitleSize("The LinkedIn & Cover Letter Humanizing Checklist")).toBe(56);
  });
});
