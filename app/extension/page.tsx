// ===========================================================
// /extension — Chrome extension waitlist. The extension is not released, so
// the page says so plainly and offers the free web tools meanwhile. Joining is
// an explicit opt-in to launch updates (ext-v1 wording beside the button),
// confirmed by email before anything else is sent.
// ===========================================================

import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, FaqSection, kitStyles } from "@/components/seo/page-kit";
import { LeadCaptureForm } from "@/components/growth/lead-capture-form";
import { THEME } from "@/lib/theme";

const PAGE_URL = "https://humanizeit.app/extension";
const TITLE = "HumanizeIt Chrome Extension: Join the Waitlist";
const DESCRIPTION =
  "Check your writing where you write it: Gmail, Google Docs, LinkedIn and Notion. Not released yet. Join the waitlist for launch day.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION, url: PAGE_URL, siteName: "HumanizeIt", type: "website" },
  alternates: { canonical: PAGE_URL },
};

const PLACES = [
  { name: "Gmail", body: "Check an email before you send it, without copying it into another tab." },
  { name: "Google Docs", body: "See which passages read as formulaic while you draft." },
  { name: "LinkedIn", body: "Look over a post or a message for generic phrasing before it goes out." },
  { name: "Notion", body: "Check notes and docs where your team already writes." },
];

const FAQS = [
  {
    q: "When does the extension launch?",
    a: "There's no launch date yet. We'd rather ship it when it works than promise a date and miss it. The waitlist gets one email on launch day, plus a few short updates before it.",
  },
  {
    q: "Will it cost anything?",
    a: "Pricing isn't final. The free web tools stay free, and the waitlist email will say exactly what the extension costs before you install anything.",
  },
  {
    q: "What can I use today?",
    a: "The free AI detector and the free humanizer on this site do the same kind of check in your browser tab. No signup needed.",
  },
];

export default function ExtensionWaitlistPage() {
  return (
    <div style={{ maxWidth: "48rem", margin: "0 auto", padding: "40px 16px" }}>
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Chrome extension" }]} />
      <div className="kicker" style={{ marginBottom: "14px" }}>
        Coming soon · not released yet
      </div>
      <h1 style={kitStyles.h1}>Check your writing right where you write it</h1>
      <p style={{ ...kitStyles.p, fontSize: "17px" }}>
        We&apos;re building a HumanizeIt extension for Chrome. The goal is simple: see which sentences read as
        formulaic, and fix them in your own words, without copying text into another tab. It isn&apos;t released yet.
        Join the waitlist and you&apos;ll hear from us when it&apos;s ready to install.
      </p>

      <LeadCaptureForm source="extension_waitlist" requiredTopic="extension_launch" ctaLabel="Notify me at launch" />

      <h2 style={kitStyles.h2}>Where we want it to work</h2>
      <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))" }}>
        {PLACES.map((p) => (
          <div key={p.name} style={{ background: THEME.surface1, border: `1px solid ${THEME.border}`, borderRadius: THEME.radius, padding: "16px" }}>
            <div style={{ fontSize: "15px", fontWeight: 700, color: THEME.text, marginBottom: "4px" }}>{p.name}</div>
            <div style={{ fontSize: "14px", color: THEME.textDim, lineHeight: 1.6 }}>{p.body}</div>
          </div>
        ))}
      </div>
      <p style={{ ...kitStyles.p, marginTop: "16px" }}>
        Where do you write most? Reply to the confirmation email with one word, and we&apos;ll make sure it works there
        first.
      </p>

      <h2 style={kitStyles.h2}>Until then</h2>
      <p style={kitStyles.p}>
        The{" "}
        <Link href="/ai-detector" style={{ color: THEME.brandHi }}>
          free AI detector
        </Link>{" "}
        runs the same kind of check in your browser, and the{" "}
        <Link href="/free" style={{ color: THEME.brandHi }}>
          free guides
        </Link>{" "}
        explain what detectors look for.
      </p>

      <FaqSection faqs={FAQS} />
    </div>
  );
}
