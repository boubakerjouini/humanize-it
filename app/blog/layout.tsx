import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  metadataBase: new URL("https://humanizeit.app"),
};

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "#ffffff", color: "#111827" }}>
      <nav
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          height: "56px",
          display: "flex",
          alignItems: "center",
          borderBottom: "1px solid #e5e7eb",
          backdropFilter: "blur(16px) saturate(180%)",
          background: "rgba(255,255,255,0.88)",
          padding: "0 24px",
        }}
      >
        <div
          style={{
            maxWidth: "1140px",
            margin: "0 auto",
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Link
            href="/"
            style={{ display: "flex", alignItems: "center", gap: "7px", textDecoration: "none" }}
          >
            <span style={{ fontSize: "19px", fontWeight: 800, color: "#7e22ce", letterSpacing: "-0.5px" }}>H.</span>
            <span style={{ fontSize: "14px", fontWeight: 600, color: "#111827" }}>HumanizeIt</span>
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: "28px" }}>
            <Link href="/blog" style={{ color: "#7e22ce", fontSize: "13px", textDecoration: "none", fontWeight: 500 }}>Blog</Link>
            <Link
              href="/dashboard/editor"
              style={{
                background: "#7e22ce",
                color: "#ffffff",
                fontSize: "13px",
                fontWeight: 600,
                padding: "6px 16px",
                borderRadius: "6px",
                textDecoration: "none",
              }}
            >
              Try Free &rarr;
            </Link>
          </div>
        </div>
      </nav>

      <main>{children}</main>

      <footer
        style={{
          borderTop: "1px solid #e5e7eb",
          padding: "32px 24px",
          textAlign: "center",
          fontSize: "13px",
          color: "#9ca3af",
        }}
      >
        <div style={{ maxWidth: "1140px", margin: "0 auto" }}>
          © {new Date().getFullYear()} HumanizeIt. All rights reserved. · by{" "}
          <a
            href="https://www.linkedin.com/in/boubakerjouini/"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#9ca3af", textDecoration: "none" }}
          >
            Boubaker Jouini
          </a>{" "}
          · <a
            href="https://www.linkedin.com/in/boubakerjouini/"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#9ca3af", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "3px", verticalAlign: "middle" }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
            LinkedIn
          </a>
        </div>
      </footer>
    </div>
  );
}
