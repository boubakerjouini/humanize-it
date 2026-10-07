import { MetadataRoute } from "next";
import { getAllPosts } from "@/lib/blog";

type Freq = MetadataRoute.Sitemap[number]["changeFrequency"];

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://humanizeit.app";
  // lastModified is the date the page's own content last changed (shared
  // nav/footer edits don't count). It used to be the build time for every URL,
  // which tells crawlers nothing; bump a page's date when you edit that page.
  const e = (path: string, lastModified: string, priority: number, changeFrequency: Freq = "monthly") => ({
    url: `${baseUrl}${path}`,
    lastModified,
    changeFrequency,
    priority,
  });

  // Generated from route lists so the sitemap can't silently drift out of sync
  // with the app. Add a new route (with its date) to the relevant list below
  // and it appears.
  const bypassDetectors: [slug: string, lastModified: string][] = [
    ["turnitin", "2026-10-06"],
    ["gptzero", "2026-10-06"],
    ["zerogpt", "2026-06-09"],
    ["originality-ai", "2026-06-09"],
    ["copyleaks", "2026-06-09"],
    ["winston-ai", "2026-06-09"],
  ];
  const compareSpokes: [slug: string, lastModified: string][] = [
    ["undetectable-ai", "2026-10-06"],
    ["stealthgpt", "2026-10-06"],
    ["quillbot", "2026-06-09"],
    ["writehuman", "2026-06-09"],
    ["phrasly", "2026-06-09"],
  ];
  const altCompetitors: [slug: string, lastModified: string][] = [
    ["undetectable-ai", "2026-10-06"],
    ["quillbot", "2026-10-06"],
    ["stealthgpt", "2026-10-06"],
  ];
  const faqQuestions: [slug: string, lastModified: string][] = [
    ["can-turnitin-detect-chatgpt", "2026-10-06"],
    ["can-turnitin-detect-claude", "2026-10-06"],
    ["can-gptzero-detect-chatgpt", "2026-10-06"],
  ];
  const useCaseSlugs: [slug: string, lastModified: string][] = [
    ["students", "2026-10-06"],
    ["copywriters", "2026-10-06"],
    ["agencies", "2026-10-06"],
    ["essays", "2026-10-06"],
    ["research-papers", "2026-06-09"],
    ["cover-letters", "2026-06-09"],
    ["seo-content", "2026-10-06"],
    ["freelancers", "2026-10-06"],
  ];

  return [
    // Core
    e("", "2026-10-06", 1, "weekly"),
    e("/lifetime", "2026-10-06", 0.9),
    e("/compare", "2026-10-06", 0.8),
    e("/use-cases", "2026-10-06", 0.7),
    e("/docs/api", "2026-10-06", 0.5),

    // Free tools
    e("/ai-detector", "2026-10-06", 0.9, "weekly"),
    e("/free-ai-humanizer", "2026-10-06", 0.9, "weekly"),
    e("/gptzero-checker", "2026-10-06", 0.8),

    // Bypass cluster
    e("/bypass", "2026-06-09", 0.8, "weekly"),
    ...bypassDetectors.map(([d, lm]) => e(`/bypass/${d}`, lm, 0.8)),

    // Comparison spokes
    ...compareSpokes.map(([s, lm]) => e(`/compare/humanizeit-vs-${s}`, lm, 0.8)),

    // Alternatives cluster
    e("/alternatives", "2026-06-09", 0.7),
    ...altCompetitors.map(([c, lm]) => e(`/alternatives/${c}`, lm, 0.7)),

    // FAQ / question cluster
    e("/faq", "2026-06-09", 0.6),
    ...faqQuestions.map(([q, lm]) => e(`/faq/${q}`, lm, 0.6)),

    // Use cases
    ...useCaseSlugs.map(([s, lm]) => e(`/use-cases/${s}`, lm, 0.7)),

    // Blog (generated from post metadata; retired posts 301 elsewhere and are
    // not in POSTS, so they never appear here)
    e("/blog", "2026-10-06", 0.9, "weekly"),
    ...getAllPosts().map((p) => e(`/blog/${p.slug}`, p.dateModified ?? p.date, 0.8)),

    // Legal
    ...["/privacy", "/terms", "/cookies", "/refunds"].map((p) => e(p, "2026-06-09", 0.3, "yearly")),
  ];
}
