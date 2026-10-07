// ===========================================================
// /lifetime — Founding 100 (replaces the old mailto "lifetime deal" tiers)
//
// Two years of Pro for $99, paid once, hard cap of 100 buyers. The counter is
// read from the database on every request (app/api/offers/shared.ts) and the
// CTA closes for good at 100. Until the LemonSqueezy product exists, the CTA
// is a waitlist. Copy rule: real scarcity only, no detector promises.
// ===========================================================

import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { Check, ShieldCheck } from "lucide-react";
import { THEME } from "@/lib/theme";
import { FOUNDING, GUARANTEE_DAYS, PLANS, PRO_ANNUAL_VOICE_PROFILES } from "@/lib/plans";
import { foundingStatus } from "@/app/api/offers/shared";
import { FoundingCta, type FoundingCtaState } from "@/components/growth/founding-cta";

export const dynamic = "force-dynamic";

const PRO = PLANS.PRO;
const years = FOUNDING.months / 12;
const yearsWord = years === 2 ? "Two" : String(years);
const fmtInt = (n: number) => n.toLocaleString("en-US");

const INCLUDED = [
  `Everything in Pro for ${FOUNDING.months} months: ${fmtInt(PRO.wordsLimit)} words a month, unlimited rewrites, all ${PRO.toneOptions} tones`,
  `Voice Match with ${PRO_ANNUAL_VOICE_PROFILES} voices (the annual-plan allowance)`,
  `PDF and Word upload, the Before/After Report, ${PRO.historyDays}-day history and API access`,
  "A founding member badge on your account",
  "A vote on what I build next",
];

const FAQ: { q: string; a: string }[] = [
  {
    q: "Why not a lifetime deal?",
    a: "Every rewrite has a real cost for us, for as long as you use it. A \"forever\" price would be a promise we couldn't keep honestly, so this one has an end date: two years.",
  },
  {
    q: "What happens after the two years?",
    a: "Nothing is charged automatically. Your account goes back to the Free plan unless you choose a regular Pro plan before then.",
  },
  {
    q: "I already pay for Pro or Team. Can I switch?",
    a: "Yes, but by hand so you don't pay twice: email support@humanizeit.app before you buy and we'll sort it out.",
  },
  {
    q: "Will it get my text past Turnitin or GPTZero?",
    a: "We can't promise that, and we don't. Detectors all work differently and change often. HumanizeIt shows you which patterns make text read as AI and helps you rewrite them in your own voice.",
  },
];

async function isSignedIn(): Promise<boolean> {
  try {
    return !!(await auth()).userId;
  } catch {
    return false;
  }
}

export default async function FoundingPage() {
  const [status, signedIn] = await Promise.all([foundingStatus(), isSignedIn()]);
  const state: FoundingCtaState = !status.configured ? "waitlist" : status.open ? "open" : "closed";

  return (
    <div style={{ background: THEME.bg, minHeight: "100vh", color: THEME.text, fontFamily: THEME.fontSans }}>
      {/* Navbar */}
      <nav style={{ height: "56px", display: "flex", alignItems: "center", borderBottom: `1px solid ${THEME.border}`, background: THEME.surface1 }}>
        <div style={{ maxWidth: "1140px", margin: "0 auto", padding: "0 24px", width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: "7px", textDecoration: "none" }}>
            <span style={{ fontSize: "19px", fontWeight: 800, color: THEME.brand, letterSpacing: "-0.5px", lineHeight: 1, fontFamily: THEME.fontHeading }}>H.</span>
            <span style={{ fontSize: "14px", fontWeight: 600, color: THEME.text, fontFamily: THEME.fontHeading }}>Humanize<span style={{ color: THEME.brandHi }}>It</span></span>
          </Link>
          <Link href="/" style={{ fontSize: "13px", color: THEME.textDim, textDecoration: "none" }}>&larr; Back to home</Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ padding: "64px 16px 24px", textAlign: "center" }}>
        <div style={{ maxWidth: "680px", margin: "0 auto" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: THEME.accentDim, border: `1px solid ${THEME.accent}44`, borderRadius: "100px", padding: "6px 16px", marginBottom: "22px", fontSize: "13px", color: THEME.accentHi, fontWeight: 700 }}>
            {state === "closed" ? `Founding ${FOUNDING.seats} is closed` : `Founding ${FOUNDING.seats}`}
          </div>
          <h1 style={{ fontSize: "clamp(30px, 5vw, 50px)", fontWeight: 800, letterSpacing: "-0.03em", color: THEME.text, margin: "0 0 18px", fontFamily: THEME.fontHeading, lineHeight: 1.1 }}>
            {yearsWord} years of Pro for <span className="text-gradient">${FOUNDING.priceUsd}</span>, once.
          </h1>
          <p style={{ fontSize: "17px", color: THEME.textDim, lineHeight: 1.7, margin: "0 auto 26px", maxWidth: "580px" }}>
            I&apos;m Boubaker, and I build HumanizeIt alone, after my day job. Before the product has a big name, I&apos;m looking for {FOUNDING.seats} people to back it. You get everything in Pro for {FOUNDING.months} months, a founding badge and a vote on what I build next.
          </p>

          {status.left !== null && state !== "waitlist" && (
            <div style={{ marginBottom: "26px" }}>
              <div className="tnum" style={{ fontSize: "15px", fontWeight: 700, color: THEME.text, marginBottom: "8px" }}>
                {status.left > 0 ? `${status.left} of ${FOUNDING.seats} left` : `0 of ${FOUNDING.seats} left`}
              </div>
              <div role="progressbar" aria-valuemin={0} aria-valuemax={FOUNDING.seats} aria-valuenow={FOUNDING.seats - status.left} aria-label="Founding spots taken"
                style={{ height: "8px", maxWidth: "360px", margin: "0 auto", background: THEME.surface3, borderRadius: "999px", overflow: "hidden" }}>
                <div style={{ height: "8px", width: `${Math.round(((FOUNDING.seats - status.left) / FOUNDING.seats) * 100)}%`, background: THEME.gradient }} />
              </div>
              {status.left > 0 && <p style={{ fontSize: "12px", color: THEME.textMuted, margin: "8px 0 0" }}>When they&apos;re gone, this offer closes for good.</p>}
            </div>
          )}
          {state === "waitlist" && (
            <p style={{ fontSize: "13px", color: THEME.textMuted, margin: "0 0 18px" }}>{`Limited to ${FOUNDING.seats} people. When they're gone, this offer closes for good.`}</p>
          )}

          <FoundingCta state={state} signedIn={signedIn} />
        </div>
      </section>

      {/* What you get */}
      <section style={{ padding: "32px 16px" }}>
        <div className="panel" style={{ maxWidth: "640px", margin: "0 auto", borderRadius: THEME.radiusXl, padding: "28px 24px" }}>
          <h2 style={{ fontSize: "20px", fontWeight: 700, margin: "0 0 16px", fontFamily: THEME.fontHeading }}>What founding members get</h2>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "11px" }}>
            {INCLUDED.map((f) => (
              <li key={f} style={{ display: "flex", alignItems: "flex-start", gap: "10px", fontSize: "14px", color: THEME.textDim, lineHeight: 1.5 }}>
                <Check size={16} color={THEME.human} aria-hidden="true" style={{ flexShrink: 0, marginTop: "2px" }} />
                {f}
              </li>
            ))}
          </ul>
          <p style={{ fontSize: "13px", color: THEME.textMuted, margin: "18px 0 0", lineHeight: 1.6 }}>
            {`Two years of Pro on the annual plan costs $${(PRO.priceAnnual ?? 0) * years}. Founding ${FOUNDING.seats} is cheaper because you pay up front, before the product has any proof. That's the honest trade.`}
          </p>
        </div>
      </section>

      {/* Guarantee */}
      <section style={{ padding: "8px 16px 32px" }}>
        <div style={{ maxWidth: "640px", margin: "0 auto", display: "flex", gap: "14px", alignItems: "flex-start", background: THEME.humanDim, border: `1px solid ${THEME.human}33`, borderRadius: THEME.radiusLg, padding: "18px 20px" }}>
          <ShieldCheck size={22} color={THEME.human} aria-hidden="true" style={{ flexShrink: 0, marginTop: "2px" }} />
          <p style={{ margin: 0, fontSize: "14px", color: THEME.text, lineHeight: 1.65 }}>
            <strong>{GUARANTEE_DAYS}-day full refund if it&apos;s not for you.</strong> Email support@humanizeit.app within {GUARANTEE_DAYS} days. We never promise a score on someone else&apos;s AI detector; nobody honest can.{" "}
            <Link href="/refunds" style={{ color: THEME.brandHi, fontWeight: 600, textDecoration: "none" }}>Refund policy</Link>
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ padding: "8px 16px 64px" }}>
        <div style={{ maxWidth: "640px", margin: "0 auto" }}>
          <h2 style={{ fontSize: "20px", fontWeight: 700, margin: "0 0 14px", fontFamily: THEME.fontHeading }}>Questions</h2>
          {FAQ.map(({ q, a }) => (
            <div key={q} style={{ borderTop: `1px solid ${THEME.border}`, padding: "14px 0" }}>
              <h3 style={{ fontSize: "15px", fontWeight: 600, margin: "0 0 6px", color: THEME.text }}>{q}</h3>
              <p style={{ fontSize: "14px", color: THEME.textDim, margin: 0, lineHeight: 1.65 }}>{a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: `1px solid ${THEME.border}`, padding: "24px", textAlign: "center" }}>
        <p style={{ fontSize: "12px", color: THEME.textDim }}>
          &copy; 2026 HumanizeIt &middot;{" "}
          <Link href="/" style={{ color: THEME.textDim, textDecoration: "none" }}>Home</Link> &middot;{" "}
          <Link href="/refunds" style={{ color: THEME.textDim, textDecoration: "none" }}>Refunds</Link> &middot;{" "}
          <Link href="/privacy" style={{ color: THEME.textDim, textDecoration: "none" }}>Privacy</Link> &middot;{" "}
          <Link href="/terms" style={{ color: THEME.textDim, textDecoration: "none" }}>Terms</Link>
        </p>
      </footer>
    </div>
  );
}
