import type { Metadata } from "next";

// Metadata-only wrapper. app/lifetime/page.tsx is a "use client" component and
// can't export metadata itself, so without this it inherited the root canonical
// (https://humanizeit.app) and self-canonicalized into a duplicate of the
// homepage. This gives /lifetime its own title + canonical. No visual change.
export const metadata: Metadata = {
  metadataBase: new URL("https://humanizeit.app"),
  title: "HumanizeIt Lifetime Deal — Pay Once, Humanize Forever",
  description:
    "Get lifetime access to HumanizeIt's AI humanizer for a single one-time payment. No monthly fees — bypass GPTZero, Turnitin & Originality.ai forever.",
  alternates: { canonical: "https://humanizeit.app/lifetime" },
  openGraph: {
    title: "HumanizeIt Lifetime Deal — Pay Once, Humanize Forever",
    description:
      "Lifetime access to HumanizeIt's AI humanizer with a one-time payment. No subscription, no monthly fees.",
    url: "https://humanizeit.app/lifetime",
    siteName: "HumanizeIt",
    type: "website",
  },
};

export default function LifetimeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
