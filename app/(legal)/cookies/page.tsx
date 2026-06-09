import { THEME } from "@/lib/theme";

export const metadata = {
  title: 'Cookie Policy — HumanizeIt',
  description:
    'How HumanizeIt uses cookies and similar technologies for authentication, preferences, and privacy-friendly analytics — and how to control them.',
  alternates: { canonical: 'https://humanizeit.app/cookies' },
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section style={{ marginBottom: '40px' }}>
    <h2 style={{ fontSize: '20px', fontWeight: 600, color: THEME.text, marginBottom: '12px', borderBottom: `1px solid ${THEME.border}`, paddingBottom: '8px', fontFamily: THEME.fontHeading }}>{title}</h2>
    <div style={{ color: THEME.textDim, lineHeight: 1.8, fontSize: '15px' }}>{children}</div>
  </section>
)

export default function CookiesPage() {
  return (
    <>
      <div style={{ marginBottom: '48px' }}>
        <h1 style={{ fontSize: '36px', fontWeight: 700, color: THEME.text, marginBottom: '8px', fontFamily: THEME.fontHeading, letterSpacing: '-0.02em' }}>Cookie Policy</h1>
        <p style={{ color: THEME.textDim, fontSize: '14px' }}>Last updated: March 5, 2026</p>
      </div>

      <Section title="1. What Are Cookies">
        <p>Cookies are small text files stored on your device when you visit a website. We use cookies to keep you signed in and to understand how the service is used.</p>
      </Section>

      <Section title="2. Cookies We Use">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '8px' }}>
            <thead>
              <tr style={{ background: THEME.surface1 }}>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: THEME.text, fontWeight: 600, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em', border: `1px solid ${THEME.border}` }}>Cookie</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: THEME.text, fontWeight: 600, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em', border: `1px solid ${THEME.border}` }}>Provider</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: THEME.text, fontWeight: 600, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em', border: `1px solid ${THEME.border}` }}>Purpose</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: THEME.text, fontWeight: 600, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em', border: `1px solid ${THEME.border}` }}>Required</th>
              </tr>
            </thead>
            <tbody>
              {[
                { name: '__session', provider: 'Clerk', purpose: 'Keeps you signed in', required: 'Yes' },
                { name: '__client_uat', provider: 'Clerk', purpose: 'Verifies session integrity', required: 'Yes' },
                { name: 'ph_*', provider: 'PostHog', purpose: 'Anonymous analytics (page views, feature usage)', required: 'No' },
                { name: 'ls_*', provider: 'Lemon Squeezy', purpose: 'Checkout session (payment flow only)', required: 'Checkout only' },
              ].map((row, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : THEME.surface2 }}>
                  <td style={{ padding: '10px 12px', fontSize: '13px', fontFamily: THEME.fontMono, color: THEME.human, border: `1px solid ${THEME.border}` }}>{row.name}</td>
                  <td style={{ padding: '10px 12px', fontSize: '13px', color: THEME.textDim, border: `1px solid ${THEME.border}` }}>{row.provider}</td>
                  <td style={{ padding: '10px 12px', fontSize: '13px', color: THEME.textDim, border: `1px solid ${THEME.border}` }}>{row.purpose}</td>
                  <td style={{ padding: '10px 12px', fontSize: '13px', fontWeight: 600, border: `1px solid ${THEME.border}`, color: row.required === 'Yes' ? THEME.ai : THEME.human }}>{row.required}</td>
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
          <li style={{ marginBottom: '6px' }}><strong style={{ color: THEME.text }}>Chrome:</strong> Settings → Privacy and security → Cookies</li>
          <li style={{ marginBottom: '6px' }}><strong style={{ color: THEME.text }}>Firefox:</strong> Settings → Privacy & Security → Cookies and Site Data</li>
          <li style={{ marginBottom: '6px' }}><strong style={{ color: THEME.text }}>Safari:</strong> Preferences → Privacy → Manage Website Data</li>
        </ul>
      </Section>

      <Section title="5. Contact">
        <p>Questions about cookies? Email us at <strong style={{ color: THEME.text }}>support@humanizeit.app</strong></p>
      </Section>
    </>
  )
}
