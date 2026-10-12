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
        <p style={{ color: THEME.textDim, fontSize: '14px' }}>Last updated: October 8, 2026</p>
      </div>

      <Section title="1. Who We Are">
        <p style={{ marginBottom: '12px' }}>HumanizeIt (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) is run by Boubaker Jouini, who is the controller of the personal data described in this policy. Postal address: A3-8 RESD. EXPRESS, Centre Urbain Nord, Tunis 1087, Tunisia. Email: <strong style={strong}>support@humanizeit.app</strong>.</p>
        <p>We are committed to protecting your personal information. This Privacy Policy explains what we collect when you use humanizeit.app, why, on what legal basis, how long we keep it, and who processes it for us.</p>
      </Section>

      <Section title="2. What We Collect">
        <ul style={ul}>
          <li style={li}><strong style={strong}>Account data:</strong> your email address and name, through Clerk (email, Google or GitHub sign-in).</li>
          <li style={li}><strong style={strong}>Your documents (signed-in users):</strong> when you check, rewrite or upload text in your dashboard, we save it as a document in your account so it appears in History. A document holds the original text (for PDF and DOCX uploads, the text extracted from the file; we don&apos;t keep the file itself), the rewritten text if you humanized it, the scores and pattern analysis, the tone, the word count and the date.</li>
          <li style={li}><strong style={strong}>Voice profiles (Voice Match, paid plans):</strong> when you create a voice, the writing samples you paste are sent once to our AI provider to build a short description of your style (sentence length, word choice, tone and similar traits). We store only that description (it may quote a short phrase you use often), the name you give the voice and the samples&apos; word count, never the samples themselves. You can delete a voice from the Voice page at any time, and deleting your account deletes them all.</li>
          <li style={li}><strong style={strong}>Usage data:</strong> words processed, number of rewrites, quota resets and timestamps, used to apply your plan&apos;s limits.</li>
          <li style={li}><strong style={strong}>Subscription data:</strong> your plan (Free, Pro or Team) and billing status, through Lemon Squeezy. We never see your full card details.</li>
          <li style={li}><strong style={strong}>Free tools without an account:</strong> the instant AI detector runs in your browser, so that text stays on your device. The optional deep scan and the free humanizer send your text to our server and our AI provider for a one-time analysis or rewrite; we don&apos;t store that text. To stop abuse, we keep short-lived counters keyed by your IP address (deleted after about a day).</li>
          <li style={li}><strong style={strong}>Email and lead data:</strong> when you give us your email on a form (a free guide, the emailed detector report, the Chrome extension waitlist or the Founding 100 list), we store your email, which form and resource it was, the topics you opted into, and how you found us (see Attribution below). The detector report email contains your scores and fix list, never your text.</li>
          <li style={li}><strong style={strong}>Consent records:</strong> for every opt-in, confirmation or unsubscribe: the topic, the exact wording you saw (by version), how you gave it (checkbox, confirmation button, preference page), the page, the time, your browser&apos;s user-agent string (shortened) and a keyed hash of your IP address rather than the address itself.</li>
          <li style={li}><strong style={strong}>Email delivery records:</strong> for each email we send: which email it was, when, and whether it was delivered, bounced or marked as spam. These records store a hash of your address and its domain, not the address.</li>
          <li style={li}><strong style={strong}>Attribution:</strong> two first-party cookies remember how you first and most recently arrived (referring site, landing page, campaign tags such as utm_source). They are copied to your record when you sign up or submit a form. They are not set in the EU, the EEA, the UK or Switzerland (judged by your device&apos;s time zone) or when your browser sends Global Privacy Control, and you can refuse them anywhere else. Where they aren&apos;t set, a form you send still carries how you arrived on that visit (nothing is stored on your device for it), unless you refused attribution. See the <a href="/cookies" style={link}>Cookie Policy</a>.</li>
          <li style={li}><strong style={strong}>Customer record:</strong> to decide which emails and personal notes are relevant, we keep a simple record per person built from the data above: a lifecycle stage (for example lead, active user or customer), an activity score, a timeline of key events (signed up, first document, plan changes, emails) and the founder&apos;s notes. It contains no document text.</li>
          <li style={li}><strong style={strong}>Technical data:</strong> IP address, browser type and pages visited, through our hosting and analytics tools (Sections 6 and 7).</li>
        </ul>
      </Section>

      <Section title="3. How We Use Your Data">
        <ul style={ul}>
          <li style={li}>Providing the humanization and detection service, including History</li>
          <li style={li}>Enforcing daily and monthly word quotas based on your plan</li>
          <li style={li}>Processing payments and managing subscriptions</li>
          <li style={li}>Sending transactional and account emails: what you requested (a guide, your report, a confirmation link), receipts, and notices about your account such as a plan that is about to end. You can turn off non-essential account emails in your email preferences.</li>
          <li style={li}>Sending marketing emails, only with your consent (Section 5)</li>
          <li style={li}>Occasional personal emails from the founder about your account, which you can stop by replying or through your email preferences</li>
          <li style={li}>Understanding which pages and sources bring people to the site, and improving the service</li>
        </ul>
        <p style={{ marginTop: '12px' }}>We never sell your data, and we never use your documents to train AI models.</p>
      </Section>

      <Section title="4. Legal Bases">
        <p style={{ marginBottom: '12px' }}>Under the GDPR and the UK GDPR, we rely on these legal bases:</p>
        <ul style={ul}>
          <li style={li}><strong style={strong}>Contract:</strong> to provide what you sign up for or ask for: your account, documents and History, checks and rewrites, the free tools, your plan&apos;s quotas and subscription, a free guide or report you request, and the transactional and account emails that go with them.</li>
          <li style={li}><strong style={strong}>Legitimate interests:</strong> to keep the service secure and stop abuse (the IP-based counters), to understand which pages and sources bring people to the site and improve it (analytics and attribution, Section 6), to keep the customer record and send occasional personal emails about your account, and to keep consent records and the suppression list so we can prove your choices and never email you after you opt out. You can object at any time (Section 10); the button on our <a href="/cookies" style={link}>Cookie Policy</a> page turns off Google Analytics, PostHog and the attribution cookies on your browser.</li>
          <li style={li}><strong style={strong}>Consent:</strong> marketing emails (Section 5). You can withdraw it at any time, without affecting what was sent before.</li>
        </ul>
      </Section>

      <Section title="5. Marketing Emails">
        <ul style={ul}>
          <li style={li}><strong style={strong}>What we send:</strong> writing tips and occasional offers (about 2 emails a month; if you sign up through a free guide or the AI detector, a short series of 5 emails over the first 2 weeks comes first), and, if you joined the waitlist, a few updates about the Chrome extension and its launch.</li>
          <li style={li}><strong style={strong}>Legal basis:</strong> your consent. Boxes start unticked, and getting a free guide never requires subscribing. After you opt in on a public form, we ask you to confirm with a button on our site before we send any marketing email (double opt-in).</li>
          <li style={li}><strong style={strong}>How to stop:</strong> use the unsubscribe link in any email, the email preferences page linked from every email, or your dashboard settings. Unsubscribing takes effect immediately.</li>
          <li style={li}><strong style={strong}>What we keep:</strong> your consent records (Section 2) as proof of what you agreed to, and a suppression list so we never email you again after you unsubscribe, an email bounces, or you ask us to delete your data. The suppression list stores a hash of your address, not the address.</li>
        </ul>
      </Section>

      <Section title="6. Analytics">
        <p style={{ marginBottom: '12px' }}>How we measure use of the site depends on where your device is, judged by its time zone, and on your choices:</p>
        <ul style={ul}>
          <li style={li}><strong style={strong}>Everyone:</strong> Vercel Web Analytics and Speed Insights count page views and page speed without cookies. Vercel counts visitors with a hash of the request that it discards after 24 hours.</li>
          <li style={li}><strong style={strong}>Outside the EU, the EEA, the UK and Switzerland</strong>, unless your browser sends Global Privacy Control or you refuse on our <a href="/cookies" style={link}>Cookie Policy</a> page: PostHog keeps a random visitor ID in your browser&apos;s storage and, once you sign in, links your usage events to your account ID (never your email or name), and Google Analytics sets its _ga cookies to count visits and traffic sources.</li>
          <li style={li}><strong style={strong}>In the EU, the EEA, the UK and Switzerland, or when your browser sends Global Privacy Control:</strong> no Google Analytics, and PostHog runs in cookieless mode: nothing is stored on your device, your browser&apos;s events aren&apos;t linked to your account, and PostHog&apos;s servers count visits with an ID made from your IP address and browser details plus a key that changes every day, so visits on different days aren&apos;t connected.</li>
          <li style={li}><strong style={strong}>If you refuse</strong> on our <a href="/cookies" style={link}>Cookie Policy</a> page, wherever you are: neither Google Analytics nor PostHog reports anything from your browser.</li>
          <li style={li}><strong style={strong}>Events from our server, wherever you are:</strong> our server also tells PostHog about a few actions, such as a finished check or rewrite, a processed document, a new voice profile, a started checkout or a form you sent. These events can carry counts (such as words), your plan and how you arrived, never your text, email or name, and some carry your account ID or the internal ID of your record with us. Nothing is stored on your device for them.</li>
        </ul>
        <p style={{ marginTop: '12px' }}>We don&apos;t use analytics for advertising. The <a href="/cookies" style={link}>Cookie Policy</a> lists what each tool stores and has the button to refuse.</p>
      </Section>

      <Section title="7. Third-Party Services">
        <p style={{ marginBottom: '12px' }}>We use the following services to operate HumanizeIt. They process data on our behalf, except Lemon Squeezy, which handles your purchases as merchant of record under its own privacy policy:</p>
        <ul style={ul}>
          <li style={li}><strong style={strong}>Clerk</strong> — Authentication (stores your email and sign-in details). <a href="https://clerk.com/privacy" target="_blank" rel="noopener" style={link}>Privacy Policy</a></li>
          <li style={li}><strong style={strong}>Lemon Squeezy</strong> — Payment processing (stores billing information). <a href="https://www.lemonsqueezy.com/privacy" target="_blank" rel="noopener" style={link}>Privacy Policy</a></li>
          <li style={li}><strong style={strong}>Neon</strong> — Database hosting (stores your account, documents, usage, email and consent records)</li>
          <li style={li}><strong style={strong}>Vercel</strong> — Application hosting (processes all web requests), plus Vercel Web Analytics and Speed Insights (aggregate, cookieless page and performance statistics)</li>
          <li style={li}><strong style={strong}>Anthropic</strong> — AI processing: the text you submit for a deep scan, a rewrite or a document, and the writing samples for a voice profile, are sent to the Claude API. Anthropic does not train on API data.</li>
          <li style={li}><strong style={strong}>Resend</strong> — Email delivery: receives your email address and the content of each email we send you, and reports whether it was delivered. <a href="https://resend.com/legal/privacy-policy" target="_blank" rel="noopener" style={link}>Privacy Policy</a></li>
          <li style={li}><strong style={strong}>PostHog</strong> — Product analytics, hosted in the EU: pseudonymous usage events, linked to your account ID (never your email or name) once you sign in, or counted without storing anything on your device (Section 6)</li>
          <li style={li}><strong style={strong}>Google Analytics</strong> — Website analytics: pages visited, traffic sources and interactions such as scrolling and outbound clicks, plus, when you submit a form on our site, a hashed copy of the contact details you typed, such as your email address (Google&apos;s user-provided data collection). Only where Section 6 allows it, with Google signals and ad personalization turned off. <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noopener" style={link}>How Google uses data from sites that use its services</a></li>
        </ul>
      </Section>

      <Section title="8. International Transfers">
        <p>HumanizeIt is run from Tunisia, and the services in Section 7 process data in the United States and the European Union. When personal data from the EU, the EEA, the UK or Switzerland goes to a country that hasn&apos;t been found to protect it adequately, it is covered by the EU-US Data Privacy Framework where the provider is certified under it, or otherwise by the European Commission&apos;s Standard Contractual Clauses (with the UK and Swiss versions where they apply) in the provider&apos;s data processing terms. Email <strong style={strong}>support@humanizeit.app</strong> for a copy of the safeguards that apply.</p>
      </Section>

      <Section title="9. Data Retention">
        <ul style={ul}>
          <li style={li}><strong style={strong}>Account data and documents:</strong> kept while your account exists. You can delete any document from History at any time, and deleting your account deletes your documents. The Free plan&apos;s History shows your 5 most recent documents; older documents stay stored in your account until you delete them or your account.</li>
          <li style={li}><strong style={strong}>Backups:</strong> deleted data can remain in database backups for up to 90 days.</li>
          <li style={li}><strong style={strong}>Text sent to the free tools:</strong> not stored (Section 2).</li>
          <li style={li}><strong style={strong}>Lead and customer records:</strong> kept until you ask us to delete them.</li>
          <li style={li}><strong style={strong}>Consent records and the suppression list:</strong> kept after you unsubscribe or ask for deletion, because they prove your choice and stop us from emailing you again. The suppression list holds only a hash of your address.</li>
          <li style={li}><strong style={strong}>Email delivery records:</strong> kept in our database with a hashed address; Resend keeps its own delivery logs for a limited period.</li>
          <li style={li}><strong style={strong}>Analytics:</strong> PostHog keeps usage events for up to 7 years, the retention of our PostHog plan. Google Analytics keeps its user-level and event-level data for 2 months (its data-retention setting). Vercel Web Analytics keeps no visitor ID beyond 24 hours (Section 6).</li>
        </ul>
      </Section>

      <Section title="10. Your Rights (GDPR)">
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

      <Section title="11. Cookies">
        <p>We use session cookies (required for sign-in via Clerk), two first-party attribution cookies and, where Section 6 allows it, Google Analytics cookies. See our <a href="/cookies" style={link}>Cookie Policy</a> for details and to refuse the ones that aren&apos;t required.</p>
      </Section>

      <Section title="12. Contact">
        <p>For privacy questions or requests: <strong style={strong}>support@humanizeit.app</strong>, or by post to the address in Section 1.</p>
      </Section>
    </>
  )
}
