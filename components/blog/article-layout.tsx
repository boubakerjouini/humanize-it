import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { BlogPost } from "@/lib/blog";
import { THEME, glow } from "@/lib/theme";

export function ArticleLayout({
  post,
  children,
}: {
  post: BlogPost;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        minHeight: "100vh",
        color: THEME.text,
      }}
    >
      {/* Nav */}
      <nav
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          height: "56px",
          display: "flex",
          alignItems: "center",
          borderBottom: `1px solid ${THEME.border}`,
          backdropFilter: "blur(16px) saturate(180%)",
          background: "rgba(255,255,255,0.82)",
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
            <span style={{ fontSize: "19px", fontWeight: 800, color: THEME.brand, letterSpacing: "-0.5px", fontFamily: THEME.fontHeading }}>H<span style={{ color: THEME.accent }}>.</span></span>
            <span style={{ fontSize: "14px", fontWeight: 600, color: THEME.text, fontFamily: THEME.fontHeading }}>HumanizeIt</span>
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: "28px" }}>
            <Link href="/blog" style={{ color: THEME.brandHi, fontSize: "13px", textDecoration: "none", fontWeight: 600 }}>Blog</Link>
            <Link href="/dashboard/editor" style={{ background: THEME.brand, color: "#ffffff", fontSize: "13px", fontWeight: 600, padding: "7px 18px", borderRadius: "999px", textDecoration: "none", boxShadow: glow(THEME.brand, 0.32) }}>
              Try Free &rarr;
            </Link>
          </div>
        </div>
      </nav>

      {/* Article */}
      <article style={{ maxWidth: "720px", margin: "0 auto", padding: "48px 24px 80px" }}>
        <Link
          href="/blog"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            color: THEME.textDim,
            fontSize: "13px",
            fontWeight: 500,
            textDecoration: "none",
            marginBottom: "32px",
          }}
        >
          <ArrowLeft size={14} aria-hidden="true" /> Back to Blog
        </Link>

        {/* Header */}
        <header style={{ marginBottom: "40px" }}>
          <div className="kicker" style={{ marginBottom: "16px" }}>{post.category}</div>
          <h1
            style={{
              fontSize: "clamp(28px, 5vw, 40px)",
              fontWeight: 700,
              lineHeight: 1.15,
              letterSpacing: "-0.02em",
              color: THEME.text,
              margin: "0 0 16px",
              fontFamily: THEME.fontHeading,
            }}
          >
            {post.title}
          </h1>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              fontSize: "13px",
              color: THEME.textDim,
            }}
          >
            <span>{new Date(post.date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</span>
            <span style={{ color: THEME.border }}>&middot;</span>
            <span>{post.readingTime} min read</span>
          </div>
        </header>

        {/* Content */}
        <div className="blog-prose">{children}</div>

        {/* CTA */}
        <div
          style={{
            marginTop: "56px",
            border: `1px solid ${THEME.border}`,
            borderRadius: THEME.radiusLg,
            background: THEME.surface1,
            padding: "36px 32px",
            textAlign: "center",
            boxShadow: glow(THEME.brand, 0.16),
          }}
        >
          <div style={{ fontSize: "24px", fontWeight: 700, marginBottom: "8px", fontFamily: THEME.fontHeading, letterSpacing: "-0.01em" }}>
            <span style={{ color: THEME.text }}>Try </span>
            <span className="text-gradient">HumanizeIt</span>
            <span style={{ color: THEME.text }}> Free</span>
          </div>
          <p style={{ fontSize: "15px", color: THEME.textDim, marginBottom: "24px", lineHeight: 1.5 }}>
            Paste your text, get an AI detection score, and humanize it in seconds.
          </p>
          <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
            <Link
              href="/"
              style={{
                display: "inline-block",
                background: THEME.brand,
                color: "#fff",
                fontSize: "15px",
                fontWeight: 600,
                padding: "12px 28px",
                borderRadius: THEME.radius,
                textDecoration: "none",
                boxShadow: glow(THEME.brand, 0.32),
              }}
            >
              Get Started Free &rarr;
            </Link>
            <Link
              href="/blog"
              style={{
                display: "inline-block",
                background: THEME.accentDim,
                color: THEME.accentHi,
                fontSize: "15px",
                fontWeight: 600,
                padding: "12px 28px",
                borderRadius: THEME.radius,
                textDecoration: "none",
                border: `1px solid ${THEME.accent}33`,
              }}
            >
              More guides
            </Link>
          </div>
        </div>
      </article>
    </div>
  );
}
