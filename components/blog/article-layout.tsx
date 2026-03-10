import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { BlogPost } from "@/lib/blog";

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
        background: "#09090b",
        color: "#fafafa",
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
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          backdropFilter: "blur(16px) saturate(180%)",
          background: "rgba(9,9,11,0.88)",
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
            <span style={{ fontSize: "19px", fontWeight: 800, color: "#8b5cf6", letterSpacing: "-0.5px" }}>H.</span>
            <span style={{ fontSize: "14px", fontWeight: 600, color: "#fafafa" }}>HumanizeIt</span>
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: "28px" }}>
            <Link href="/blog" style={{ color: "rgba(255,255,255,0.45)", fontSize: "13px", textDecoration: "none" }}>Blog</Link>
            <Link href="/dashboard/editor" style={{ background: "#8b5cf6", color: "#fafafa", fontSize: "13px", fontWeight: 600, padding: "6px 16px", borderRadius: "6px", textDecoration: "none" }}>
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
            color: "rgba(255,255,255,0.4)",
            fontSize: "13px",
            textDecoration: "none",
            marginBottom: "32px",
          }}
        >
          <ArrowLeft size={14} /> Back to Blog
        </Link>

        {/* Header */}
        <header style={{ marginBottom: "40px" }}>
          <span
            style={{
              display: "inline-block",
              fontSize: "12px",
              fontWeight: 600,
              color: "#8b5cf6",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: "12px",
            }}
          >
            {post.category}
          </span>
          <h1
            style={{
              fontSize: "clamp(28px, 5vw, 40px)",
              fontWeight: 800,
              lineHeight: 1.15,
              letterSpacing: "-0.02em",
              color: "#fafafa",
              margin: "0 0 16px",
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
              color: "rgba(255,255,255,0.4)",
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
            border: "1px solid rgba(139,92,246,0.3)",
            borderRadius: "12px",
            background: "rgba(139,92,246,0.06)",
            padding: "32px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "22px", fontWeight: 700, color: "#fafafa", marginBottom: "8px" }}>
            Try HumanizeIt Free
          </div>
          <p style={{ fontSize: "15px", color: "rgba(255,255,255,0.55)", marginBottom: "20px", lineHeight: 1.5 }}>
            Paste your text, get an AI detection score, and humanize it in seconds.
          </p>
          <Link
            href="/"
            style={{
              display: "inline-block",
              background: "#8b5cf6",
              color: "#fff",
              fontSize: "15px",
              fontWeight: 600,
              padding: "12px 28px",
              borderRadius: "8px",
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
