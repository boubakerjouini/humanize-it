import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAllPosts, getPostBySlug } from "@/lib/blog";
import { ArticleLayout } from "@/components/blog/article-layout";

// Map of slug -> dynamic import for MDX content
const mdxModules: Record<string, () => Promise<{ default: React.ComponentType }>> = {
  "how-to-bypass-ai-detection": () => import("@/content/blog/how-to-bypass-ai-detection.mdx"),
  "ai-detection-patterns": () => import("@/content/blog/ai-detection-patterns.mdx"),
};

export async function generateStaticParams() {
  const posts = getAllPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};
  return {
    title: `${post.title} | HumanizeIt`,
    description: post.description,
    alternates: { canonical: `https://humanizeit.app/blog/${post.slug}` },
    openGraph: {
      title: post.title,
      description: post.description,
      url: `https://humanizeit.app/blog/${post.slug}`,
      siteName: "HumanizeIt",
      type: "article",
      publishedTime: post.date,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
    },
  };
}

export default async function BlogArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const loader = mdxModules[slug];
  if (!loader) notFound();

  const { default: MDXContent } = await loader();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    author: {
      "@type": "Organization",
      name: "HumanizeIt",
      url: "https://humanizeit.app",
    },
    publisher: {
      "@type": "Organization",
      name: "HumanizeIt",
      url: "https://humanizeit.app",
    },
    mainEntityOfPage: `https://humanizeit.app/blog/${post.slug}`,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ArticleLayout post={post}>
        <MDXContent />
      </ArticleLayout>
    </>
  );
}
