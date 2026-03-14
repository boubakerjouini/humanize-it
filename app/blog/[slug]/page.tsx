import { notFound, redirect } from "next/navigation";
import { getAllPosts } from "@/lib/blog";

// All individual posts have their own directories — this dynamic route
// handles any unknown slug gracefully.

export async function generateStaticParams() {
  return []; // Individual pages handle their own routes
}

export default async function BlogSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const posts = getAllPosts();
  const post = posts.find((p) => p.slug === slug);

  if (!post) return notFound();

  // Redirect to the named route if it exists
  redirect(`/blog/${slug}`);
}
