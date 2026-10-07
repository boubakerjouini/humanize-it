// ===========================================================
// /privacy — Privacy policy. Describes what the code actually does: keep it in
// step with data changes (documents, lead capture, consent, email, analytics).
// Changes here need the founder's approval before release.
// ===========================================================

import { THEME } from "@/lib/theme";

export const metadata = {
  title: 'Privacy Policy — HumanizeIt',
  description:
    'What HumanizeIt stores, why, for how long, and who processes it: your documents, email and consent records, analytics, and how to delete your data.',
  alternates: { canonical: 'https://humanizeit.app/privacy' },
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section style={{ marginBottom: '40px' }}>
    <h2 style={{ fontSize: '20px', fontWeight: 600, color: THEME.text, marginBottom: '12px', borderBottom: `1px solid ${THEME.border}`, paddingBottom: '8px', fontFamily: THEME.fontHeading }}>{title}</h2>
    <div style={{ color: THEME.textDim, lineHeight: 1.8, fontSize: '15px' }}>{children}</div>
  </section>
)

const ul = { paddingLeft: '20px', listStyle: 'disc' } as const
const li = { marginBottom: '8px' } as const
const strong = { color: THEME.text } as const
const link = { color: THEME.brandHi } as const

export default function PrivacyPage() {
  return (
    <>
      <div style={{ marginBottom: '48px' }}>
        <h1 style={{ fontSize: '36px', fontWeight: 700, color: THEME.text, marginBottom: '8px', fontFamily: THEME.fontHeading, letterSpacing: '-0.02em' }}>Privacy Policy</h1>
        <p style={{ color: THEME.textDim, fontSize: '14px' }}>Last updated: October 7, 2026</p>
      </div>

      <Section title="1. Introduction">
        <p>HumanizeIt (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) is committed to protecting your personal information. This Privacy Policy explains what we collect when you use humanizeit.app, why, how long we keep it, and who processes it for us.</p>
      </Section>

      <Section title="2. What We Collect">
        <ul style={ul}>
          <li style={li}><strong style={strong}>Account data:</strong> your email address and name, through Clerk (Google or email sign-in).</li>
          <li style={li}><strong style={strong}>Your documents (signed-in users):</strong> when you check, rewrite or upload text in your dashboard, we save it as a document in your account so it appears in History. A document holds the original text (for PDF and DOCX uploads, the text extracted from the file; we don&apos;t keep the file itself), the rewritten text if you humanized it, the scores and pattern analysis, the tone, the word count and the date.</li>
          <li style={li}><strong style={strong}>Usage data:</strong> words processed, number of rewrites, quota resets and timestamps, used to apply your plan&apos;s limits.</li>
          <li style={li}><strong style={strong}>Subscription data:</strong> your plan (Free, Pro or Team) and billing status, through Lemon Squeezy. We never see your full card details.</li>
          <li style={li}><strong style={strong}>Free tools without an account:</strong> the instant AI detector runs in your browser, so that text stays on your device. The optional deep scan and the free humanizer send your text to our server and our AI provider for a one-time analysis or rewrite; we don&apos;t store that text. To stop abuse, we keep short-lived counters keyed by your IP address (deleted after about a day).</li>
          <li style={li}><strong style={strong}>Email and lead data:</strong> when you give us your email on a form (a free guide, the emailed detector report, the Chrome extension waitlist or the Founding 100 list), we store your email, which form and resource it was, the topics you opted into, and how you found us (see Attribution below). The detector report email contains your scores and fix list, never your text.</li>
          <li style={li}><strong style={strong}>Consent records:</strong> for every opt-in, confirmation or unsubscribe: the topic, the exact wording you saw (by version), how you gave it (checkbox, confirmation button, preference page), the page, the time, your browser&apos;s user-agent string (shortened) and a keyed hash of your IP address rather than the address itself.</li>
          <li style={li}><strong style={strong}>Email delivery records:</strong> for each email we send: which email it was, when, and whether it was delivered, bounced or marked as spam. These records store a hash of your address and its domain, not the address.</li>
          <li style={li}><strong style={strong}>Attribution:</strong> two first-party cookies remember how you first and most recently arrived (referring site, landing page, campaign tags such as utm_source). They are copied to your record when you sign up or submit a form. See the <a href="/cookies" style={link}>Cookie Policy</a>.</li>
          <li style={li}><strong style={strong}>Customer record:</strong> to decide which emails and personal notes are relevant, we keep a simple record per person built from the data above: a lifecycle stage (for example lead, active user or customer), an activity score, a timeline of key events (signed up, first document, plan changes, emails) and the founder&apos;s notes. It contains no document text.</li>
          <li style={li}><strong style={strong}>Technical data:</strong> IP address, browser type and pages visited, through our analytics tools (Section 5).</li>
        </ul>
      </Section>

      <Section title="3. How We Use Your Data">
        <ul style={ul}>
          <li style={li}>Providing the humanization and detection service, including History</li>
          <li style={li}>Enforcing daily and monthly word quotas based on your plan</li>
          <li style={li}>Processing payments and managing subscriptions</li>
          <li style={li}>Sending transactional and account emails: what you requested (a guide, your report, a confirmation link), receipts, and notices about your account such as a plan that is about to end. You can turn off non-essential account emails in your email preferences.</li>
          <li style={li}>Sending marketing emails, only with your consent (Section 4)</li>
          <li style={li}>Occasional personal emails from the founder about your account, which you can stop by replying or through your email preferences</li>
          <li style={li}>Understanding which pages and sources bring people to the site, and improving the service</li>
        </ul>
        <p style={{ marginTop: '12px' }}>We never sell your data, and we never use your documents to train AI models.</p>
      </Section>

      <Section title="4. Marketing Emails">
        <ul style={ul}>
          <li style={li}><strong style={strong}>What we send:</strong> writing tips and occasional offers (about 2 emails a month; if you sign up through a free guide or the AI detector, a short series of 5 emails over the first 2 weeks comes first), and, if you joined the waitlist, a few updates about the Chrome extension and its launch.</li>
          <li style={li}><strong style={strong}>Legal basis:</strong> your consent. Boxes start unticked, and getting a free guide never requires subscribing. After you opt in on a public form, we ask you to confirm with a button on our site before we send any marketing email (double opt-in).</li>
          <li style={li}><strong style={strong}>How to stop:</strong> use the unsubscribe link in any email, the email preferences page linked from every email, or your dashboard settings. Unsubscribing takes effect immediately.</li>
          <li style={li}><strong style={strong}>What we keep:</strong> your consent records (Section 2) as proof of what you agreed to, and a suppression list so we never email you again after you unsubscribe, an email bounces, or you ask us to delete your data. The suppression list stores a hash of your address, not the address.</li>
        </ul>
      </Section>

      <Section title="5. Third-Party Services">
        <p style={{ marginBottom: '12px' }}>We use the following services to operate HumanizeIt. They process data on our behalf:</p>
        <ul style={ul}>
          <li style={li}><strong style={strong}>Clerk</strong> — Authentication (stores your email and sign-in details). <a href="https://clerk.com/privacy" target="_blank" rel="noopener" style={link}>Privacy Policy</a></li>
          <li style={li}><strong style={strong}>Lemon Squeezy</strong> — Payment processing (stores billing information). <a href="https://www.lemonsqueezy.com/privacy" target="_blank" rel="noopener" style={link}>Privacy Policy</a></li>
          <li style={li}><strong style={strong}>Neon</strong> — Database hosting (stores your account, documents, usage, email and consent records)</li>
          <li style={li}><strong style={strong}>Vercel</strong> — Application hosting (processes all web requests), plus Vercel Web Analytics and Speed Insights (aggregate, cookieless page and performance statistics)</li>
          <li style={li}><strong style={strong}>Anthropic</strong> — AI processing: the text you submit for a deep scan, a rewrite or a document is sent to the Claude API. Anthropic does not train on API data.</li>
          <li style={li}><strong style={strong}>Resend</strong> — Email delivery (EU region): receives your email address and the content of each email we send you, and reports whether it was delivered. <a href="https://resend.com/legal/privacy-policy" target="_blank" rel="noopener" style={link}>Privacy Policy</a></li>
          <li style={li}><strong style={strong}>PostHog</strong> — Product analytics (pseudonymous usage events, linked to your account once you sign in)</li>
          <li style={li}><strong style={strong}>Google Analytics</strong> — Website analytics (page views and traffic sources)</li>
        </ul>
      </Section>

      <Section title="6. Data Retention">
        <ul style={ul}>
          <li style={li}><strong style={strong}>Account data and documents:</strong> kept while your account exists. You can delete any document from History at any time, and deleting your account deletes your documents. The Free plan&apos;s History shows your 5 most recent documents; older documents stay stored in your account until you delete them or your account.</li>
          <li style={li}><strong style={strong}>Backups:</strong> deleted data can remain in database backups for up to 90 days.</li>
          <li style={li}><strong style={strong}>Text sent to the free tools:</strong> not stored (Section 2).</li>
          <li style={li}><strong style={strong}>Lead and customer records:</strong> kept until you ask us to delete them.</li>
          <li style={li}><strong style={strong}>Consent records and the suppression list:</strong> kept after you unsubscribe or ask for deletion, because they prove your choice and stop us from emailing you again. The suppression list holds only a hash of your address.</li>
          <li style={li}><strong style={strong}>Email delivery records:</strong> kept in our database with a hashed address; Resend keeps its own delivery logs for a limited period.</li>
        </ul>
      </Section>

      <Section title="7. Your Rights (GDPR)">
        <p style={{ marginBottom: '12px' }}>If you are in the EU, EEA, UK or Tunisia, you have the right to:</p>
        <ul style={ul}>
          <li style={li}>Access your personal data</li>
          <li style={li}>Request correction or deletion of your data</li>
          <li style={li}>Export your data (portability)</li>
          <li style={li}>Withdraw consent at any time, without affecting what was done before</li>
          <li style={li}>Object to processing, and complain to your data protection authority</li>
        </ul>
        <p style={{ marginTop: '12px' }}>To exercise these rights, contact us at <strong style={strong}>support@humanizeit.app</strong>. When we delete your data, we keep only the hashed suppression entry so we never email you again.</p>
      </Section>

      <Section title="8. Cookies">
        <p>We use session cookies (required for sign-in via Clerk), two first-party attribution cookies, and analytics cookies. See our <a href="/cookies" style={link}>Cookie Policy</a> for details.</p>
      </Section>

      <Section title="9. Contact">
        <p>For privacy questions or requests: <strong style={strong}>support@humanizeit.app</strong></p>
      </Section>
    </>
  )
}
