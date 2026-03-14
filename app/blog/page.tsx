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

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  Guide: { bg: "#f0fdf4", text: "#16a34a" },
  Comparison: { bg: "#faf5ff", text: "#7e22ce" },
  "Deep Dive": { bg: "#eff6ff", text: "#2563eb" },
};

export default function BlogPage() {
  const posts = getAllPosts();

  return (
    <>
      {/* Header */}
      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "56px 24px 0", textAlign: "center" }}>
        <h1
          style={{
            fontSize: "clamp(28px, 5vw, 40px)",
            fontWeight: 800,
            letterSpacing: "-0.02em",
            lineHeight: 1.15,
            marginBottom: "12px",
          }}
        >
          The HumanizeIt Blog
        </h1>
        <p style={{ fontSize: "16px", color: "#6b7280", lineHeight: 1.6, maxWidth: "520px", margin: "0 auto" }}>
          Expert guides on AI detection, humanizing AI text, and writing that passes every detector.
        </p>
      </div>

      {/* Grid */}
      <div
        className="blog-grid"
        style={{
          maxWidth: "1100px",
          margin: "0 auto",
          padding: "40px 24px 80px",
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "24px",
        }}
      >
        {posts.map((post) => {
          const cat = CATEGORY_COLORS[post.category] ?? { bg: "#faf5ff", text: "#7e22ce" };
          return (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <div
                className="blog-card"
                style={{
                  background: "#ffffff",
                  border: "1px solid #f3f4f6",
                  borderRadius: "16px",
                  padding: "24px",
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  transition: "border-color 0.2s ease, box-shadow 0.2s ease",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = "#e9d5ff";
                  (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 20px rgba(126,34,206,0.06)";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = "#f3f4f6";
                  (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 600,
                      color: cat.text,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      padding: "3px 10px",
                      borderRadius: "6px",
                      background: cat.bg,
                    }}
                  >
                    {post.category}
                  </span>
                  <span style={{ fontSize: "12px", color: "#9ca3af" }}>
                    {post.readingTime} min read
                  </span>
                </div>
                <h2
                  style={{
                    fontSize: "17px",
                    fontWeight: 700,
                    lineHeight: 1.35,
                    marginBottom: "8px",
                    color: "#111827",
                  }}
                >
                  {post.title}
                </h2>
                <p
                  style={{
                    fontSize: "14px",
                    lineHeight: 1.55,
                    color: "#6b7280",
                    marginBottom: "16px",
                    flex: 1,
                  }}
                >
                  {post.excerpt}
                </p>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "12px", color: "#9ca3af" }}>
                    {new Date(post.date).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                  <span style={{ fontSize: "13px", fontWeight: 600, color: "#7e22ce" }}>
                    Read more &rarr;
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <style>{`
        @media (max-width: 768px) {
          .blog-grid {
            grid-template-columns: 1fr !important;
          }
        }
        @media (min-width: 769px) and (max-width: 1024px) {
          .blog-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
      `}</style>
    </>
  );
}
