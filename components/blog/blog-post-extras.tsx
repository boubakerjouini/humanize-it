// Drop-in extras for a blog post page: emits BlogPosting JSON-LD and renders a
// "Related articles" block (up to 3 other posts) for internal-link circulation.
// Server component — looks the post up by slug from lib/posts-metadata.
import Link from "next/link";
import { getAllPosts, getPostBySlug } from "@/lib/blog";
import { ArticleJsonLd, kitStyles } from "@/components/seo/page-kit";
import { THEME } from "@/lib/theme";

export function BlogPostExtras({ slug }: { slug: string }) {
  const post = getPostBySlug(slug);
  const related = getAllPosts().filter((p) => p.slug !== slug).slice(0, 3);

  return (
    <>
      {post && (
        <ArticleJsonLd
          headline={post.title}
          description={post.description}
          url={`https://humanizeit.app/blog/${slug}`}
          datePublished={post.date}
        />
      )}

      {related.length > 0 && (
        <section style={{ marginTop: "56px", borderTop: `1px solid ${THEME.border}`, paddingTop: "32px" }}>
          <h2 style={{ ...kitStyles.h2, marginTop: 0 }}>Related articles</h2>
          <div style={{ display: "grid", gap: "12px" }}>
            {related.map((p) => (
              <Link
                key={p.slug}
                href={`/blog/${p.slug}`}
                style={{
                  display: "block",
                  background: THEME.surface1,
                  border: `1px solid ${THEME.border}`,
                  borderRadius: THEME.radius,
                  padding: "16px 18px",
                  textDecoration: "none",
                }}
              >
                <div style={{ fontSize: "11px", color: THEME.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px" }}>
                  {p.category}
                </div>
                <div style={{ fontSize: "15px", fontWeight: 600, color: THEME.text, marginBottom: "4px" }}>{p.title}</div>
                <div style={{ fontSize: "14px", color: THEME.textDim, lineHeight: 1.5 }}>{p.excerpt}</div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
