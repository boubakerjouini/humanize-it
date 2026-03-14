export const metadata = { title: 'Cookie Policy — HumanizeIt' }

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section style={{ marginBottom: '40px' }}>
    <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#111827', marginBottom: '12px', borderBottom: '1px solid rgba(126,34,206,0.2)', paddingBottom: '8px' }}>{title}</h2>
    <div style={{ color: '#6b7280', lineHeight: 1.8, fontSize: '15px' }}>{children}</div>
  </section>
)

export default function CookiesPage() {
  return (
    <>
      <div style={{ marginBottom: '48px' }}>
        <h1 style={{ fontSize: '36px', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>Cookie Policy</h1>
        <p style={{ color: '#9ca3af', fontSize: '14px' }}>Last updated: March 5, 2026</p>
      </div>

      <Section title="1. What Are Cookies">
        <p>Cookies are small text files stored on your device when you visit a website. We use cookies to keep you signed in and to understand how the service is used.</p>
      </Section>

      <Section title="2. Cookies We Use">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '8px' }}>
            <thead>
              <tr style={{ background: '#faf5ff' }}>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: '#374151', fontWeight: 600, fontSize: '13px', border: '1px solid #e5e7eb' }}>Cookie</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: '#374151', fontWeight: 600, fontSize: '13px', border: '1px solid #e5e7eb' }}>Provider</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: '#374151', fontWeight: 600, fontSize: '13px', border: '1px solid #e5e7eb' }}>Purpose</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: '#374151', fontWeight: 600, fontSize: '13px', border: '1px solid #e5e7eb' }}>Required</th>
              </tr>
            </thead>
            <tbody>
              {[
                { name: '__session', provider: 'Clerk', purpose: 'Keeps you signed in', required: 'Yes' },
                { name: '__client_uat', provider: 'Clerk', purpose: 'Verifies session integrity', required: 'Yes' },
                { name: 'ph_*', provider: 'PostHog', purpose: 'Anonymous analytics (page views, feature usage)', required: 'No' },
                { name: 'ls_*', provider: 'Lemon Squeezy', purpose: 'Checkout session (payment flow only)', required: 'Checkout only' },
              ].map((row, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : '#f9fafb' }}>
                  <td style={{ padding: '10px 12px', fontSize: '13px', fontFamily: 'monospace', color: '#a855f7', border: '1px solid #e5e7eb' }}>{row.name}</td>
                  <td style={{ padding: '10px 12px', fontSize: '13px', color: '#374151', border: '1px solid #e5e7eb' }}>{row.provider}</td>
                  <td style={{ padding: '10px 12px', fontSize: '13px', border: '1px solid #e5e7eb' }}>{row.purpose}</td>
                  <td style={{ padding: '10px 12px', fontSize: '13px', border: '1px solid #e5e7eb', color: row.required === 'Yes' ? '#dc2626' : '#16a34a' }}>{row.required}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="3. No Advertising Cookies">
        <p>We do not use any advertising, tracking, or marketing cookies. We do not sell your data to third parties or use cookies for ad targeting.</p>
      </Section>

      <Section title="4. How to Manage Cookies">
        <p style={{ marginBottom: '12px' }}>You can control cookies through your browser settings. Note that disabling required cookies (Clerk session cookies) will prevent you from signing in.</p>
        <ul style={{ paddingLeft: '20px' }}>
          <li style={{ marginBottom: '6px' }}><strong style={{ color: '#374151' }}>Chrome:</strong> Settings → Privacy and security → Cookies</li>
          <li style={{ marginBottom: '6px' }}><strong style={{ color: '#374151' }}>Firefox:</strong> Settings → Privacy & Security → Cookies and Site Data</li>
          <li style={{ marginBottom: '6px' }}><strong style={{ color: '#374151' }}>Safari:</strong> Preferences → Privacy → Manage Website Data</li>
        </ul>
      </Section>

      <Section title="5. Contact">
        <p>Questions about cookies? Email us at <strong style={{ color: '#374151' }}>support@humanizeit.app</strong></p>
      </Section>
    </>
  )
}
