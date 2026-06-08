import { THEME } from "@/lib/theme";

export const metadata = { title: 'Terms of Service — HumanizeIt' }

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section style={{ marginBottom: '40px' }}>
    <h2 style={{ fontSize: '20px', fontWeight: 600, color: THEME.text, marginBottom: '12px', borderBottom: `1px solid ${THEME.border}`, paddingBottom: '8px', fontFamily: THEME.fontHeading }}>{title}</h2>
    <div style={{ color: THEME.textDim, lineHeight: 1.8, fontSize: '15px' }}>{children}</div>
  </section>
)

export default function TermsPage() {
  return (
    <>
      <div style={{ marginBottom: '48px' }}>
        <h1 style={{ fontSize: '36px', fontWeight: 700, color: THEME.text, marginBottom: '8px', fontFamily: THEME.fontHeading, letterSpacing: '-0.02em' }}>Terms of Service</h1>
        <p style={{ color: THEME.textDim, fontSize: '14px' }}>Effective date: March 5, 2026</p>
      </div>

      <Section title="1. Acceptance">
        <p>By creating an account or using HumanizeIt, you agree to these Terms of Service. If you do not agree, do not use the service.</p>
      </Section>

      <Section title="2. Description of Service">
        <p>HumanizeIt is an AI-powered tool that analyzes text for AI-generated patterns and rewrites content to sound more natural and human. We do not guarantee that processed text will pass any specific AI detector.</p>
      </Section>

      <Section title="3. Plans & Limits">
        <ul style={{ paddingLeft: '20px' }}>
          <li style={{ marginBottom: '8px' }}><strong style={{ color: THEME.text }}>Free:</strong> $0 — 500 words/day, 1 humanization/day</li>
          <li style={{ marginBottom: '8px' }}><strong style={{ color: THEME.text }}>Pro:</strong> $9/month or $79/year — 50,000 words/month, unlimited humanizations</li>
          <li style={{ marginBottom: '8px' }}><strong style={{ color: THEME.text }}>Team:</strong> $29/month or $249/year — 200,000 words/month, unlimited humanizations</li>
        </ul>
        <p style={{ marginTop: '12px' }}>Quotas reset daily (Free) or monthly (Pro/Team) based on your billing cycle.</p>
      </Section>

      <Section title="4. Prohibited Uses">
        <p style={{ marginBottom: '12px' }}>You may NOT use HumanizeIt to:</p>
        <ul style={{ paddingLeft: '20px' }}>
          <li style={{ marginBottom: '8px' }}>Submit essays, assignments, or academic work as your own (academic fraud)</li>
          <li style={{ marginBottom: '8px' }}>Generate or distribute spam, phishing, or misleading content</li>
          <li style={{ marginBottom: '8px' }}>Produce illegal, defamatory, or harmful content</li>
          <li style={{ marginBottom: '8px' }}>Scrape, reverse-engineer, or automate access to the platform without permission</li>
          <li style={{ marginBottom: '8px' }}>Resell access or share accounts between multiple users (Team plan excluded)</li>
        </ul>
        <p style={{ marginTop: '12px' }}>Violations may result in immediate account suspension without refund.</p>
      </Section>

      <Section title="5. Intellectual Property">
        <p>You retain full ownership of the text you submit. HumanizeIt retains ownership of the platform, algorithms, UI, and all associated software. You grant us a limited license to process your text solely to provide the service.</p>
      </Section>

      <Section title="6. Disclaimer">
        <p>HumanizeIt is provided &quot;as is&quot; without warranties of any kind. We do not guarantee that humanized text will evade any AI detection tool. Detection algorithms change frequently and results may vary.</p>
      </Section>

      <Section title="7. Limitation of Liability">
        <p>To the maximum extent permitted by law, HumanizeIt&apos;s liability to you is limited to the total fees you paid in the 3 months prior to the claim. We are not liable for indirect, incidental, or consequential damages.</p>
      </Section>

      <Section title="8. Termination">
        <p>We reserve the right to suspend or terminate accounts that violate these terms, at our sole discretion, with or without prior notice. You may cancel your subscription at any time from your dashboard.</p>
      </Section>

      <Section title="9. Governing Law">
        <p>These Terms are governed by the laws of Tunisia. Any disputes shall be resolved in the competent courts of Tunis, Tunisia.</p>
      </Section>

      <Section title="10. Changes">
        <p>We may update these Terms at any time. Continued use of the service after changes constitutes acceptance. We will notify active subscribers of material changes by email.</p>
      </Section>

      <Section title="11. Contact">
        <p>For questions about these Terms: <strong style={{ color: THEME.text }}>support@humanizeit.app</strong></p>
      </Section>
    </>
  )
}
