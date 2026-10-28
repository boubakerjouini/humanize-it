// Share card for /gptzero-checker. Without it the page fell back to the root
// card, so a shared link previewed as the generic homepage instead of the tool.
// An image file beside the page is applied after the page's metadata.
import { ogCard, OG_CARD_SIZE } from "@/lib/seo/og-card";

export const alt = "HumanizeIt free GPTZero checker: estimate perplexity and burstiness before you submit";
export const size = OG_CARD_SIZE;
export const contentType = "image/png";

export default function Image() {
  return ogCard({
    eyebrow: "Free tool · No signup",
    title: "Free GPTZero Checker",
    subtitle: "Estimate the perplexity and burstiness signals GPTZero looks for. An independent checker, not GPTZero itself.",
    cta: "Check My Text",
  });
}
