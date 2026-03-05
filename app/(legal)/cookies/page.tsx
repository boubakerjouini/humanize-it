export const metadata = { title: 'Cookie Policy — HumanizeIt' }

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section style={{ marginBottom: '40px' }}>
    <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#fff', marginBottom: '12px', borderBottom: '1px solid rgba(139,92,246,0.2)', paddingBottom: '8px' }}>{title}</h2>
    <div style={{ color: '#a0a0b8', lineHeight: 1.8, fontSize: '15px' }}>{children}</div>
  </section>
)

export default function CookiesPage() {
  return (
    <>
      <div style={{ marginBottom: '48px' }}>
        <h1 style={{ fontSize: '36px', fontWeight: 700, color: '#fff', marginBottom: '8px' }}>Cookie Policy</h1>
        <p style={{ color: '#555577', fontSize: '14px' }}>Last updated: March 5, 2026</p>
      </div>

      <Section title="1. What Are Cookies">
        <p>Cookies are small text files stored on your device when you visit a website. We use cookies to keep you signed in and to understand how the service is used.</p>
      </Section>

      <Section title="2. Cookies We Use">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '8px' }}>
            <thead>
              <tr style={{ background: 'rgba(139,92,246,0.1)' }}>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: '#e0e0f0', fontWeight: 600, fontSize: '13px', border: '1px solid rgba(255,255,255,0.08)' }}>Cookie</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: '#e0e0f0', fontWeight: 600, fontSize: '13px', border: '1px solid rgba(255,255,255,0.08)' }}>Provider</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: '#e0e0f0', fontWeight: 600, fontSize: '13px', border: '1px solid rgba(255,255,255,0.08)' }}>Purpose</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: '#e0e0f0', fontWeight: 600, fontSize: '13px', border: '1px solid rgba(255,255,255,0.08)' }}>Required</th>
              </tr>
            </thead>
            <tbody>
              {[
                { name: '__session', provider: 'Clerk', purpose: 'Keeps you signed in', required: 'Yes' },
                { name: '__client_uat', provider: 'Clerk', purpose: 'Verifies session integrity', required: 'Yes' },
                { name: 'ph_*', provider: 'PostHog', purpose: 'Anonymous analytics (page views, feature usage)', required: 'No' },
                { name: 'ls_*', provider: 'Lemon Squeezy', purpose: 'Checkout session (payment flow only)', required: 'Checkout only' },
              ].map((row, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                  <td style={{ padding: '10px 12px', fontSize: '13px', fontFamily: 'monospace', color: '#a78bfa', border: '1px solid rgba(255,255,255,0.06)' }}>{row.name}</td>
                  <td style={{ padding: '10px 12px', fontSize: '13px', color: '#e0e0f0', border: '1px solid rgba(255,255,255,0.06)' }}>{row.provider}</td>
                  <td style={{ padding: '10px 12px', fontSize: '13px', border: '1px solid rgba(255,255,255,0.06)' }}>{row.purpose}</td>
                  <td style={{ padding: '10px 12px', fontSize: '13px', border: '1px solid rgba(255,255,255,0.06)', color: row.required === 'Yes' ? '#f87171' : '#4ade80' }}>{row.required}</td>
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
          <li style={{ marginBottom: '6px' }}><strong style={{ color: '#e0e0f0' }}>Chrome:</strong> Settings → Privacy and security → Cookies</li>
          <li style={{ marginBottom: '6px' }}><strong style={{ color: '#e0e0f0' }}>Firefox:</strong> Settings → Privacy & Security → Cookies and Site Data</li>
          <li style={{ marginBottom: '6px' }}><strong style={{ color: '#e0e0f0' }}>Safari:</strong> Preferences → Privacy → Manage Website Data</li>
        </ul>
      </Section>

      <Section title="5. Contact">
        <p>Questions about cookies? Email us at <strong style={{ color: '#e0e0f0' }}>support@humanizeit.app</strong></p>
      </Section>
    </>
  )
}
