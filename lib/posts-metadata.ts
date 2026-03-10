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
