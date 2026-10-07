// ===========================================================
// /free/[slug]/thanks — Where the magnet email's button lands. Shows the PDF
// download unconditionally (it's public anyway) and, when the person ticked
// the tips box, a "Yes, send me tips" button. Loading this page confirms
// nothing: email link scanners open it too. noindex.
// ===========================================================

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { kitStyles } from "@/components/seo/page-kit";
import { ConfirmDownload } from "@/components/growth/confirm-download";
import { MagnetCover } from "@/components/growth/magnet-cover";
import { readConfirmState } from "@/app/free/_lib/confirm-state";
import { getMagnet, magnetPdfPath } from "@/lib/growth/magnets";
import { THEME } from "@/lib/theme";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your download — HumanizeIt",
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ t?: string | string[] }> };

export default async function MagnetThanksPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const magnet = getMagnet(slug);
  if (!magnet) notFound();
  const { t } = await searchParams;
  const state = await readConfirmState(t);
  const tipsPending = state.pending.includes("tips");
  const tipsOn = state.subscribed.includes("tips");

  return (
    <div style={{ maxWidth: "44rem", margin: "0 auto", padding: "48px 16px" }}>
      <div style={{ display: "flex", gap: "28px", alignItems: "center", flexWrap: "wrap" }}>
        <MagnetCover magnet={magnet} size="sm" />
        <div style={{ flex: "1 1 260px" }}>
          <div className="kicker" style={{ marginBottom: "12px" }}>
            Your free {magnet.noun}
          </div>
          <h1 style={{ ...kitStyles.h1, fontSize: "clamp(26px, 4.5vw, 34px)" }}>{magnet.title}</h1>
        </div>
      </div>

      <p style={{ ...kitStyles.p, marginTop: "24px" }}>{`Start with ${magnet.firstSection}. It takes two minutes and covers the part people need most.`}</p>

      <ConfirmDownload
        token={state.token}
        canConfirm={tipsPending}
        downloadUrl={magnetPdfPath(magnet.slug)}
        confirmPrompt="You asked for writing tips when you downloaded this. Want them? Nothing is sent until you click."
        confirmLabel="Yes, send me tips"
        confirmedMessage="Done. You'll get a few short tips by email, and every one has a one-click unsubscribe."
      />
      {tipsOn && !tipsPending ? (
        <p style={{ ...kitStyles.p, fontSize: "14px", marginTop: "14px" }}>You&apos;re already subscribed to the tips.</p>
      ) : null}

      <section
        style={{ marginTop: "40px", border: `1px solid ${THEME.border}`, borderRadius: THEME.radiusLg, background: THEME.surface1, padding: "24px" }}
      >
        <h2 style={{ ...kitStyles.h2, marginTop: 0, fontSize: "20px" }}>Next: {magnet.nextStep.label.toLowerCase()}</h2>
        <p style={kitStyles.p}>{magnet.nextStep.body}</p>
        <Link
          href={magnet.nextStep.href}
          style={{ display: "inline-block", background: THEME.brand, color: "#fff", fontWeight: 700, fontSize: "14px", padding: "10px 22px", borderRadius: THEME.radius, textDecoration: "none" }}
        >
          {magnet.nextStep.label} &rarr;
        </Link>
        <p style={{ ...kitStyles.p, fontSize: "14px", margin: "14px 0 0" }}>
          Want to check and rewrite in one place?{" "}
          <Link href="/sign-up" style={{ color: THEME.brandHi }}>
            A free account
          </Link>{" "}
          gives you 500 words a day, no card needed.
        </p>
      </section>
    </div>
  );
}
