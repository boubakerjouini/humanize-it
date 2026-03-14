import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  metadataBase: new URL("https://humanizeit.app"),
};

export default function UseCasesLayout({ children }: { children: React.ReactNode }) {
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
          © {new Date().getFullYear()} HumanizeIt. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
