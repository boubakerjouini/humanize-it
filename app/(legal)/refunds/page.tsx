// ===========================================================
// /refunds — Refund policy: the one "Sounds Like You" guarantee used
// everywhere (home FAQ, pricing, plan menu, /lifetime). Days and prices come
// from lib/plans.ts so this page can't disagree with the rest of the site.
// ===========================================================

import { THEME } from "@/lib/theme";
import { FOUNDING, GUARANTEE_DAYS, PLANS, TEAM_ANNUAL_GUARANTEE_DAYS } from "@/lib/plans";

export const metadata = {
  title: 'Refund Policy — HumanizeIt',
  description:
    `HumanizeIt's refund policy: a ${GUARANTEE_DAYS}-day "Sounds Like You" guarantee on every paid plan, monthly or annual, how to ask for a refund, and what we never promise.`,
  alternates: { canonical: 'https://humanizeit.app/refunds' },
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section style={{ marginBottom: '40px' }}>
    <h2 style={{ fontSize: '20px', fontWeight: 600, color: THEME.text, marginBottom: '12px', borderBottom: `1px solid ${THEME.border}`, paddingBottom: '8px', fontFamily: THEME.fontHeading }}>{title}</h2>
    <div style={{ color: THEME.textDim, lineHeight: 1.8, fontSize: '15px' }}>{children}</div>
  </section>
)

const strong = { color: THEME.text }
const li = { marginBottom: '8px' }

export default function RefundsPage() {
  const { PRO, TEAM } = PLANS
  return (
    <>
      <div style={{ marginBottom: '48px' }}>
        <h1 style={{ fontSize: '36px', fontWeight: 700, color: THEME.text, marginBottom: '8px', fontFamily: THEME.fontHeading, letterSpacing: '-0.02em' }}>Refund Policy</h1>
        <p style={{ color: THEME.textDim, fontSize: '14px' }}>Last updated: October 7, 2026</p>
      </div>

      <div style={{ background: THEME.brandDim, border: `1px solid ${THEME.brand}`, borderRadius: THEME.radiusLg, padding: '20px 24px', marginBottom: '40px', color: THEME.text, fontSize: '15px', lineHeight: 1.7 }}>
        <strong>The {GUARANTEE_DAYS}-day &ldquo;Sounds Like You&rdquo; guarantee.</strong> Try Pro or Team for {GUARANTEE_DAYS} days. If HumanizeIt doesn&apos;t make your writing clearer and more like you, email <strong style={{ color: THEME.brandHi }}>support@humanizeit.app</strong> and we&apos;ll refund you in full, monthly or annual. No forms.
      </div>

      <Section title={`1. Every paid plan: ${GUARANTEE_DAYS} days`}>
        <p>Pro (${PRO.price} a month or ${PRO.priceAnnual} a year) and Team (${TEAM.price} a month or ${TEAM.priceAnnual} a year) are covered for <strong style={strong}>{GUARANTEE_DAYS} days</strong> from the date you first pay for the plan. Ask within that window and we refund that payment in full. You don&apos;t have to give a reason, though we&apos;d like to hear it.</p>
      </Section>

      <Section title={`2. Team annual: ${TEAM_ANNUAL_GUARANTEE_DAYS} days`}>
        <p>Team annual gets <strong style={strong}>{TEAM_ANNUAL_GUARANTEE_DAYS} days</strong> instead of {GUARANTEE_DAYS}, so your team can run a full month of real work before deciding.</p>
      </Section>

      <Section title={`3. Founding ${FOUNDING.seats} and word packs`}>
        <ul style={{ paddingLeft: '20px' }}>
          <li style={li}><strong style={strong}>Founding {FOUNDING.seats}</strong> (${FOUNDING.priceUsd} once for {FOUNDING.months} months of Pro): the same {GUARANTEE_DAYS}-day full refund. The founding Pro time comes off your account, which goes back to the plan it had before (for most people, Free).</li>
          <li style={li}><strong style={strong}>Word packs</strong>: refunded in full within {GUARANTEE_DAYS} days if you haven&apos;t used any of the words. The pack&apos;s words come off your balance.</li>
        </ul>
      </Section>

      <Section title="4. After the guarantee">
        <p>You can cancel any plan at any time from your account settings. A monthly plan stays active until the end of the month you paid for, and an annual plan until the end of its year. We don&apos;t give partial refunds for unused time after the guarantee period.</p>
      </Section>

      <Section title="5. Always refunded">
        <ul style={{ paddingLeft: '20px' }}>
          <li style={li}>Duplicate charges or billing errors</li>
          <li style={li}>Charges after a confirmed cancellation</li>
          <li style={li}>Technical issues that prevented you from using the service for more than 48 hours</li>
        </ul>
      </Section>

      <Section title="6. What we never promise">
        <p>We never promise a score on someone else&apos;s AI detector, such as Turnitin or GPTZero. They all work differently and change often, and no honest tool can guarantee their results. The guarantee is about whether HumanizeIt helps your writing, not about any detector.</p>
      </Section>

      <Section title="7. How to ask for a refund">
        <ol style={{ paddingLeft: '20px' }}>
          <li style={li}>Email <strong style={strong}>support@humanizeit.app</strong> from the address on your account</li>
          <li style={li}>Include your order number (it&apos;s in your receipt email from Lemon Squeezy)</li>
          <li style={li}>A reason is optional within the guarantee period</li>
        </ol>
        <p style={{ marginTop: '12px' }}>We reply within 3–5 business days. Refunds go through Lemon Squeezy, our payment provider, back to your original payment method.</p>
      </Section>

      <Section title="8. Free plan">
        <p>The Free plan is free: no payment, so nothing to refund.</p>
      </Section>

      <Section title="9. Contact">
        <p><strong style={strong}>support@humanizeit.app</strong>. We read every email.</p>
      </Section>
    </>
  )
}
