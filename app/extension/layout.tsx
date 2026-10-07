// ===========================================================
// app/extension/layout.tsx — Marketing chrome for the Chrome extension
// waitlist (/extension) and its confirmation page.
// ===========================================================

import type { Metadata } from "next";
import { MarketingShell } from "@/components/marketing/marketing-shell";

export const metadata: Metadata = {
  metadataBase: new URL("https://humanizeit.app"),
};

export default function ExtensionLayout({ children }: { children: React.ReactNode }) {
  return <MarketingShell>{children}</MarketingShell>;
}
