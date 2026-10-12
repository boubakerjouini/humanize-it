// Share card for /free, the hub of the free PDF guides. The page's own
// openGraph has no images; this file is applied after it, so link previews
// get a card. Each guide page has its own in [slug]/opengraph-image.tsx.
import { ogCard, OG_CARD_SIZE } from "@/lib/seo/og-card";
import { MAGNET_LIST } from "@/lib/growth/magnets";

export const alt = "Free PDF guides from HumanizeIt for people who do their own writing";
export const size = OG_CARD_SIZE;
export const contentType = "image/png";

export default function Image() {
  return ogCard({
    eyebrow: `${MAGNET_LIST.length} free PDF guides`,
    title: "Free guides for honest writers",
    subtitle: "What to do if you're falsely flagged as AI, how detectors work, and a checklist for LinkedIn posts and cover letters.",
    cta: "Get a free guide",
  });
}
