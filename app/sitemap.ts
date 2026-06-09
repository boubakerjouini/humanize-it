import { MetadataRoute } from "next";
import { getAllPosts } from "@/lib/blog";

type Freq = MetadataRoute.Sitemap[number]["changeFrequency"];

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://humanizeit.app";
  const now = new Date();
  const e = (path: string, priority: number, changeFrequency: Freq = "monthly") => ({
    url: `${baseUrl}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  });

  // Generated from route lists so the sitemap can't silently drift out of sync
  // with the app. Add a new route to the relevant array below and it appears.
  const bypassDetectors = ["turnitin", "gptzero", "zerogpt", "originality-ai", "copyleaks", "winston-ai"];
  const compareSpokes = ["undetectable-ai", "stealthgpt", "quillbot", "writehuman", "phrasly"];
  const altCompetitors = ["undetectable-ai", "quillbot", "stealthgpt"];
  const faqQuestions = ["can-turnitin-detect-chatgpt", "can-turnitin-detect-claude", "can-gptzero-detect-chatgpt"];
  const useCaseSlugs = ["students", "copywriters", "agencies", "essays", "research-papers", "cover-letters", "seo-content", "freelancers"];

  return [
    // Core
    e("", 1, "weekly"),
    e("/lifetime", 0.9),
    e("/compare", 0.8),
    e("/use-cases", 0.7),
    e("/docs/api", 0.5),

    // Free tools
    e("/ai-detector", 0.9, "weekly"),
    e("/free-ai-humanizer", 0.9, "weekly"),
    e("/gptzero-checker", 0.8),

    // Bypass cluster
    e("/bypass", 0.8, "weekly"),
    ...bypassDetectors.map((d) => e(`/bypass/${d}`, 0.8)),

    // Comparison spokes
    ...compareSpokes.map((s) => e(`/compare/humanizeit-vs-${s}`, 0.8)),

    // Alternatives cluster
    e("/alternatives", 0.7),
    ...altCompetitors.map((c) => e(`/alternatives/${c}`, 0.7)),

    // FAQ / question cluster
    e("/faq", 0.6),
    ...faqQuestions.map((q) => e(`/faq/${q}`, 0.6)),

    // Use cases
    ...useCaseSlugs.map((s) => e(`/use-cases/${s}`, 0.7)),

    // Blog (generated from post metadata)
    e("/blog", 0.9, "weekly"),
    ...getAllPosts().map((p) => e(`/blog/${p.slug}`, 0.8)),

    // Legal
    ...["/privacy", "/terms", "/cookies", "/refunds"].map((p) => e(p, 0.3, "yearly")),
  ];
}
