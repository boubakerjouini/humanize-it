// ===========================================================
// /cookies — Cookie policy: every cookie and browser-storage key the site
// sets, including the first-party attribution cookies (hz_ft, hz_lt) and what
// each analytics tool stores where. Keep it in step with lib/analytics/,
// components/analytics/, components/growth/attribution-capture.tsx and the
// lead forms. Changes here need the founder's approval before release.
// ===========================================================

import { THEME } from "@/lib/theme";
import { AnalyticsOptOut } from "@/components/analytics/analytics-opt-out";

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

const strong = { color: THEME.text } as const
const li = { marginBottom: '6px' } as const

export default function CookiesPage() {
  return (
    <>
      <div style={{ marginBottom: '48px' }}>
        <h1 style={{ fontSize: '36px', fontWeight: 700, color: THEME.text, marginBottom: '8px', fontFamily: THEME.fontHeading, letterSpacing: '-0.02em' }}>Cookie Policy</h1>
        <p style={{ color: THEME.textDim, fontSize: '14px' }}>Last updated: October 8, 2026</p>
      </div>

      <Section title="1. What Are Cookies">
        <p>Cookies are small text files stored on your device when you visit a website. Your browser&apos;s local storage and session storage work in a similar way, and this page covers them too. We use them to keep you signed in, to remember a few choices and, outside the EU, the EEA, the UK and Switzerland, to understand how the site is used.</p>
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
                { name: 'hz_ft', provider: 'HumanizeIt (first-party)', purpose: 'Remembers how you first arrived (referring site, landing page, campaign tags) so we know which pages and sources work. Kept 180 days.', required: 'No' },
                { name: 'hz_lt', provider: 'HumanizeIt (first-party)', purpose: 'Same as hz_ft, for your most recent visit. Kept 30 days.', required: 'No' },
                { name: '_ga, _ga_*', provider: 'Google Analytics', purpose: 'Counts visits and where they come from, with a random ID for this browser. Kept up to 2 years. Set only outside the EU, the EEA, the UK and Switzerland, without Global Privacy Control, and if you have not refused (section 5).', required: 'No' },
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
        <p style={{ marginTop: '12px' }}>PostHog, our product analytics tool, doesn&apos;t use cookies; what it keeps in browser storage is described in section 3.</p>
      </Section>

      <Section title="3. Analytics">
        <p style={{ marginBottom: '12px' }}>We use three analytics tools. What they keep on your device depends on where it is, judged by its time zone, and on your choices:</p>
        <ul style={{ paddingLeft: '20px' }}>
          <li style={li}><strong style={strong}>Vercel Web Analytics and Speed Insights</strong> count page views and measure page speed for every visitor, without cookies or browser storage. Vercel counts visitors with a hash of the request that it discards after 24 hours.</li>
          <li style={li}><strong style={strong}>PostHog</strong> records page views and a few product events (it doesn&apos;t record every click). Outside the EU, the EEA, the UK and Switzerland, it keeps a random visitor ID in local storage ({'ph_<project key>_posthog'}) and a few values for the current tab in session storage, and once you sign in it links your events to your account ID, never to your email or name.</li>
          <li style={li}>In the EU, the EEA, the UK or Switzerland, or when your browser sends a Global Privacy Control signal, <strong style={strong}>PostHog runs in cookieless mode</strong>: it stores nothing on your device and doesn&apos;t link your browser&apos;s events to your account. Its servers count visits with an ID made from your IP address and browser details plus a key that changes every day and is then deleted, so visits on different days aren&apos;t connected. After you refuse in section 5, PostHog reports nothing from this browser, wherever you are.</li>
          <li style={li}><strong style={strong}>Google Analytics</strong> sets the _ga and _ga_* cookies to count visits and traffic sources, with Google signals and ad personalization turned off. When you submit a form on our site, it also receives a hashed copy of the contact details you typed, such as your email address (Google&apos;s user-provided data collection). It loads only outside the EU, the EEA, the UK and Switzerland, without Global Privacy Control, and if you haven&apos;t refused in section 5; otherwise it doesn&apos;t load and any _ga cookies set earlier are deleted. See <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noopener" style={{ color: THEME.brandHi }}>how Google uses data from sites that use its services</a>.</li>
        </ul>
      </Section>

      <Section title="4. Attribution Cookies">
        <p style={{ marginBottom: '12px' }}>hz_ft and hz_lt are set by our own site and read only by it. They don&apos;t track you across other websites. When you sign up or give us your email on a form, their contents are copied to your record so we can see which pages and sources bring people to HumanizeIt (see the <a href="/privacy" style={{ color: THEME.brandHi }}>Privacy Policy</a>).</p>
        <p>We don&apos;t set them, and delete any set earlier, when your device&apos;s time zone is in the EU, the EEA, the UK or Switzerland, or when your browser sends a Global Privacy Control signal; a form you send during that visit still says how you arrived, without anything stored on your device. You can refuse attribution on this browser in section 5: the cookies are deleted, and nothing about how you arrived is kept or sent with a form.</p>
      </Section>

      <Section title="5. Refuse Analytics and Attribution">
        <p style={{ marginBottom: '12px' }}>The button below refuses Google Analytics, PostHog and the attribution cookies on this browser. It deletes _ga, _ga_*, hz_ft, hz_lt and what PostHog stored, and from then on Google Analytics doesn&apos;t load, PostHog reports nothing from this browser and the attribution cookies aren&apos;t set. Vercel Web Analytics and Speed Insights, which store nothing on your device, still count page views and page speed (section 3). Signing in, the free tools and everything else work the same.</p>
        <p>Your choice is saved in this browser&apos;s local storage (hz_attr_optout), so clearing your site data or using another browser resets it.</p>
        <AnalyticsOptOut />
      </Section>

      <Section title="6. Browser Storage">
        <p>A few other small values are kept in your browser&apos;s storage, not in cookies: hz_lead (you already gave us your email, so we stop showing email popups), hz_exit_magnet_at (when we last showed a free-guide popup, so it appears at most once every 14 days), humanizeit_exit_shown (the home page popup was already shown), humanizeit_onboarded (you closed the getting-started checklist in your dashboard), hz_share_chip_day (the invite-a-friend prompt shows at most once a day) and, in session storage, prefill-text (text you typed on the home or compare page when you open the editor). If you connect our Chrome extension, its sign-in token is kept as humanizeit_ext_token. On our own team&apos;s devices, hz_internal keeps their visits out of our analytics. Apart from the extension token, which the extension uses to sign you in, these values never leave your device.</p>
      </Section>

      <Section title="7. No Advertising Cookies">
        <p>We do not use any advertising cookies. We do not sell your data to third parties or use cookies for ad targeting.</p>
      </Section>

      <Section title="8. How to Manage Cookies">
        <p style={{ marginBottom: '12px' }}>You can also control cookies through your browser settings. Note that disabling required cookies (Clerk session cookies) will prevent you from signing in.</p>
        <ul style={{ paddingLeft: '20px' }}>
          <li style={li}><strong style={strong}>Chrome:</strong> Settings → Privacy and security → Cookies</li>
          <li style={li}><strong style={strong}>Firefox:</strong> Settings → Privacy & Security → Cookies and Site Data</li>
          <li style={li}><strong style={strong}>Safari:</strong> Preferences → Privacy → Manage Website Data</li>
        </ul>
      </Section>

      <Section title="9. Contact">
        <p>Questions about cookies? Email us at <strong style={strong}>support@humanizeit.app</strong></p>
      </Section>
    </>
  )
}
