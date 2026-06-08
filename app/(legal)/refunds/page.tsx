import { THEME } from "@/lib/theme";

export const metadata = { title: 'Refund Policy — HumanizeIt' }

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section style={{ marginBottom: '40px' }}>
    <h2 style={{ fontSize: '20px', fontWeight: 600, color: THEME.text, marginBottom: '12px', borderBottom: `1px solid ${THEME.border}`, paddingBottom: '8px', fontFamily: THEME.fontHeading }}>{title}</h2>
    <div style={{ color: THEME.textDim, lineHeight: 1.8, fontSize: '15px' }}>{children}</div>
  </section>
)

export default function RefundsPage() {
  return (
    <>
      <div style={{ marginBottom: '48px' }}>
        <h1 style={{ fontSize: '36px', fontWeight: 700, color: THEME.text, marginBottom: '8px', fontFamily: THEME.fontHeading, letterSpacing: '-0.02em' }}>Refund Policy</h1>
        <p style={{ color: THEME.textDim, fontSize: '14px' }}>Last updated: March 5, 2026</p>
      </div>

      <div style={{ background: THEME.brandDim, border: `1px solid ${THEME.brand}`, borderRadius: THEME.radiusLg, padding: '20px 24px', marginBottom: '40px', color: THEME.text, fontSize: '15px', lineHeight: 1.7 }}>
        We want you to be happy with HumanizeIt. If something went wrong, we&apos;ll do our best to make it right. Contact us at <strong style={{ color: THEME.brandHi }}>support@humanizeit.app</strong> and we&apos;ll respond within 3–5 business days.
      </div>

      <Section title="1. Annual Plans — 14-Day Money-Back Guarantee">
        <p>If you purchase an annual plan (Pro Annual at $79/year or Team Annual at $249/year) and are not satisfied, you can request a full refund within <strong style={{ color: THEME.text }}>14 days</strong> of the purchase date. No questions asked.</p>
      </Section>

      <Section title="2. Monthly Plans">
        <p>Monthly subscriptions (Pro at $9/month or Team at $29/month) can be cancelled at any time. You will retain access to your plan until the end of the current billing period. We do not offer partial refunds for unused time on monthly plans.</p>
      </Section>

      <Section title="3. Exceptions — Always Refunded">
        <ul style={{ paddingLeft: '20px' }}>
          <li style={{ marginBottom: '8px' }}>Duplicate charges or billing errors</li>
          <li style={{ marginBottom: '8px' }}>Charges after a confirmed cancellation</li>
          <li style={{ marginBottom: '8px' }}>Technical issues that prevented you from using the service for more than 48 hours</li>
        </ul>
      </Section>

      <Section title="4. How to Request a Refund">
        <ol style={{ paddingLeft: '20px' }}>
          <li style={{ marginBottom: '8px' }}>Email <strong style={{ color: THEME.text }}>support@humanizeit.app</strong></li>
          <li style={{ marginBottom: '8px' }}>Include your order ID (found in your receipt email from Lemon Squeezy)</li>
          <li style={{ marginBottom: '8px' }}>Briefly describe the reason (optional for annual plans within 14 days)</li>
        </ol>
        <p style={{ marginTop: '12px' }}>Refunds are processed within 3–5 business days and returned to the original payment method.</p>
      </Section>

      <Section title="5. Free Plan">
        <p>The Free plan is completely free — no payment, no refund needed.</p>
      </Section>

      <Section title="6. Contact">
        <p><strong style={{ color: THEME.text }}>support@humanizeit.app</strong> — we read every email.</p>
      </Section>
    </>
  )
}
