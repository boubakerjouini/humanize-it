// ===========================================================
// Workspace error boundary: keeps the sidebar and nav on screen and offers
// Try again, instead of dropping the user onto a bare full-page error.
// ===========================================================

"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/workspace/error-state";

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <ErrorState
      inShell
      title="This part of the app didn't load"
      message={`Your documents and words are safe. Try again; if it keeps happening, email support@humanizeit.app${error.digest ? ` and mention code ${error.digest}` : ""}.`}
      actions={[
        { label: "Try again", onClick: reset, primary: true },
        { label: "Back to the editor", href: "/dashboard" },
      ]}
    />
  );
}
