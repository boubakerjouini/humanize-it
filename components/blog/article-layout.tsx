import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { BlogPost } from "@/lib/blog";
import { THEME } from "@/lib/theme";

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
          background: "rgba(16,18,24,0.82)",
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
            <span style={{ fontSize: "19px", fontWeight: 800, color: THEME.brand, letterSpacing: "-0.5px", fontFamily: THEME.fontHeading }}>H.</span>
            <span style={{ fontSize: "14px", fontWeight: 600, color: THEME.text, fontFamily: THEME.fontHeading }}>HumanizeIt</span>
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: "28px" }}>
            <Link href="/blog" style={{ color: THEME.textDim, fontSize: "13px", textDecoration: "none" }}>Blog</Link>
            <Link href="/dashboard/editor" style={{ background: THEME.brand, color: "#ffffff", fontSize: "13px", fontWeight: 600, padding: "6px 16px", borderRadius: "8px", textDecoration: "none" }}>
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
            textDecoration: "none",
            marginBottom: "32px",
            fontFamily: THEME.fontMono,
          }}
        >
          <ArrowLeft size={14} aria-hidden="true" /> Back to Blog
        </Link>

        {/* Header */}
        <header style={{ marginBottom: "40px" }}>
          <span
            style={{
              display: "inline-block",
              fontSize: "12px",
              fontWeight: 600,
              color: THEME.brandHi,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: "12px",
              fontFamily: THEME.fontMono,
            }}
          >
            {post.category}
          </span>
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
              gap: "16px",
              fontSize: "13px",
              color: THEME.textMuted,
              fontFamily: THEME.fontMono,
            }}
          >
            <span>{new Date(post.date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</span>
            <span>&middot;</span>
            <span>{post.readingTime} min read</span>
          </div>
        </header>

        {/* Content */}
        <div className="blog-prose">{children}</div>

        {/* CTA */}
        <div
          style={{
            marginTop: "56px",
            border: `1px solid ${THEME.borderStrong}`,
            borderRadius: THEME.radiusLg,
            background: THEME.surface2,
            padding: "32px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "22px", fontWeight: 700, color: THEME.text, marginBottom: "8px", fontFamily: THEME.fontHeading, letterSpacing: "-0.01em" }}>
            Try HumanizeIt Free
          </div>
          <p style={{ fontSize: "15px", color: THEME.textDim, marginBottom: "20px", lineHeight: 1.5 }}>
            Paste your text, get an AI detection score, and humanize it in seconds.
          </p>
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
            }}
          >
            Get Started Free &rarr;
          </Link>
        </div>
      </article>
    </div>
  );
}
