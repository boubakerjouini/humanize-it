export const metadata = { title: 'Privacy Policy — HumanizeIt' }

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section style={{ marginBottom: '40px' }}>
    <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#111827', marginBottom: '12px', borderBottom: '1px solid rgba(139,92,246,0.2)', paddingBottom: '8px' }}>{title}</h2>
    <div style={{ color: '#4b5563', lineHeight: 1.8, fontSize: '15px' }}>{children}</div>
  </section>
)

export default function PrivacyPage() {
  return (
    <>
      <div style={{ marginBottom: '48px' }}>
        <h1 style={{ fontSize: '36px', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>Privacy Policy</h1>
        <p style={{ color: '#6b7280', fontSize: '14px' }}>Last updated: March 5, 2026</p>
      </div>

      <Section title="1. Introduction">
        <p>HumanizeIt (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) is committed to protecting your personal information. This Privacy Policy explains how we collect, use, and safeguard your data when you use humanizeit.app.</p>
      </Section>

      <Section title="2. What We Collect">
        <ul style={{ paddingLeft: '20px' }}>
          <li style={{ marginBottom: '8px' }}><strong style={{ color: '#111827' }}>Account data:</strong> Email address and name (via Google/email sign-in through Clerk)</li>
          <li style={{ marginBottom: '8px' }}><strong style={{ color: '#111827' }}>Usage data:</strong> Word count processed, number of humanizations, timestamps</li>
          <li style={{ marginBottom: '8px' }}><strong style={{ color: '#111827' }}>Subscription data:</strong> Plan type (Free/Pro/Team), billing status via Lemon Squeezy</li>
          <li style={{ marginBottom: '8px' }}><strong style={{ color: '#111827' }}>Text content:</strong> Text submitted for analysis/humanization — processed in real-time, not permanently stored</li>
          <li style={{ marginBottom: '8px' }}><strong style={{ color: '#111827' }}>Technical data:</strong> IP address, browser type, pages visited (via PostHog analytics)</li>
        </ul>
      </Section>

      <Section title="3. How We Use Your Data">
        <ul style={{ paddingLeft: '20px' }}>
          <li style={{ marginBottom: '8px' }}>Providing the humanization and detection service</li>
          <li style={{ marginBottom: '8px' }}>Enforcing daily/monthly word quotas based on your plan</li>
          <li style={{ marginBottom: '8px' }}>Processing payments and managing subscriptions</li>
          <li style={{ marginBottom: '8px' }}>Sending transactional emails (receipts, account alerts)</li>
          <li style={{ marginBottom: '8px' }}>Improving the service through anonymized analytics</li>
        </ul>
      </Section>

      <Section title="4. Third-Party Services">
        <p style={{ marginBottom: '12px' }}>We use the following third-party services to operate HumanizeIt:</p>
        <ul style={{ paddingLeft: '20px' }}>
          <li style={{ marginBottom: '8px' }}><strong style={{ color: '#111827' }}>Clerk</strong> — Authentication (stores your email, OAuth tokens). <a href="https://clerk.com/privacy" target="_blank" style={{ color: '#8b5cf6' }}>Privacy Policy</a></li>
          <li style={{ marginBottom: '8px' }}><strong style={{ color: '#111827' }}>Lemon Squeezy</strong> — Payment processing (stores billing info). <a href="https://www.lemonsqueezy.com/privacy" target="_blank" style={{ color: '#8b5cf6' }}>Privacy Policy</a></li>
          <li style={{ marginBottom: '8px' }}><strong style={{ color: '#111827' }}>Neon</strong> — Database hosting (stores your account and usage data)</li>
          <li style={{ marginBottom: '8px' }}><strong style={{ color: '#111827' }}>Vercel</strong> — Application hosting (processes all web requests)</li>
          <li style={{ marginBottom: '8px' }}><strong style={{ color: '#111827' }}>Anthropic</strong> — AI processing (your text is sent to Claude API; Anthropic does not train on API data)</li>
          <li style={{ marginBottom: '8px' }}><strong style={{ color: '#111827' }}>PostHog</strong> — Analytics (pseudonymous usage tracking, no personal identifiers)</li>
        </ul>
      </Section>

      <Section title="5. Data Retention">
        <p>We retain your account data for as long as your account is active, plus 90 days after deletion for backup purposes. Text submitted for analysis is processed in real-time and not stored permanently.</p>
      </Section>

      <Section title="6. Your Rights (GDPR)">
        <p style={{ marginBottom: '12px' }}>If you are in the EU, EEA, or Tunisia, you have the right to:</p>
        <ul style={{ paddingLeft: '20px' }}>
          <li style={{ marginBottom: '8px' }}>Access your personal data</li>
          <li style={{ marginBottom: '8px' }}>Request correction or deletion of your data</li>
          <li style={{ marginBottom: '8px' }}>Export your data (portability)</li>
          <li style={{ marginBottom: '8px' }}>Withdraw consent at any time</li>
        </ul>
        <p style={{ marginTop: '12px' }}>To exercise these rights, contact us at <strong style={{ color: '#111827' }}>support@humanizeit.app</strong></p>
      </Section>

      <Section title="7. Cookies">
        <p>We use session cookies (required for authentication via Clerk) and analytics cookies (PostHog). See our <a href="/cookies" style={{ color: '#8b5cf6' }}>Cookie Policy</a> for details.</p>
      </Section>

      <Section title="8. Contact">
        <p>For privacy questions or requests: <strong style={{ color: '#111827' }}>support@humanizeit.app</strong></p>
      </Section>
    </>
  )
}
