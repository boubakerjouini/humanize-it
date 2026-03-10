import fs from "fs";
import path from "path";

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  date: string;
  category: string;
  readingTime: number;
  excerpt: string;
}

const BLOG_DIR = path.join(process.cwd(), "content/blog");

function extractFrontmatter(source: string): Record<string, string> {
  const match = source.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const fm: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    fm[key] = val;
  }
  return fm;
}

export function getAllPosts(): BlogPost[] {
  if (!fs.existsSync(BLOG_DIR)) return [];
  const files = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith(".mdx"));
  const posts: BlogPost[] = files.map((file) => {
    const source = fs.readFileSync(path.join(BLOG_DIR, file), "utf-8");
    const fm = extractFrontmatter(source);
    return {
      slug: fm.slug || file.replace(/\.mdx$/, ""),
      title: fm.title || "Untitled",
      description: fm.description || "",
      date: fm.date || "",
      category: fm.category || "Article",
      readingTime: parseInt(fm.readingTime || "5", 10),
      excerpt: fm.excerpt || fm.description || "",
    };
  });
  return posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function getPostBySlug(slug: string): BlogPost | null {
  const posts = getAllPosts();
  return posts.find((p) => p.slug === slug) || null;
}

export function calculateReadingTime(content: string): number {
  const words = content.split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 250));
}
