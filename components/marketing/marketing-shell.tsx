// Shared marketing chrome (sticky nav + footer) for content-cluster sections.
// Server component. Used by the /bypass, /alternatives, /faq layouts; the
// footer link row (MarketingFooterLinks) is also used by the tools, blog,
// compare and use-cases layouts.
import Link from "next/link";
import { THEME } from "@/lib/theme";

const NAV = [
  { label: "AI Detector", href: "/ai-detector" },
  { label: "Humanizer", href: "/free-ai-humanizer" },
  { label: "Compare", href: "/compare" },
  { label: "Use Cases", href: "/use-cases" },
  { label: "Blog", href: "/blog" },
];

// Every free tool and content hub, in every marketing footer, so each sitemap
// URL stays within two clicks of any page (footer -> hub -> spoke).
const SITE_LINKS = [
  { label: "AI Detector", href: "/ai-detector" },
  { label: "Free AI Humanizer", href: "/free-ai-humanizer" },
  { label: "GPTZero Checker", href: "/gptzero-checker" },
  { label: "Detector Guides", href: "/bypass" },
  { label: "Compare", href: "/compare" },
  { label: "Alternatives", href: "/alternatives" },
  { label: "Use Cases", href: "/use-cases" },
  { label: "FAQ", href: "/faq" },
  { label: "Blog", href: "/blog" },
  { label: "Free Guides", href: "/free" },
  { label: "Chrome Extension", href: "/extension" },
];

export function MarketingFooterLinks() {
  return (
    <nav aria-label="Free tools and guides" style={{ display: "flex", gap: "18px", justifyContent: "center", flexWrap: "wrap" }}>
      {SITE_LINKS.map((n) => (
        <Link key={n.href} href={n.href} style={{ color: THEME.textDim, textDecoration: "none" }}>{n.label}</Link>
      ))}
    </nav>
  );
}

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
              <Link key={n.href} href={n.href} className="mkt-nav-link" style={{ color: THEME.brandHi, fontSize: "13px", textDecoration: "none", fontWeight: 500 }}>
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
          <MarketingFooterLinks />
          <div>© {new Date().getFullYear()} HumanizeIt. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
}
