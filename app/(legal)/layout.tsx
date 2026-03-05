export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: '#09090b', minHeight: '100vh', color: '#e0e0f0', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '16px 24px' }}>
        <a href="/" style={{ textDecoration: 'none' }}>
          <span style={{ fontSize: '20px', fontWeight: 700, background: 'linear-gradient(135deg, #8b5cf6, #6366f1)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            HumanizeIt
          </span>
        </a>
      </header>
      <main style={{ maxWidth: '768px', margin: '0 auto', padding: '64px 24px' }}>
        {children}
      </main>
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.08)', padding: '32px 24px', textAlign: 'center' }}>
        <div style={{ display: 'flex', gap: '24px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '12px' }}>
          <a href="/privacy" style={{ color: '#8b5cf6', textDecoration: 'none', fontSize: '13px' }}>Privacy Policy</a>
          <a href="/terms" style={{ color: '#8b5cf6', textDecoration: 'none', fontSize: '13px' }}>Terms of Service</a>
          <a href="/cookies" style={{ color: '#8b5cf6', textDecoration: 'none', fontSize: '13px' }}>Cookie Policy</a>
          <a href="/refunds" style={{ color: '#8b5cf6', textDecoration: 'none', fontSize: '13px' }}>Refund Policy</a>
          <a href="/" style={{ color: '#555577', textDecoration: 'none', fontSize: '13px' }}>← Back to Home</a>
        </div>
        <p style={{ color: '#555577', fontSize: '12px', margin: 0 }}>© 2026 HumanizeIt. All rights reserved.</p>
      </footer>
    </div>
  )
}
