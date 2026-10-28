// ===========================================================
// app/not-found.tsx — on-brand 404 for any unknown URL (marketing or app).
// ===========================================================

import type { Metadata } from "next";
import { ErrorState } from "@/components/workspace/error-state";

export const metadata: Metadata = { title: "Page not found | HumanizeIt", robots: { index: false } };

export default function NotFound() {
  return (
    <ErrorState
      code="404"
      title="This page doesn't exist"
      message="The link may be old or mistyped. Here are a few good places to go instead."
      actions={[
        { label: "Open the editor", href: "/dashboard", primary: true },
        { label: "Free AI detector", href: "/ai-detector" },
        { label: "Home", href: "/" },
      ]}
    />
  );
}
