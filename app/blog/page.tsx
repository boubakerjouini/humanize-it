import Link from "next/link";
import type { Metadata } from "next";
import { getAllPosts } from "@/lib/blog";

export const metadata: Metadata = {
  title: "Blog — AI Writing & Detection Guides | HumanizeIt",
  description:
    "Expert guides on AI detection, humanizing AI text, and bypassing GPTZero, Turnitin, and Originality.ai.",
  alternates: { canonical: "https://humanizeit.app/blog" },
  openGraph: {
    title: "Blog — AI Writing & Detection Guides",
    description:
      "Expert guides on AI detection, humanizing AI text, and bypassing GPTZero, Turnitin, and Originality.ai.",
    url: "https://humanizeit.app/blog",
    siteName: "HumanizeIt",
    type: "website",
  },
};

export default function BlogPage() {
  const posts = getAllPosts();

  return (
    <div style={{ minHeight: "100vh", background: "#09090b", color: "#fafafa" }}>
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
            <Link href="/blog" style={{ color: "#8b5cf6", fontSize: "13px", textDecoration: "none", fontWeight: 500 }}>Blog</Link>
            <Link
              href="/dashboard/editor"
              style={{
                background: "#8b5cf6",
                color: "#fafafa",
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

      {/* Header */}
      <div style={{ maxWidth: "860px", margin: "0 auto", padding: "56px 24px 0" }}>
        <h1
          style={{
            fontSize: "clamp(28px, 5vw, 40px)",
            fontWeight: 800,
            letterSpacing: "-0.02em",
            lineHeight: 1.15,
            marginBottom: "12px",
          }}
        >
          Blog
        </h1>
        <p style={{ fontSize: "16px", color: "rgba(255,255,255,0.45)", lineHeight: 1.5, maxWidth: "520px" }}>
          Expert guides on AI detection, humanizing AI text, and writing that passes every detector.
        </p>
      </div>

      {/* Grid */}
      <div
        className="blog-grid"
        style={{
          maxWidth: "860px",
          margin: "0 auto",
          padding: "40px 24px 80px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))",
          gap: "20px",
        }}
      >
        {posts.map((post) => (
          <Link
            key={post.slug}
            href={`/blog/${post.slug}`}
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <div className="blog-card">
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "#8b5cf6",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    padding: "3px 8px",
                    borderRadius: "4px",
                    background: "rgba(139,92,246,0.1)",
                  }}
                >
                  {post.category}
                </span>
                <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.3)" }}>
                  {post.readingTime} min read
                </span>
              </div>
              <h2
                style={{
                  fontSize: "18px",
                  fontWeight: 700,
                  lineHeight: 1.3,
                  marginBottom: "8px",
                  color: "#fafafa",
                }}
              >
                {post.title}
              </h2>
              <p
                style={{
                  fontSize: "14px",
                  lineHeight: 1.55,
                  color: "rgba(255,255,255,0.45)",
                  marginBottom: "16px",
                }}
              >
                {post.excerpt}
              </p>
              <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.25)" }}>
                {new Date(post.date).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
