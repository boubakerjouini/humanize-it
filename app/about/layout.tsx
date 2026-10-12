// ===========================================================
// app/about/layout.tsx — Marketing chrome for the About page.
// ===========================================================

import type { Metadata } from "next";
import { MarketingShell } from "@/components/marketing/marketing-shell";

export const metadata: Metadata = {
  metadataBase: new URL("https://humanizeit.app"),
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return <MarketingShell>{children}</MarketingShell>;
}
