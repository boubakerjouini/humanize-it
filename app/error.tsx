// ===========================================================
// app/error.tsx — on-brand error boundary for any page under the root
// layout. Never shows the raw error: only a digest the user can quote.
// ===========================================================

"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/workspace/error-state";

export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <ErrorState
      title="Something went wrong on our side"
      message={`This page hit an unexpected error. Try again; if it keeps happening, email support@humanizeit.app${error.digest ? ` and mention code ${error.digest}` : ""}.`}
      actions={[
        { label: "Try again", onClick: reset, primary: true },
        { label: "Home", href: "/" },
      ]}
    />
  );
}
