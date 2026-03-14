export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0d1117] text-zinc-100">
      {/* Minimal top bar */}
      <nav className="sticky top-0 z-40 border-b border-zinc-800 bg-[#0d1117]/90 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2 text-sm font-bold text-zinc-100 hover:text-zinc-300 transition-colors">
            <span className="text-blue-500">H</span>umanizeIt
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">Docs</span>
          </a>
          <div className="flex items-center gap-4">
            <a href="/dashboard/api" className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors">Dashboard</a>
            <a href="/dashboard/api" className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors">
              Get API Key
            </a>
          </div>
        </div>
      </nav>
      {children}
    </div>
  );
}
