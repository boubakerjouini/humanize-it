// ===========================================================
// app/free/layout.tsx — Marketing chrome for the free lead magnets (/free,
// /free/<slug>, thanks and confirmation pages).
// ===========================================================

import type { Metadata } from "next";
import { MarketingShell } from "@/components/marketing/marketing-shell";

export const metadata: Metadata = {
  metadataBase: new URL("https://humanizeit.app"),
};

export default function FreeLayout({ children }: { children: React.ReactNode }) {
  return <MarketingShell>{children}</MarketingShell>;
}
