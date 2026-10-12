// Share card for each /free/<slug> guide, titled with the guide's name. The
// page's generateMetadata sets openGraph without images; this file is applied
// after it, so link previews get the card. Prerendered per guide, like the
// pages themselves.
import { notFound } from "next/navigation";
import { ogCard, OG_CARD_SIZE } from "@/lib/seo/og-card";
import { MAGNET_LIST, getMagnet } from "@/lib/growth/magnets";

export const alt = "A free PDF guide from HumanizeIt";
export const size = OG_CARD_SIZE;
export const contentType = "image/png";

export function generateStaticParams() {
  return MAGNET_LIST.map((m) => ({ slug: m.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const magnet = getMagnet(slug);
  if (!magnet) notFound();
  return ogCard({
    eyebrow: `Free ${magnet.noun} · ${magnet.pages} pages · PDF`,
    title: magnet.title,
    subtitle: magnet.promise,
    cta: `Get the free ${magnet.noun}`,
  });
}
