export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Minimal top bar */}
      <nav className="sticky top-0 z-40 border-b border-border bg-[var(--surface-1)]/90 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2 text-sm font-bold text-foreground hover:text-[var(--brand-hi)] transition-colors font-[family-name:var(--font-heading)]">
            <span className="text-[var(--brand)]">H</span>umanizeIt
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--brand-dim)] text-[var(--brand-hi)] border border-[var(--border)]">Docs</span>
          </a>
          <div className="flex items-center gap-4">
            <a href="/dashboard/api" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Dashboard</a>
            <a href="/dashboard/api" className="text-xs px-3 py-1.5 rounded-lg bg-primary hover:bg-[var(--brand-hi)] text-white font-medium transition-colors">
              Get API Key
            </a>
          </div>
        </div>
      </nav>
      {children}
    </div>
  );
}
