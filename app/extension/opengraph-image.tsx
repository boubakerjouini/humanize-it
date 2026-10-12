// Share card for /extension (the waitlist). The page's own openGraph has no
// images; this file is applied after it, so link previews get a card. The
// extension isn't released, and the card says so.
import { ogCard, OG_CARD_SIZE } from "@/lib/seo/og-card";

export const alt = "HumanizeIt Chrome extension waitlist: check your writing right where you write it";
export const size = OG_CARD_SIZE;
export const contentType = "image/png";

export default function Image() {
  return ogCard({
    eyebrow: "Chrome extension · Not released yet",
    title: "Check your writing right where you write it",
    subtitle: "Planned for Gmail, Google Docs, LinkedIn and Notion. Join the waitlist to hear on launch day.",
    cta: "Join the waitlist",
  });
}
