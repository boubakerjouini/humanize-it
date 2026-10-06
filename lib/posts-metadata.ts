export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  date: string;
  category: string;
  readingTime: number;
  excerpt: string;
}

export const POSTS: BlogPost[] = [
  {
    slug: "humanize-chatgpt-text",
    title: "How to Humanize ChatGPT Text in 2025 (Free)",
    description: "A step-by-step guide to making ChatGPT drafts sound natural, and checking them before you publish.",
    date: "2025-03-13",
    category: "Guide",
    readingTime: 5,
    excerpt: "A step-by-step guide to making ChatGPT drafts sound natural, and checking them before you publish.",
  },
  {
    slug: "best-ai-humanizer-tools",
    title: "7 Best AI Humanizer Tools in 2025 (Compared)",
    description: "Seven popular AI humanizers compared on price, free tier, transparency and billing.",
    date: "2025-03-11",
    category: "Comparison",
    readingTime: 8,
    excerpt: "Seven popular AI humanizers compared on price, free tier, transparency and billing.",
  },
  {
    slug: "ai-detection-how-it-works",
    title: "How AI Detection Works in 2025 — and Why It Flags Humans",
    description: "The technical truth behind perplexity, burstiness, and AI pattern detection.",
    date: "2025-03-10",
    category: "Deep Dive",
    readingTime: 10,
    excerpt: "The technical truth behind perplexity, burstiness, and AI pattern detection.",
  },
];
