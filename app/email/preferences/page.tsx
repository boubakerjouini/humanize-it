// ===========================================================
// /email/preferences?t=<prefs token>[&u=1] — Email preference center.
//
// Reached from every lifecycle and marketing footer ("Unsubscribe" adds u=1,
// which highlights the unsubscribe button) and from the one-click URL opened
// in a browser. Loading the page changes nothing; the form posts to
// /api/email/preferences. noindex.
// ===========================================================

import type { Metadata } from "next";
import Link from "next/link";
import { contactFromPrefsToken, loadPreferences } from "@/lib/email/preferences";
import { THEME } from "@/lib/theme";
import { PreferencesForm } from "./preferences-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Email preferences — HumanizeIt",
  robots: { index: false, follow: false },
};

type Props = { searchParams: Promise<{ t?: string | string[]; u?: string | string[] }> };

const card = {
  background: THEME.surface2,
  border: `1px solid ${THEME.border}`,
  borderRadius: THEME.radiusLg,
  padding: "24px 22px",
} as const;

function Message({ title, body }: { title: string; body: React.ReactNode }) {
  return (
    <div style={card}>
      <h1 style={{ fontFamily: THEME.fontHeading, fontSize: 22, fontWeight: 700, margin: "0 0 8px", letterSpacing: "-0.01em" }}>{title}</h1>
      <p style={{ fontSize: 15, lineHeight: 1.6, color: THEME.textDim, margin: 0 }}>{body}</p>
    </div>
  );
}

export default async function EmailPreferencesPage({ searchParams }: Props) {
  const params = await searchParams;
  const token = typeof params.t === "string" ? params.t : null;
  const highlightUnsubscribe = params.u === "1";
  const owner = contactFromPrefsToken(token);
  const preferences = owner ? await loadPreferences(owner.contactId).catch(() => null) : null;

  if (!token || !owner || !preferences) {
    return (
      <Message
        title={owner ? "We no longer have this address" : "This link doesn't work"}
        body={
          <>
            {owner
              ? "There is nothing left to unsubscribe: this address isn't on any of our lists."
              : "Open the preferences link from a recent HumanizeIt email. If you have an account, you can also manage emails in "}
            {owner ? null : (
              <Link href="/dashboard/settings" style={{ color: THEME.brandHi }}>
                Settings
              </Link>
            )}
            {owner ? null : "."}
          </>
        }
      />
    );
  }

  return <PreferencesForm token={token} initial={preferences} highlightUnsubscribe={highlightUnsubscribe} />;
}
