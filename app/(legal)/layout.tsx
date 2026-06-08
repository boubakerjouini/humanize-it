import { THEME } from "@/lib/theme";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', color: THEME.text, fontFamily: THEME.fontSans }}>
      <header style={{ borderBottom: `1px solid ${THEME.border}`, padding: '16px 24px' }}>
        <a href="/" style={{ textDecoration: 'none' }}>
          <span style={{ fontSize: '20px', fontWeight: 700, color: THEME.brand, fontFamily: THEME.fontHeading, letterSpacing: '-0.02em' }}>
            HumanizeIt
          </span>
        </a>
      </header>
      <main style={{ maxWidth: '768px', margin: '0 auto', padding: '64px 24px' }}>
        {children}
      </main>
      <footer style={{ borderTop: `1px solid ${THEME.border}`, padding: '32px 24px', textAlign: 'center' }}>
        <div style={{ display: 'flex', gap: '24px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '12px' }}>
          <a href="/privacy" style={{ color: THEME.brandHi, textDecoration: 'none', fontSize: '13px' }}>Privacy Policy</a>
          <a href="/terms" style={{ color: THEME.brandHi, textDecoration: 'none', fontSize: '13px' }}>Terms of Service</a>
          <a href="/cookies" style={{ color: THEME.brandHi, textDecoration: 'none', fontSize: '13px' }}>Cookie Policy</a>
          <a href="/refunds" style={{ color: THEME.brandHi, textDecoration: 'none', fontSize: '13px' }}>Refund Policy</a>
          <a href="/" style={{ color: THEME.textDim, textDecoration: 'none', fontSize: '13px' }}>← Back to Home</a>
        </div>
        <p style={{ color: THEME.textMuted, fontSize: '12px', margin: 0 }}>© 2026 HumanizeIt. All rights reserved.</p>
      </footer>
    </div>
  )
}
