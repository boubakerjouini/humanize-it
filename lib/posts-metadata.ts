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
    slug: "undetectable-ai-alternative",
    title: "Best Undetectable AI Alternative in 2025",
    description: "Why users are switching from Undetectable.ai — and what to use instead.",
    date: "2025-03-14",
    category: "Comparison",
    readingTime: 6,
    excerpt: "Why users are switching from Undetectable.ai — and what to use instead.",
  },
  {
    slug: "humanize-chatgpt-text",
    title: "How to Humanize ChatGPT Text in 2025 (Free)",
    description: "A step-by-step guide to making AI-generated text undetectable.",
    date: "2025-03-13",
    category: "Guide",
    readingTime: 5,
    excerpt: "A step-by-step guide to making AI-generated text undetectable.",
  },
  {
    slug: "bypass-ai-detection",
    title: "How to Bypass AI Detection in 2025 — Complete Guide",
    description: "Everything you need to know about beating GPTZero, Turnitin, and Originality.ai.",
    date: "2025-03-12",
    category: "Guide",
    readingTime: 7,
    excerpt: "Everything you need to know about beating GPTZero, Turnitin, and Originality.ai.",
  },
  {
    slug: "best-ai-humanizer-tools",
    title: "7 Best AI Humanizer Tools in 2025 (Tested & Compared)",
    description: "We tested every major AI humanizer so you don't have to.",
    date: "2025-03-11",
    category: "Comparison",
    readingTime: 8,
    excerpt: "We tested every major AI humanizer so you don't have to.",
  },
  {
    slug: "ai-detection-how-it-works",
    title: "How AI Detection Works in 2025 — And How to Beat It Ethically",
    description: "The technical truth behind perplexity, burstiness, and AI pattern detection.",
    date: "2025-03-10",
    category: "Deep Dive",
    readingTime: 10,
    excerpt: "The technical truth behind perplexity, burstiness, and AI pattern detection.",
  },
];
