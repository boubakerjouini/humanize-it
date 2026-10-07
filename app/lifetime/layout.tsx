import type { Metadata } from "next";

// Metadata-only wrapper for /lifetime (kept as the URL: it is linked from the
// home page, the footer and the sitemap). The page now sells Founding 100,
// two years of Pro paid once, instead of a lifetime deal.
export const metadata: Metadata = {
  metadataBase: new URL("https://humanizeit.app"),
  title: "Founding 100 — Two Years of HumanizeIt Pro for $99",
  description:
    "Back HumanizeIt early: two years of Pro for $99, paid once. Only 100 spots, a live counter, and a 14-day full refund. No lifetime deal, no auto-renewal.",
  alternates: { canonical: "https://humanizeit.app/lifetime" },
  openGraph: {
    title: "Founding 100 — Two Years of HumanizeIt Pro for $99",
    description: "Two years of Pro for $99, paid once. 100 spots, then it closes for good.",
    url: "https://humanizeit.app/lifetime",
    siteName: "HumanizeIt",
    type: "website",
  },
};

export default function LifetimeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
