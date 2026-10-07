// ===========================================================
// /free/confirmed — Generic double opt-in page (doi_confirm emails, the
// detector report's tips link, the Founding 100 list). Shows what is pending
// and a button; loading the page confirms nothing. noindex.
// ===========================================================

import type { Metadata } from "next";
import Link from "next/link";
import { kitStyles } from "@/components/seo/page-kit";
import { ConfirmDownload } from "@/components/growth/confirm-download";
import { readConfirmState } from "@/app/free/_lib/confirm-state";
import { TOPIC_LABELS } from "@/lib/growth/constants";
import { THEME } from "@/lib/theme";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Confirm your subscription — HumanizeIt",
  robots: { index: false, follow: false },
};

type Props = { searchParams: Promise<{ t?: string | string[] }> };

export default async function ConfirmedPage({ searchParams }: Props) {
  const { t } = await searchParams;
  const state = await readConfirmState(t);
  const pendingLabels = state.pending.map((topic) => TOPIC_LABELS[topic]);

  let heading = "Confirm your subscription";
  let body: string;
  if (!state.token) {
    heading = "This link has expired";
    body = "Confirmation links work for 30 days. If you still want our emails, sign up again from any free resource.";
  } else if (pendingLabels.length > 0) {
    body = `You asked for HumanizeIt ${pendingLabels.join(" and ")}. Press the button to confirm. If you didn't ask for this, just close this page and you won't hear from us.`;
  } else {
    heading = "Nothing left to confirm";
    body = "Your email preferences are already up to date. Every email has a one-click unsubscribe link.";
  }

  return (
    <div style={{ maxWidth: "40rem", margin: "0 auto", padding: "56px 16px" }}>
      <h1 style={{ ...kitStyles.h1, fontSize: "clamp(26px, 4.5vw, 34px)" }}>{heading}</h1>
      <p style={kitStyles.p}>{body}</p>
      <ConfirmDownload
        token={state.token}
        canConfirm={pendingLabels.length > 0}
        confirmLabel="Yes, confirm"
        confirmedMessage="Confirmed. Thank you. Every email has a one-click unsubscribe link."
      />
      <p style={{ ...kitStyles.p, marginTop: "32px", fontSize: "14px" }}>
        Meanwhile, the{" "}
        <Link href="/free" style={{ color: THEME.brandHi }}>
          free guides
        </Link>{" "}
        and the{" "}
        <Link href="/ai-detector" style={{ color: THEME.brandHi }}>
          free AI detector
        </Link>{" "}
        are always open.
      </p>
    </div>
  );
}
