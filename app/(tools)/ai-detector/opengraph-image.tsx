// Share card for /ai-detector. The page's own openGraph has no images, which
// drops the root card; an image file beside the page is applied after the
// page's metadata, so link previews (LinkedIn, WhatsApp, Facebook) get this.
import { ogCard, OG_CARD_SIZE } from "@/lib/seo/og-card";
import { PATTERN_COUNT } from "@/lib/algorithms/patterns";

export const alt = "HumanizeIt free AI detector: see which AI-writing patterns your text triggers, and why";
export const size = OG_CARD_SIZE;
export const contentType = "image/png";

export default function Image() {
  return ogCard({
    eyebrow: "Free tool · No signup",
    title: "Free AI Detector",
    subtitle: `See which of ${PATTERN_COUNT} AI-writing patterns your text trips, and why. The instant check runs in your browser.`,
    cta: "Analyze My Text",
  });
}
