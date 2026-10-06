export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  /** First publication (YYYY-MM-DD). Feeds BlogPosting JSON-LD, the byline and the sitemap. */
  date: string;
  /** Last substantive edit (YYYY-MM-DD); omit until the post is revised. */
  dateModified?: string;
  category: string;
  readingTime: number;
  excerpt: string;
}

export const POSTS: BlogPost[] = [
  {
    slug: "humanize-chatgpt-text",
    title: "How to Humanize ChatGPT Text in 2026 (Free)",
    description: "A step-by-step guide to making ChatGPT drafts sound natural, and checking them before you publish.",
    date: "2026-03-13",
    dateModified: "2026-10-06",
    category: "Guide",
    readingTime: 6,
    excerpt: "A step-by-step guide to making ChatGPT drafts sound natural, and checking them before you publish.",
  },
  {
    slug: "best-ai-humanizer-tools",
    title: "7 Best AI Humanizer Tools in 2026 (Compared)",
    description: "Seven popular AI humanizers compared on price, free tier, transparency and billing.",
    date: "2026-03-11",
    dateModified: "2026-10-06",
    category: "Comparison",
    readingTime: 7,
    excerpt: "Seven popular AI humanizers compared on price, free tier, transparency and billing.",
  },
  {
    slug: "ai-detection-how-it-works",
    title: "How AI Detection Works in 2026 — and Why It Flags Humans",
    description: "The technical truth behind perplexity, burstiness, and AI pattern detection.",
    date: "2026-03-10",
    dateModified: "2026-10-06",
    category: "Deep Dive",
    readingTime: 6,
    excerpt: "The technical truth behind perplexity, burstiness, and AI pattern detection.",
  },
];
