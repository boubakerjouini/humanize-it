// Shared marketing chrome (sticky nav + footer) for content-cluster sections.
// Server component. Used by the /bypass, /alternatives, /faq layouts.
import Link from "next/link";
import { THEME } from "@/lib/theme";

const NAV = [
  { label: "AI Detector", href: "/ai-detector" },
  { label: "Humanizer", href: "/free-ai-humanizer" },
  { label: "Compare", href: "/compare" },
  { label: "Use Cases", href: "/use-cases" },
  { label: "Blog", href: "/blog" },
];

export function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: THEME.bg, color: THEME.text }}>
      <nav
        style={{
          position: "sticky", top: 0, zIndex: 50, height: "56px", display: "flex", alignItems: "center",
          borderBottom: `1px solid ${THEME.border}`, backdropFilter: "blur(16px) saturate(180%)",
          background: "rgba(255,255,255,0.82)", padding: "0 24px",
        }}
      >
        <div style={{ maxWidth: "1140px", margin: "0 auto", width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: "7px", textDecoration: "none" }}>
            <span style={{ fontSize: "19px", fontWeight: 800, color: THEME.brand, letterSpacing: "-0.5px", fontFamily: THEME.fontHeading }}>H.</span>
            <span style={{ fontSize: "14px", fontWeight: 600, color: THEME.text, fontFamily: THEME.fontHeading }}>HumanizeIt</span>
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: "20px", flexWrap: "wrap" }}>
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="desktop-only" style={{ color: THEME.brandHi, fontSize: "13px", textDecoration: "none", fontWeight: 500 }}>
                {n.label}
              </Link>
            ))}
            <Link
              href="/sign-up"
              style={{ background: THEME.brand, color: "#ffffff", fontSize: "13px", fontWeight: 600, padding: "6px 16px", borderRadius: THEME.radius, textDecoration: "none" }}
            >
              Try Free &rarr;
            </Link>
          </div>
        </div>
      </nav>

      <main>{children}</main>

      <footer style={{ borderTop: `1px solid ${THEME.border}`, padding: "32px 24px", textAlign: "center", fontSize: "13px", color: THEME.textDim }}>
        <div style={{ maxWidth: "1140px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ display: "flex", gap: "18px", justifyContent: "center", flexWrap: "wrap" }}>
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} style={{ color: THEME.textDim, textDecoration: "none" }}>{n.label}</Link>
            ))}
          </div>
          <div>© {new Date().getFullYear()} HumanizeIt. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
}
