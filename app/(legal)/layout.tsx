export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: '#ffffff', minHeight: '100vh', color: '#374151', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ borderBottom: '1px solid #e5e7eb', padding: '16px 24px' }}>
        <a href="/" style={{ textDecoration: 'none' }}>
          <span style={{ fontSize: '20px', fontWeight: 700, background: 'linear-gradient(135deg, #7e22ce, #4f46e5)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            HumanizeIt
          </span>
        </a>
      </header>
      <main style={{ maxWidth: '768px', margin: '0 auto', padding: '64px 24px' }}>
        {children}
      </main>
      <footer style={{ borderTop: '1px solid #e5e7eb', padding: '32px 24px', textAlign: 'center' }}>
        <div style={{ display: 'flex', gap: '24px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '12px' }}>
          <a href="/privacy" style={{ color: '#7e22ce', textDecoration: 'none', fontSize: '13px' }}>Privacy Policy</a>
          <a href="/terms" style={{ color: '#7e22ce', textDecoration: 'none', fontSize: '13px' }}>Terms of Service</a>
          <a href="/cookies" style={{ color: '#7e22ce', textDecoration: 'none', fontSize: '13px' }}>Cookie Policy</a>
          <a href="/refunds" style={{ color: '#7e22ce', textDecoration: 'none', fontSize: '13px' }}>Refund Policy</a>
          <a href="/" style={{ color: '#9ca3af', textDecoration: 'none', fontSize: '13px' }}>← Back to Home</a>
        </div>
        <p style={{ color: '#9ca3af', fontSize: '12px', margin: 0 }}>© 2026 HumanizeIt. All rights reserved.</p>
      </footer>
    </div>
  )
}
