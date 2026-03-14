export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  date: string;
  category: string;
  readingTime: number;
  excerpt: string;
}

// Static post registry — metadata lives here, content lives in /content/blog/*.mdx
export const POSTS: BlogPost[] = [
  {
    slug: "undetectable-ai-alternative",
    title: "Best Undetectable AI Alternative in 2025",
    description:
      "Why users are switching from Undetectable.ai — and what to use instead.",
    date: "2025-03-14",
    category: "Comparison",
    readingTime: 6,
    excerpt:
      "Why users are switching from Undetectable.ai — and what to use instead.",
  },
  {
    slug: "humanize-chatgpt-text",
    title: "How to Humanize ChatGPT Text in 2025 (Free)",
    description:
      "A step-by-step guide to making AI-generated text undetectable.",
    date: "2025-03-13",
    category: "Guide",
    readingTime: 5,
    excerpt:
      "A step-by-step guide to making AI-generated text undetectable.",
  },
  {
    slug: "bypass-ai-detection",
    title: "How to Bypass AI Detection in 2025 — Complete Guide",
    description:
      "Everything you need to know about beating GPTZero, Turnitin, and Originality.ai.",
    date: "2025-03-12",
    category: "Guide",
    readingTime: 7,
    excerpt:
      "Everything you need to know about beating GPTZero, Turnitin, and Originality.ai.",
  },
  {
    slug: "best-ai-humanizer-tools",
    title: "7 Best AI Humanizer Tools in 2025 (Tested & Compared)",
    description:
      "We tested every major AI humanizer so you don't have to.",
    date: "2025-03-11",
    category: "Comparison",
    readingTime: 8,
    excerpt:
      "We tested every major AI humanizer so you don't have to.",
  },
  {
    slug: "ai-detection-how-it-works",
    title: "How AI Detection Works in 2025 — And How to Beat It Ethically",
    description:
      "The technical truth behind perplexity, burstiness, and AI pattern detection.",
    date: "2025-03-10",
    category: "Deep Dive",
    readingTime: 10,
    excerpt:
      "The technical truth behind perplexity, burstiness, and AI pattern detection.",
  },
  {
    slug: "how-to-bypass-ai-detection",
    title: "How to Bypass AI Detection in 2025: A Complete Guide",
    description:
      "Learn exactly how AI detectors work and how to make ChatGPT text undetectable. Step-by-step guide covering GPTZero, Turnitin, and Originality.ai.",
    date: "2025-05-10",
    category: "Guide",
    readingTime: 8,
    excerpt:
      "AI detectors are getting smarter — but so are the tools to beat them. Here's everything you need to know about bypassing AI detection in 2025.",
  },
  {
    slug: "ai-detection-patterns",
    title: "The 24 Patterns AI Detectors Use to Flag Your Text (And How to Fix Them)",
    description:
      "AI detectors analyze 24 specific patterns in your writing. Here's exactly what they look for and how HumanizeIt's engine scores each one.",
    date: "2025-05-08",
    category: "Deep Dive",
    readingTime: 7,
    excerpt:
      "Most AI humanizers are a black box. We're not. Here are the 24 patterns our detector engine analyzes — and what you can do about each one.",
  },
];
