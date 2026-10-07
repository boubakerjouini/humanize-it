// ===========================================================
// /extension/confirmed — Where the waitlist email's "Confirm my spot" button
// lands. The spot is confirmed by pressing the button here, never by loading
// the page (link scanners open it too). noindex.
// ===========================================================

import type { Metadata } from "next";
import Link from "next/link";
import { kitStyles } from "@/components/seo/page-kit";
import { ConfirmDownload } from "@/components/growth/confirm-download";
import { readConfirmState } from "@/app/free/_lib/confirm-state";
import { THEME } from "@/lib/theme";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Confirm your spot — HumanizeIt Chrome extension",
  robots: { index: false, follow: false },
};

type Props = { searchParams: Promise<{ t?: string | string[] }> };

export default async function ExtensionConfirmedPage({ searchParams }: Props) {
  const { t } = await searchParams;
  const state = await readConfirmState(t);
  const pending = state.pending.includes("extension_launch");
  const already = state.subscribed.includes("extension_launch");

  let heading = "Confirm your spot";
  let body = "Press the button to confirm. If you didn't join the waitlist, just close this page and you won't hear from us.";
  if (!state.token) {
    heading = "This link has expired";
    body = "Confirmation links work for 30 days. You can join the waitlist again in a few seconds.";
  } else if (!pending && already) {
    heading = "You're on the list";
    body = "Your spot is already confirmed. You'll hear from us when the extension is ready to install.";
  } else if (!pending) {
    heading = "Nothing to confirm";
    body = "There's no waitlist request to confirm for this link.";
  }

  return (
    <div style={{ maxWidth: "40rem", margin: "0 auto", padding: "56px 16px" }}>
      <div className="kicker" style={{ marginBottom: "14px" }}>
        Chrome extension waitlist
      </div>
      <h1 style={{ ...kitStyles.h1, fontSize: "clamp(26px, 4.5vw, 34px)" }}>{heading}</h1>
      <p style={kitStyles.p}>{body}</p>
      <ConfirmDownload
        token={state.token}
        canConfirm={pending}
        confirmLabel="Confirm my spot"
        confirmedMessage="You're on the list. Reply to our email with the one place you write most, and we'll make sure it works there first."
      />
      <p style={{ ...kitStyles.p, marginTop: "32px", fontSize: "14px" }}>
        {!state.token ? (
          <>
            <Link href="/extension" style={{ color: THEME.brandHi }}>
              Join the waitlist again
            </Link>
            {" · "}
          </>
        ) : null}
        Until launch, the{" "}
        <Link href="/ai-detector" style={{ color: THEME.brandHi }}>
          free AI detector
        </Link>{" "}
        runs the same kind of check.
      </p>
    </div>
  );
}
